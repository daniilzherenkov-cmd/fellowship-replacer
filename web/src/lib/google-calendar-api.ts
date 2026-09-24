/**
 * Google Calendar API client.
 *
 * Response shapes verified against live API output for Danya's account (see
 * test/fixtures/gcal-real-window.json).
 *
 * Two API behaviours worth knowing, both of which bite silently:
 *
 * 1. `singleEvents=true` expands recurring series into individual instances.
 *    Without it you get the series master and a recurrence rule, and the app
 *    would show one row for a weekly meeting instead of one per week. It is
 *    also required for `orderBy=startTime`.
 *
 * 2. `syncToken` gives cheap incremental sync, but Google can expire it at any
 *    time (410 GONE), which REQUIRES a full resync. Treating 410 as a normal
 *    error leaves sync permanently broken.
 */

import type { GCalEvent } from './calendar'

const BASE = 'https://www.googleapis.com/calendar/v3'

export interface ListEventsParams {
  accessToken: string
  calendarId?: string
  timeMin?: string
  timeMax?: string
  syncToken?: string
  pageToken?: string
  maxResults?: number
}

export interface ListEventsResult {
  events: GCalEvent[]
  nextPageToken: string | null
  /** Present only on the final page. Store it to enable incremental sync. */
  nextSyncToken: string | null
  /** True when Google expired the sync token and a full resync is required. */
  syncTokenExpired: boolean
}

/**
 * Every call to Google gets a deadline.
 *
 * WHY: none of them had one. A hung request left the server action awaiting
 * forever, and the create-event dialog sat on "Saving…" with no error and no
 * way out - the exact failure Danya hit. fetch has no default timeout, so an
 * unresponsive upstream becomes an unresponsive app.
 */
const GOOGLE_TIMEOUT_MS = 15_000

export class GoogleApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'GoogleApiError'
  }
}

/**
 * What Google actually returns, as opposed to our normalised shape.
 *
 * These differ in a way that bit us: Google sends `hangoutLink` and
 * `conferenceData`, never a field called `conferenceUrl`. The response used
 * to be cast straight to GCalEvent[], which satisfied TypeScript while
 * `conferenceUrl` stayed undefined on every synced event forever. That is why
 * no meeting ever showed a Google Meet badge. A cast is not a parse.
 */
interface RawEvent extends Omit<GCalEvent, 'conferenceUrl'> {
  hangoutLink?: string
  conferenceData?: {
    entryPoints?: { uri?: string; entryPointType?: string }[]
  }
}

function toGCalEvent(raw: RawEvent): GCalEvent {
  const video = raw.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')
  return {
    ...raw,
    conferenceUrl: raw.hangoutLink ?? video?.uri ?? undefined,
  }
}

/**
 * One page of events.
 *
 * Note: when a syncToken is supplied, Google rejects timeMin/timeMax and
 * singleEvents changes - the token already encodes the original query. Sending
 * them together is a 400.
 */
export async function listEvents(params: ListEventsParams): Promise<ListEventsResult> {
  const {
    accessToken,
    calendarId = 'primary',
    timeMin,
    timeMax,
    syncToken,
    pageToken,
    maxResults = 250,
  } = params

  const url = new URL(`${BASE}/calendars/${encodeURIComponent(calendarId)}/events`)
  url.searchParams.set('maxResults', String(maxResults))
  // Expand recurrence into instances - see the module comment.
  url.searchParams.set('singleEvents', 'true')

  if (syncToken) {
    url.searchParams.set('syncToken', syncToken)
  } else {
    url.searchParams.set('orderBy', 'startTime')
    if (timeMin) url.searchParams.set('timeMin', timeMin)
    if (timeMax) url.searchParams.set('timeMax', timeMax)
  }
  if (pageToken) url.searchParams.set('pageToken', pageToken)

  const res = await fetch(url, {
    signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
    headers: { authorization: `Bearer ${accessToken}` },
  })

  if (res.status === 410) {
    // Sync token expired. Not a failure - a signal to start over.
    return { events: [], nextPageToken: null, nextSyncToken: null, syncTokenExpired: true }
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new GoogleApiError(
      `Calendar API ${res.status}: ${body.slice(0, 200)}`,
      res.status,
    )
  }

  const data = (await res.json()) as {
    items?: RawEvent[]
    nextPageToken?: string
    nextSyncToken?: string
  }

  return {
    events: (data.items ?? []).map(toGCalEvent),
    nextPageToken: data.nextPageToken ?? null,
    nextSyncToken: data.nextSyncToken ?? null,
    syncTokenExpired: false,
  }
}

export interface FetchAllResult {
  events: GCalEvent[]
  syncToken: string | null
  /** Set when a stale sync token forced a full refetch. */
  didFullResync: boolean
}

/**
 * Fetch every event across all pages, following pagination and recovering
 * automatically from an expired sync token.
 *
 * `maxPages` bounds the work: a first sync of a busy calendar can be thousands
 * of events, and this runs inside a request on a 200MB container.
 */
