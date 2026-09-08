/**
 * Google Calendar -> Fellow 2 meetings.
 *
 * Field shapes here were verified against the live Calendar API for Danya's
 * account (40 events, Sept 2026), not inferred from documentation.
 *
 * THE DEDUPE TRAP (this is the bug the Swift app had to fix - see
 * CalendarService.swift:60-63). A recurring event exposes two ids:
 *
 *   id:               "11rgb55o1slibt0tjvea14rbip_20260901T080000Z"   <- instance
 *   recurringEventId: "11rgb55o1slibt0tjvea14rbip_R20260630T080000"   <- series
 *
 * In the sampled window, 28 recurring instances shared only 20 distinct series
 * ids. Keying on recurringEventId would silently collapse 8 separate weekly
 * occurrences into one row, destroying their individual notes. ALWAYS key on
 * `id`, which was unique across all 40 events.
 */

export interface GCalAttendee {
  email?: string
  displayName?: string
  responseStatus?: 'accepted' | 'declined' | 'tentative' | 'needsAction'
  organizer?: boolean
  /** True on the row representing the authenticated user. */
  self?: boolean
  /** Rooms and equipment. Never a person. */
  resource?: boolean
  optional?: boolean
}

export interface GCalEvent {
  id: string
  summary?: string
  description?: string
  location?: string
  status?: 'confirmed' | 'tentative' | 'cancelled'
  eventType?: string
  /** Present only on instances of a recurring series. NOT a dedupe key. */
  recurringEventId?: string
  conferenceUrl?: string
  htmlLink?: string
  attendees?: GCalAttendee[]
  organizer?: { email?: string; self?: boolean }
  creator?: { email?: string; self?: boolean }
  start?: { dateTime?: string; date?: string; timeZone?: string }
  end?: { dateTime?: string; date?: string; timeZone?: string }
}

export type MeetingKind = 'oneOnOne' | 'team' | 'manual'

export interface NormalisedPerson {
  email: string
  name: string
  /** Deterministic per-email tint, so a person keeps one colour everywhere. */
  colorHex: string
}

export interface NormalisedMeeting {
  externalId: string
  title: string
  startAt: string
  endAt: string
  kind: MeetingKind
  isAllDay: boolean
  conferenceUrl: string | null
  location: string | null
  attendees: NormalisedPerson[]
  /** The user's own RSVP, for filtering out declined meetings. */
  selfResponse: string | null
  organizerEmail: string | null
}

/**
 * Avatar palette from DesignSystem.swift. Assigned by hashing the email so a
 * person's colour is stable across sessions and devices, which the Swift app
 * only achieved by persisting colorHex on the Person row.
 */
const AVATAR_PALETTE = [
  '#2563EB',
  '#9333EA',
  '#F59E0B',
  '#22C55E',
  '#EF4444',
  '#0EA5A5',
] as const

export function colorForEmail(email: string): string {
  let hash = 0
  for (let i = 0; i < email.length; i++) {
    hash = (hash * 31 + email.charCodeAt(i)) >>> 0
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
}

/**
 * Best available display name. Google omits displayName for most DH colleagues,
 * so derive from the email local part: "daniil.zherenkov" -> "Daniil Zherenkov".
 */
export function nameForAttendee(a: GCalAttendee): string {
  if (a.displayName?.trim()) return a.displayName.trim()
  const local = (a.email ?? '').split('@')[0]
  if (!local) return 'Unknown'
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/** Real human participants: no rooms, no equipment. */
export function humanAttendees(event: GCalEvent): GCalAttendee[] {
  return (event.attendees ?? []).filter((a) => a.resource !== true && !!a.email)
}

/**
 * Classify a meeting.
 *
 * Attendee count beats title matching, which is what the Swift app and the
 * Fellow importer both had to fall back on. Verified on real data: this catches
 * "QS Data Science Vision/Strategy" (a genuine two-person meeting whose title
 * looks nothing like a 1:1) and correctly rejects "Lunch" and focus blocks,
 * which have no attendees at all.
 */
export function classifyKind(event: GCalEvent): MeetingKind {
  const people = humanAttendees(event)
  // Solo blocks (Lunch, Deep Work, focus time) are personal, not meetings.
  if (people.length <= 1) return 'manual'
  if (people.length === 2) return 'oneOnOne'
  return 'team'
}

/** Google gives all-day events a `date` instead of a `dateTime`. */
export function isAllDay(event: GCalEvent): boolean {
  return !!event.start?.date && !event.start?.dateTime
}

function toIso(slot: GCalEvent['start'], endOfDay = false): string | null {
  if (slot?.dateTime) return new Date(slot.dateTime).toISOString()
  if (slot?.date) {
    // All-day: anchor to local midnight so it lands on the right calendar day.
    const d = new Date(`${slot.date}T${endOfDay ? '23:59:59' : '00:00:00'}`)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  return null
}

export interface NormaliseOptions {
  /** Drop meetings the user declined. Default true - they are noise. */
  skipDeclined?: boolean
  /** Drop all-day events (holidays, OOO banners). Default true. */
  skipAllDay?: boolean
  /** Drop solo blocks with no other attendees. Default true. */
  skipSolo?: boolean
}

/**
 * Normalise one event. Returns null when the event should not become a meeting,
 * so callers can filter without duplicating the rules.
 */
export function normaliseEvent(
  event: GCalEvent,
  options: NormaliseOptions = {},
): NormalisedMeeting | null {
  const { skipDeclined = true, skipAllDay = true, skipSolo = true } = options

  if (event.status === 'cancelled') return null

  const startAt = toIso(event.start)
  const endAt = toIso(event.end, true)
  if (!startAt || !endAt) return null

  const allDay = isAllDay(event)
  if (allDay && skipAllDay) return null

  const people = humanAttendees(event)
  const self = people.find((a) => a.self === true)
  const selfResponse = self?.responseStatus ?? null
  if (skipDeclined && selfResponse === 'declined') return null

  const kind = classifyKind(event)
  if (skipSolo && kind === 'manual' && people.length <= 1) return null

  return {
    // Instance id, never recurringEventId. See the module comment.
    externalId: `gcal:${event.id}`,
    title: event.summary?.trim() || 'Untitled',
    startAt,
    endAt,
    kind,
    isAllDay: allDay,
    conferenceUrl: event.conferenceUrl ?? null,
    location: event.location ?? null,
    // Exclude the user from their own attendee list; the Swift assignee picker
    // showed "Me" separately and listed the others after it.
    attendees: people
      .filter((a) => a.self !== true)
      .map((a) => ({
        email: (a.email ?? '').toLowerCase(),
        name: nameForAttendee(a),
        colorHex: colorForEmail((a.email ?? '').toLowerCase()),
      })),
    selfResponse,
    organizerEmail: event.organizer?.email?.toLowerCase() ?? null,
  }
}

/** Normalise a page of events, dropping the ones that should not be meetings. */
export function normaliseEvents(
  events: GCalEvent[],
  options: NormaliseOptions = {},
): NormalisedMeeting[] {
  const out: NormalisedMeeting[] = []
  const seen = new Set<string>()
  for (const ev of events) {
    const m = normaliseEvent(ev, options)
    if (!m) continue
    // Defensive: the API returned unique instance ids across every sampled
    // window, but a duplicate here would silently overwrite a note.
    if (seen.has(m.externalId)) continue
    seen.add(m.externalId)
    out.push(m)
  }
  return out
}
