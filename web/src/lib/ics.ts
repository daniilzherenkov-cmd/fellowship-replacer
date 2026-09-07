/**
 * iCalendar (.ics) feed parsing.
 *
 * This is the no-OAuth path into Google Calendar: the user pastes their private
 * "Secret address in iCal format" once and the server polls it. No Google Cloud
 * project, no Workspace admin approval, no client secret.
 *
 * Behaviour verified against node-ical with real Google-shaped input. Three
 * traps, each of which silently loses or corrupts data if unhandled:
 *
 * 1. RECURRING EVENTS ARE NOT EXPANDED. The Google API's singleEvents=true does
 *    this server-side; an .ics feed hands you an RRULE instead. Without
 *    expansion a weekly 1:1 appears as a single event and every later
 *    occurrence is missing.
 *
 * 2. EXCEPTIONS COLLAPSE INTO THE PARENT. node-ical keys events by UID, so a
 *    moved or edited occurrence (RECURRENCE-ID) does NOT appear as its own
 *    entry - it hides in `event.recurrences`. Parsing naively drops the
 *    override and shows the meeting at its original time. Cancelled
 *    occurrences (EXDATE) likewise still come back from rrule.between() and
 *    have to be filtered out by hand.
 *
 * 3. ALL-DAY EVENTS SHIFT TIMEZONE. "Christmas Day" (VALUE=DATE 20261225)
 *    parses as 2026-12-24T23:00Z in a +01:00 zone. They are dropped by default
 *    anyway (holidays and OOO banners are not meetings), but the date must not
 *    be trusted if that ever changes.
 */

import type { NormalisedMeeting, NormalisedPerson, MeetingKind } from './calendar'
import { colorForEmail } from './calendar'

/** Hard cap so one pathological feed cannot exhaust the 200MB container. */
const MAX_EVENTS = 3000
const MAX_FEED_BYTES = 10 * 1024 * 1024

export interface IcsParseOptions {
  /** Only expand/emit occurrences inside this window. */
  from: Date
  to: Date
  /** Drop all-day events (holidays, OOO). Default true. */
  skipAllDay?: boolean
  /** Drop events with no other attendee - focus blocks, Lunch. Default true. */
  skipSolo?: boolean
  /** The viewer's own address, so they are excluded from attendee lists. */
  selfEmail?: string
}

export interface IcsParseResult {
  meetings: NormalisedMeeting[]
  totalEvents: number
  expandedOccurrences: number
  skippedAllDay: number
  skippedSolo: number
  skippedCancelled: number
  truncated: boolean
}

interface IcalAttendee {
  val?: string
  params?: { CN?: string; PARTSTAT?: string; CUTYPE?: string }
}

interface IcalEvent {
  type?: string
  uid?: string
  summary?: string
  description?: string
  location?: string
  status?: string
  start?: Date & { dateOnly?: boolean }
  end?: Date & { dateOnly?: boolean }
  attendee?: IcalAttendee | IcalAttendee[] | string | string[]
  organizer?: IcalAttendee | string
  rrule?: { between: (a: Date, b: Date, inc?: boolean) => Date[] }
  recurrences?: Record<string, IcalEvent>
  exdate?: Record<string, Date>
  recurrenceid?: Date
}

function emailOf(value: IcalAttendee | string | undefined): string | null {
  if (!value) return null
  const raw = typeof value === 'string' ? value : (value.val ?? '')
  const match = raw.replace(/^mailto:/i, '').trim().toLowerCase()
  return match.includes('@') ? match : null
}