export async function fetchAllEvents(params: {
  accessToken: string
  calendarId?: string
  timeMin?: string
  timeMax?: string
  syncToken?: string
  maxPages?: number
}): Promise<FetchAllResult> {
  const { maxPages = 20, syncToken, ...rest } = params

  const collect = async (token?: string): Promise<FetchAllResult | 'expired'> => {
    const events: GCalEvent[] = []
    let pageToken: string | undefined
    let finalSyncToken: string | null = null

    for (let page = 0; page < maxPages; page++) {
      const res: ListEventsResult = await listEvents({
        ...rest,
        syncToken: token,
        pageToken,
      })
      if (res.syncTokenExpired) return 'expired'

      events.push(...res.events)
      finalSyncToken = res.nextSyncToken ?? finalSyncToken
      if (!res.nextPageToken) break
      pageToken = res.nextPageToken
    }

    return { events, syncToken: finalSyncToken, didFullResync: false }
  }

  const first = await collect(syncToken)
  if (first !== 'expired') return first

  // Token was stale: redo the query from scratch, without it.
  const full = await collect(undefined)
  if (full === 'expired') {
    throw new GoogleApiError('Sync token expired twice - aborting', 410)
  }
  return { ...full, didFullResync: true }
}

/**
 * Default sync window: the Swift app imported +/-3 months, which matched what
 * Milena was told in the onboarding message. Keep parity.
 */
export function defaultWindow(now = new Date()): { timeMin: string; timeMax: string } {
  const min = new Date(now)
  min.setMonth(min.getMonth() - 3)
  const max = new Date(now)
  max.setMonth(max.getMonth() + 3)
  return { timeMin: min.toISOString(), timeMax: max.toISOString() }
}

export interface CreateEventParams {
  accessToken: string
  calendarId?: string
  summary: string
  /** RFC3339 with offset, or a YYYY-MM-DD date when allDay. */
  start: string
  end: string
  allDay?: boolean
  location?: string | null
  description?: string | null
  attendeeEmails?: string[]
  timeZone?: string
}

export interface CreatedEvent {
  id: string
  htmlLink: string | null
  conferenceUrl: string | null
}

/**
 * Create an event on the user's calendar.
 *
 * The first thing in this app that WRITES to Google. docs/01 §5 cut calendar
 * write-back from v1; that was reversed on 2026-09-23. No new consent was
 * needed: the existing `calendar.events` scope already covers writes.
 *
 * `sendUpdates=all` so invitees are actually notified. Creating an event that
 * silently never reaches the other attendees would be worse than not offering
 * the feature.
 */
export async function createEvent(params: CreateEventParams): Promise<CreatedEvent> {
  const {
    accessToken,
    calendarId = 'primary',
    summary,
    start,
    end,
    allDay = false,
    location,
    description,
    attendeeEmails = [],
    timeZone,
  } = params

  const url = new URL(`${BASE}/calendars/${encodeURIComponent(calendarId)}/events`)
  // Notify invitees, matching what the Google UI does by default.
  url.searchParams.set('sendUpdates', 'all')

  const body: Record<string, unknown> = {
    summary,
    // All-day events use `date`; timed ones use `dateTime` plus a zone.
    start: allDay ? { date: start } : { dateTime: start, ...(timeZone ? { timeZone } : {}) },
    end: allDay ? { date: end } : { dateTime: end, ...(timeZone ? { timeZone } : {}) },
  }
  if (location) body.location = location
  if (description) body.description = description
  if (attendeeEmails.length) {
    body.attendees = attendeeEmails.map((email) => ({ email }))
  }

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new GoogleApiError(
      `Calendar create failed (${res.status}): ${text.slice(0, 300)}`,
      res.status,
    )
  }

  const json = (await res.json()) as {
    id?: string
    htmlLink?: string
    hangoutLink?: string
    conferenceData?: { entryPoints?: { uri?: string; entryPointType?: string }[] }
  }

  const entry = json.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')

  return {
    id: json.id ?? '',
    htmlLink: json.htmlLink ?? null,
    conferenceUrl: json.hangoutLink ?? entry?.uri ?? null,
  }
}

/**
 * Remove an event from the user's calendar.
 *
 * A 404 or 410 is treated as success: the event is already gone, which is the
 * state the caller wanted. Anything else is a real failure worth surfacing.
 */
export async function deleteEvent(params: {
  accessToken: string
  calendarId?: string
  eventId: string
}): Promise<void> {
  const { accessToken, calendarId = 'primary', eventId } = params
  const url = new URL(
    `${BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
  )
  url.searchParams.set('sendUpdates', 'all')

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
    method: 'DELETE',
    headers: { authorization: `Bearer ${accessToken}` },
  })

  if (res.ok || res.status === 404 || res.status === 410) return
  const text = await res.text().catch(() => '')
  throw new GoogleApiError(`Calendar delete failed (${res.status}): ${text.slice(0, 200)}`, res.status)
}
