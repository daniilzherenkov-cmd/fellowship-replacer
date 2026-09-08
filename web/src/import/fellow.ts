/**
 * Fellow export -> Fellow 2.
 *
 * Written against a REAL export (~/Downloads/exports/1411719/export.json,
 * 1.6 MB, 875 notes), not the documentation, because Fellow's help centre only
 * says the export contains "everything" without itemising it.
 *
 * What the export actually contains:
 *   { user_information, feedback[], calendars[], notes[], attachments[], objectives[] }
 *   note = { id, title, content, start, end }   <- exactly five keys
 *   content = string[]                          <- FLAT, not structured
 *
 * What it does NOT contain, verified by scanning the whole file:
 *   - action item state: zero occurrences of assignee/due_date/completed/checked
 *   - attendees: zero occurrences of attendee/person/owner/avatar
 *   - any per-person 1:1 grouping
 *
 * Consequence: 865 of 875 notes are empty template scaffolding, and action
 * items cannot be recovered. We deliberately DO NOT synthesise action items
 * from the prose under "AI-Detected Action Items" - inventing unchecked to-dos
 * that were never real would hand the user a fake task list that looks
 * authoritative. Talking points and notepad text are recoverable; that is all.
 */

import { randomUUID } from 'node:crypto'

/** The three fixed section headers, as they appear in exported content lines. */
const SECTION_HEADERS = ['Talking Points', 'Action Items', 'Notepad'] as const
/** Fellow's AI section - prose, not structured items. */
const AI_SECTION = 'AI-Detected Action Items'

export interface FellowNote {
  id: string
  title: string
  content: string[] | string | null
  start: string | null
  end: string | null
}

export interface FellowExport {
  user_information?: { email?: string; full_name?: string }
  notes?: FellowNote[]
  calendars?: { name?: string; events?: FellowEvent[] }[]
}

export interface FellowEvent {
  guid?: string
  title?: string
  description?: string | null
  location?: string | null
  start?: string | null
  end?: string | null
}

export interface ImportedMeeting {
  id: string
  externalId: string
  title: string
  startAt: string
  endAt: string
  kind: 'oneOnOne' | 'team' | 'manual'
  notepad: string
  talkingPoints: string[]
  /** Prose captured from the AI section - appended to notepad, never made into tasks. */
  aiNotes: string[]
}

export interface ImportReport {
  totalNotes: number
  /** Meetings derived from notes (i.e. with real content). */
  imported: number
  skippedEmpty: number
  skippedUndated: number
  /** Always 0. Present so the report positively asserts nothing was invented. */
  actionItemsCreated: number
  /** Calendar events seen / imported / dropped, when includeCalendar is set. */
  totalEvents: number
  importedFromCalendar: number
  skippedUndatedEvents: number
  skippedDuplicateEvents: number
  meetings: ImportedMeeting[]
}

function lines(content: FellowNote['content']): string[] {
  if (Array.isArray(content)) return content
  if (typeof content === 'string') return content.split('\n')
  return []
}

function isSectionHeader(line: string): string | null {
  const trimmed = line.trim()
  for (const h of SECTION_HEADERS) {
    // Headers arrive as "Talking Points\nThe things to talk about" - the
    // subtitle is glued on with a newline inside the same array element.
    if (trimmed === h || trimmed.startsWith(`${h}\n`)) return h
  }
  if (trimmed === AI_SECTION || trimmed.startsWith(`${AI_SECTION}\n`)) return AI_SECTION
  return null
}

/**
 * Split a note's flat content into the three blocks.
 * Anything before the first recognised header is treated as notepad text.
 */
export function parseNoteContent(content: FellowNote['content']): {
  talkingPoints: string[]
  aiNotes: string[]
  notepad: string
} {
  const talkingPoints: string[] = []
  const aiNotes: string[] = []
  const notepadLines: string[] = []

  let section: string | null = null

  for (const raw of lines(content)) {
    const header = isSectionHeader(raw)
    if (header) {
      section = header
      continue
    }
    const text = raw.trim()
    if (!text) continue

    if (section === 'Talking Points') talkingPoints.push(text)
    else if (section === AI_SECTION) aiNotes.push(text)
    // 'Action Items' content is intentionally dropped as structured items and
    // preserved as text only (see the module comment).
    else if (section === 'Action Items') aiNotes.push(text)
    else notepadLines.push(text)
  }

  return { talkingPoints, aiNotes, notepad: notepadLines.join('\n') }
}

/** Heuristic 1:1 detection, ported from CalendarService.swift's approach. */
export function detectKind(title: string): 'oneOnOne' | 'team' | 'manual' {
  const t = title.toLowerCase()
  if (/\b1[\s:._-]*(?:on|:|-)[\s._-]*1\b/.test(t)) return 'oneOnOne'
  if (t.includes('<>')) return 'oneOnOne'
  // "Danya / Félix" - a slash between two short name-ish sides.
  const slash = title.split('/')
  if (slash.length === 2 && slash.every((s) => s.trim().split(/\s+/).length <= 3)) {
    return 'oneOnOne'
  }
  return 'manual'
}

export interface ImportOptions {
  /** Keep the ~865 empty template shells. Off by default: they are noise. */
  includeEmpty?: boolean
  /**
   * Also import `calendars[].events[]`. This is where the real history lives:
   * the sampled export has 2,354 events (2,205 properly dated, 1,700 in 2026,
   * 201 of them 1:1-shaped) against only 8 substantive notes.
   */
  includeCalendar?: boolean
  /** Drop events starting before this ISO date. Defaults to no lower bound. */
  since?: string
  /** Drop events starting after this ISO date. */
  until?: string
}