function nameOf(value: IcalAttendee | string | undefined, email: string): string {
  if (value && typeof value !== 'string' && value.params?.CN) {
    const cn = value.params.CN.trim()
    if (cn && !cn.includes('@')) return cn
  }
  const local = email.split('@')[0]
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

function attendeeList(event: IcalEvent): IcalAttendee[] {
  const raw = event.attendee
  if (!raw) return []
  const arr = Array.isArray(raw) ? raw : [raw]
  return arr
    .map((a) => (typeof a === 'string' ? { val: a } : a))
    // CUTYPE ROOM/RESOURCE is a meeting room, not a person - the same
    // distinction the Google API makes with `resource: true`.
    .filter((a) => {
      const type = a.params?.CUTYPE?.toUpperCase()
      return type !== 'ROOM' && type !== 'RESOURCE'
    })
}

/** Same rule as the Google path: 2 humans is a 1:1, 3+ is a team meeting. */
function classify(people: number): MeetingKind {
  if (people <= 1) return 'manual'
  if (people === 2) return 'oneOnOne'
  return 'team'
}

function isAllDay(event: IcalEvent): boolean {
  return event.start?.dateOnly === true
}

/** Occurrence keys are compared by minute, matching how EXDATE is stored. */
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function buildMeeting(
  source: IcalEvent,
  start: Date,
  end: Date,
  options: IcsParseOptions,
  /** Distinguishes occurrences of one series. */
  occurrenceSuffix: string,
): NormalisedMeeting | null {
  const attendees = attendeeList(source)
  const self = options.selfEmail?.toLowerCase()

  const people: NormalisedPerson[] = []
  for (const a of attendees) {
    const email = emailOf(a)
    if (!email) continue
    if (self && email === self) continue
    people.push({ email, name: nameOf(a, email), colorHex: colorForEmail(email) })
  }

  // Count includes the viewer, so a 1:1 is "me + one other".
  const humanCount = attendees.map(emailOf).filter(Boolean).length
  const kind = classify(humanCount)

  return {
    // Namespaced apart from `gcal:` (API) and `fellow:` (import) so the three
    // sources can never collide on one meeting row.
    externalId: `ics:${source.uid ?? 'unknown'}${occurrenceSuffix}`,
    title: source.summary?.trim() || 'Untitled',
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    kind,
    isAllDay: isAllDay(source),
    conferenceUrl: extractMeetLink(source),
    location: source.location ?? null,
    attendees: people,
    selfResponse: null,
    organizerEmail: emailOf(source.organizer),
  }
}

/** Google puts the Meet link in the description or location. */
function extractMeetLink(event: IcalEvent): string | null {
  const haystack = `${event.description ?? ''} ${event.location ?? ''}`
  const match = haystack.match(/https:\/\/meet\.google\.com\/[a-z0-9-]+/i)
  return match ? match[0] : null
}

/**
 * Parse a feed into meetings, expanding recurrence within the window.
 */
export async function parseIcsFeed(
  body: string,
  options: IcsParseOptions,
): Promise<IcsParseResult> {
  const { from, to, skipAllDay = true, skipSolo = true } = options

  // node-ical is CommonJS: under an ESM dynamic import the module object is
  // wrapped in `.default`, but not in every bundler/runtime combination - so
  // accept either shape rather than crashing on one of them.
  const mod = (await import('node-ical')) as unknown as {
    sync?: { parseICS: (s: string) => unknown }
    default?: { sync?: { parseICS: (s: string) => unknown } }
  }
  const sync = mod.sync ?? mod.default?.sync
  if (!sync?.parseICS) throw new Error('node-ical failed to load')
  const parsed = sync.parseICS(body) as Record<string, IcalEvent>

  const meetings: NormalisedMeeting[] = []
  let totalEvents = 0
  let expandedOccurrences = 0
  let skippedAllDayCount = 0
  let skippedSoloCount = 0
  let skippedCancelled = 0
  let truncated = false

  const push = (m: NormalisedMeeting | null, event: IcalEvent): void => {
    if (!m) return
    if (skipAllDay && isAllDay(event)) {
      skippedAllDayCount++
      return
    }
    if (skipSolo && m.kind === 'manual' && m.attendees.length === 0) {
      skippedSoloCount++
      return
    }
    if (meetings.length >= MAX_EVENTS) {
      truncated = true
      return
    }
    meetings.push(m)
  }

  for (const event of Object.values(parsed)) {
    if (event.type !== 'VEVENT') continue
    if (!event.start || !event.end) continue
    totalEvents++

    if (event.status === 'CANCELLED') {
      skippedCancelled++
      continue
    }

    const durationMs = event.end.getTime() - event.start.getTime()

    if (!event.rrule) {
      // Plain single event.
      if (event.start >= from && event.start <= to) {
        push(buildMeeting(event, event.start, event.end, options, ''), event)
      }
      continue
    }

    // --- Recurring series -------------------------------------------------
    // TRAP 2: overrides live in `recurrences`, and EXDATEs still come back
    // from rrule.between(), so both need filtering by hand.
    const overrides = event.recurrences ?? {}
    const overrideKeys = new Set(Object.keys(overrides).map((k) => k.slice(0, 10)))
    const cancelledKeys = new Set(Object.keys(event.exdate ?? {}).map((k) => k.slice(0, 10)))

    for (const occurrence of event.rrule.between(from, to, true)) {
      const key = dayKey(occurrence)

      // Deleted occurrence.
      if (cancelledKeys.has(key)) {
        skippedCancelled++
        continue
      }
      // Moved or edited occurrence: emit the override, not the original slot.
      if (overrideKeys.has(key)) continue

      expandedOccurrences++
      push(
        buildMeeting(
          event,
          occurrence,
          new Date(occurrence.getTime() + durationMs),
          options,
          `:${occurrence.toISOString()}`,
        ),
        event,
      )
      if (truncated) break
    }

    // Emit the overrides themselves.
    for (const override of Object.values(overrides)) {
      if (!override.start || !override.end) continue
      if (override.start < from || override.start > to) continue
      if (override.status === 'CANCELLED') {
        skippedCancelled++
        continue
      }
      expandedOccurrences++
      push(
        buildMeeting(
          { ...event, ...override },
          override.start,
          override.end,
          options,
          `:${override.start.toISOString()}`,
        ),
        event,
      )
    }
  }

  return {
    meetings,
    totalEvents,
    expandedOccurrences,
    skippedAllDay: skippedAllDayCount,
    skippedSolo: skippedSoloCount,
    skippedCancelled,
    truncated,
  }
}

export type IcsFetchReason = 'invalid_url' | 'unreachable' | 'not_calendar' | 'too_large'

export class IcsFetchError extends Error {
  // Declared as a plain field rather than a constructor parameter property, so
  // the file also runs under Node's strip-only TypeScript mode.
  readonly reason: IcsFetchReason

  constructor(message: string, reason: IcsFetchReason) {
    super(message)
    this.name = 'IcsFetchError'
    this.reason = reason
  }
}

/**
 * Fetch a feed.
 *
 * The URL is user-supplied and fetched server-side, so this is an SSRF surface:
 * without checks, someone could point it at an internal address and use the app
 * as a proxy to read it. Only https, and only Google's calendar host.
 */
export async function fetchIcsFeed(url: string): Promise<string> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new IcsFetchError('That does not look like a URL.', 'invalid_url')
  }

  if (parsed.protocol !== 'https:') {
    throw new IcsFetchError('The calendar address must start with https://', 'invalid_url')
  }
  // Restricting the host is what makes the server-side fetch safe.
  if (parsed.hostname !== 'calendar.google.com') {
    throw new IcsFetchError(
      'Only Google Calendar secret addresses (calendar.google.com) are supported.',
      'invalid_url',
    )
  }

  let res: Response
  try {
    res = await fetch(parsed.toString(), {
      redirect: 'follow',
      headers: { accept: 'text/calendar' },
      signal: AbortSignal.timeout(20_000),
    })
  } catch {
    throw new IcsFetchError('Could not reach that calendar address.', 'unreachable')
  }

  if (!res.ok) {
    throw new IcsFetchError(
      res.status === 404
        ? 'Google did not recognise that address. Check it was copied in full.'
        : `Calendar feed returned ${res.status}.`,
      'unreachable',
    )
  }

  const size = Number(res.headers.get('content-length') ?? 0)
  if (size > MAX_FEED_BYTES) {
    throw new IcsFetchError('That calendar feed is too large to import.', 'too_large')
  }

  const body = await res.text()
  if (body.length > MAX_FEED_BYTES) {
    throw new IcsFetchError('That calendar feed is too large to import.', 'too_large')
  }
  if (!body.includes('BEGIN:VCALENDAR')) {
    throw new IcsFetchError(
      'That address did not return a calendar. Copy the "Secret address in iCal format".',
      'not_calendar',
    )
  }
  return body
}

/** Redact the secret token so a feed URL can be shown or logged safely. */
export function maskIcsUrl(url: string): string {
  try {
    const parsed = new URL(url)
    // .../calendar/ical/<address>/private-<secret>/basic.ics
    return `${parsed.origin}${parsed.pathname.replace(/private-[^/]+/, 'private-•••••')}`
  } catch {
    return 'the saved address'
  }
}