/** Fellow exports undated placeholder events stamped at the epoch-ish date. */
const PLACEHOLDER_DATE_PREFIX = '2000-01-01'

/**
 * Convert calendar events into meetings.
 *
 * Notes and events are merged on externalId, so an event that already has a
 * note attached does not produce a second, empty meeting. Note-derived
 * meetings win, since they carry content.
 */
export function matchKey(title: string, startIso: string): string {
  // Minute precision: Fellow stores note and event times from the same source,
  // so they agree exactly, but seconds/offset formatting can differ.
  return `${title.trim().toLowerCase()}|${startIso.slice(0, 16)}`
}

export function importCalendarEvents(
  events: FellowEvent[],
  taken: ReadonlySet<string>,
  options: ImportOptions = {},
  /**
   * title|start keys of meetings already created from notes. Needed because
   * Fellow's note ids and calendar guids are DIFFERENT identifier spaces
   * (verified: 0 of 875 note ids match any guid), so externalId alone cannot
   * detect that a note and an event describe the same meeting. Without this,
   * 8 of the 10 substantive notes in the sampled export duplicate - and those
   * are precisely the meetings that have content.
   */
  takenByTime: ReadonlySet<string> = new Set(),
): { meetings: ImportedMeeting[]; skippedUndated: number; skippedDuplicate: number } {
  const meetings: ImportedMeeting[] = []
  let skippedUndated = 0
  let skippedDuplicate = 0
  const seen = new Set<string>()

  for (const ev of events) {
    const start = ev.start ?? ''
    const end = ev.end ?? ''
    if (!start || !end || start.startsWith(PLACEHOLDER_DATE_PREFIX)) {
      skippedUndated++
      continue
    }
    if (options.since && start < options.since) continue
    if (options.until && start > options.until) continue

    // guid is Fellow's calendar event id. Namespaced separately from notes so
    // the two sources cannot collide on a shared identifier.
    const externalId = `gcal:${ev.guid ?? `${start}|${ev.title ?? ''}`}`
    if (taken.has(externalId) || seen.has(externalId)) {
      skippedDuplicate++
      continue
    }
    // A note already covers this meeting and carries the user's actual
    // content, so the bare calendar event would add nothing but a duplicate.
    if (takenByTime.has(matchKey(ev.title ?? '', start))) {
      skippedDuplicate++
      continue
    }
    seen.add(externalId)

    meetings.push({
      id: randomUUID(),
      externalId,
      title: ev.title || 'Untitled',
      startAt: start,
      endAt: end,
      kind: detectKind(ev.title || ''),
      // The invite body is context, not the user's own notes. Kept so the
      // meeting is not empty, clearly marked as imported.
      notepad: ev.description ? `> Imported from calendar invite:\n${ev.description}` : '',
      talkingPoints: [],
      aiNotes: [],
    })
  }

  return { meetings, skippedUndated, skippedDuplicate }
}

/**
 * Convert an export into meetings. Pure - performs no writes - so it can be
 * tested and dry-run before touching a database.
 */
export function importFellowExport(
  data: FellowExport,
  options: ImportOptions = {},
): ImportReport {
  const notes = data.notes ?? []
  const meetings: ImportedMeeting[] = []
  let skippedEmpty = 0
  let skippedUndated = 0

  for (const note of notes) {
    const { talkingPoints, aiNotes, notepad } = parseNoteContent(note.content)
    const hasContent = talkingPoints.length > 0 || aiNotes.length > 0 || notepad.length > 0

    if (!hasContent && !options.includeEmpty) {
      skippedEmpty++
      continue
    }
    if (!note.start || !note.end) {
      skippedUndated++
      continue
    }

    meetings.push({
      id: randomUUID(),
      // Namespaced so a later calendar sync cannot collide with an imported note.
      externalId: `fellow:${note.id}`,
      title: note.title || 'Untitled',
      startAt: note.start,
      endAt: note.end,
      kind: detectKind(note.title || ''),
      notepad: [notepad, aiNotes.length ? aiNotes.join('\n') : '']
        .filter(Boolean)
        .join('\n\n'),
      talkingPoints,
      aiNotes,
    })
  }

  const fromNotes = meetings.length
  const events = options.includeCalendar
    ? (data.calendars ?? []).flatMap((c) => c.events ?? [])
    : []

  let importedFromCalendar = 0
  let skippedUndatedEvents = 0
  let skippedDuplicateEvents = 0

  if (events.length) {
    const taken = new Set(meetings.map((m) => m.externalId))
    const takenByTime = new Set(meetings.map((m) => matchKey(m.title, m.startAt)))
    const cal = importCalendarEvents(events, taken, options, takenByTime)
    meetings.push(...cal.meetings)
    importedFromCalendar = cal.meetings.length
    skippedUndatedEvents = cal.skippedUndated
    skippedDuplicateEvents = cal.skippedDuplicate
  }

  // Newest first, matching the meetings archive's ordering.
  meetings.sort((a, b) => b.startAt.localeCompare(a.startAt))

  return {
    totalNotes: notes.length,
    imported: fromNotes,
    skippedEmpty,
    skippedUndated,
    actionItemsCreated: 0,
    totalEvents: events.length,
    importedFromCalendar,
    skippedUndatedEvents,
    skippedDuplicateEvents,
    meetings,
  }
}
