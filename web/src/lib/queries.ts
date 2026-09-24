/**
 * Data access.
 *
 * EVERY function here takes ownerEmail as its first argument and filters on it.
 * That is not a convention, it is the authorization boundary: Protoship admits
 * any Delivery Hero Okta account to this app, so an unscoped query is a data
 * leak. There is deliberately no "get meeting by id" without an owner check.
 */

import { randomUUID } from 'node:crypto'
import { getDb } from './db'

const now = () => new Date().toISOString()

export interface Person {
  id: string
  name: string
  email: string | null
  role: string | null
  colorHex: string
  isMe: boolean
  /**
   * This person uses Fellow Hero themselves.
   *
   * There is no user table, so "registered" is inferred: they are registered
   * if their email matches an owner who has connected a Google Calendar, i.e.
   * a row in `google_connection`. Fellow scopes its @mention picker to people
   * who hold an account, and this is the closest honest substitute until
   * multi-user exists. See docs/15 A2.
   */
  isRegistered: boolean
}

export interface TalkingPoint {
  id: string
  text: string
  isCovered: boolean
  sortOrder: number
}

export interface ActionItem {
  id: string
  text: string
  isDone: boolean
  dueDate: string | null
  completedAt: string | null
  sortOrder: number
  assignee: Person | null
  meetingId: string | null
  meetingTitle: string | null
}

export interface Meeting {
  id: string
  title: string
  startAt: string
  endAt: string
  kind: 'oneOnOne' | 'team' | 'manual'
  notepad: string
  externalId: string | null
  /** The owner's own RSVP. 'declined' renders struck through, as Fellow does. */
  responseStatus: string | null
  isAllDay: boolean
  /** Manager-only notes. Empty string when never written. */
  privateNotes: string
  /** Google Meet or similar, for the header badge. */
  conferenceUrl: string | null
  location: string | null
  attendees: Person[]
}

export interface MeetingDetail extends Meeting {
  talkingPoints: TalkingPoint[]
  actionItems: ActionItem[]
}

interface PersonRow {
  is_registered?: number | null
  id: string
  name: string
  email: string | null
  role: string | null
  color_hex: string
  is_me: number
}

function toPerson(row: PersonRow): Person {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    colorHex: row.color_hex,
    isMe: !!row.is_me,
    // The owner is always "registered": they are using the app right now.
    isRegistered: !!row.is_registered || !!row.is_me,
  }
}

/**
 * SQL fragment marking a person as an app user.
 *
 * LOWER() on both sides because person.email is normalised on import but
 * owner_email comes straight from the Access token and is not.
 */
const REGISTERED_SELECT = `(
  SELECT COUNT(*) FROM google_connection gc
   WHERE LOWER(gc.owner_email) = LOWER(p.email)
) AS is_registered`

/* ----------------------------- people ----------------------------- */

export async function listPeople(ownerEmail: string): Promise<Person[]> {
  const db = await getDb()
  const rows = await db.query<PersonRow>(
    `SELECT p.id, p.name, p.email, p.role, p.color_hex, p.is_me,
            ${REGISTERED_SELECT}
       FROM person p
      WHERE owner_email = ? AND deleted_at IS NULL
      ORDER BY is_me DESC, name ASC`,
    [ownerEmail],
  )
  return rows.map(toPerson)
}

/* ---------------------------- meetings ---------------------------- */

/** Attendees returned per meeting in LIST views. The stack shows 3 plus a count. */
const ATTENDEE_PREVIEW_CAP = 4

async function attendeesFor(
  ownerEmail: string,
  meetingIds: string[],
): Promise<Map<string, Person[]>> {
  const out = new Map<string, Person[]>()
  if (!meetingIds.length) return out

  const db = await getDb()
  const placeholders = meetingIds.map(() => '?').join(',')
  // Cap per meeting. The agenda and week grid render an AvatarStack of at
  // most 3 plus a count, but this used to return EVERY attendee of every
  // meeting: 7.4k person objects and 928KB of JSON for a screen showing one
  // week. The cap is 4 so the stack still has its overflow item.
  const rows = await db.query<PersonRow & { meeting_id: string }>(
    `SELECT meeting_id, id, name, email, role, color_hex, is_me, is_registered
       FROM (
         SELECT ma.meeting_id, p.id, p.name, p.email, p.role, p.color_hex, p.is_me,
                ${REGISTERED_SELECT},
                ROW_NUMBER() OVER (PARTITION BY ma.meeting_id ORDER BY p.is_me DESC, p.name) AS rn
           FROM meeting_attendee ma
           JOIN person p ON p.id = ma.person_id
          WHERE ma.meeting_id IN (${placeholders}) AND p.owner_email = ?
       ) ranked
      WHERE rn <= ${ATTENDEE_PREVIEW_CAP}
      ORDER BY name`,
    [...meetingIds, ownerEmail],
  )
  for (const row of rows) {
    const list = out.get(row.meeting_id) ?? []
    list.push(toPerson(row))
    out.set(row.meeting_id, list)
  }
  return out
}

interface MeetingRow {
  id: string
  title: string
  start_at: string
  end_at: string
  kind: string
  notepad: string
  external_id: string | null
  response_status: string | null
  is_all_day: number | null
  conference_url: string | null
  location: string | null
  private_notes?: string | null
}

function toMeeting(row: MeetingRow, attendees: Person[]): Meeting {
  return {
    id: row.id,
    title: row.title,
    startAt: row.start_at,
    endAt: row.end_at,
    kind: (row.kind as Meeting['kind']) ?? 'manual',
    notepad: row.notepad ?? '',
    externalId: row.external_id,
    responseStatus: row.response_status ?? null,
    isAllDay: Boolean(row.is_all_day),
    privateNotes: row.private_notes ?? '',
    conferenceUrl: row.conference_url ?? null,
    location: row.location ?? null,
    attendees,
  }
}

/** Meetings within a window, oldest first. */
export async function listMeetings(
  ownerEmail: string,
  opts: { from?: string; to?: string; limit?: number } = {},
): Promise<Meeting[]> {
  const db = await getDb()
  const where = ['owner_email = ?', 'deleted_at IS NULL']
  const params: (string | number)[] = [ownerEmail]
  if (opts.from) {
    where.push('start_at >= ?')
    params.push(opts.from)
  }
  if (opts.to) {
    where.push('start_at < ?')
    params.push(opts.to)
  }
  // A LIMIT combined with ORDER BY start_at ASC silently returns the OLDEST
  // rows in the window. Widening the calendar to +/-3 months while this
  // defaulted to 500 meant the page received June to mid-September and
  // nothing after, so the current week rendered empty on a calendar holding
  // a thousand meetings. Default high enough that the window, not the limit,
  // decides what comes back.
  const limit = opts.limit ?? 5000
  params.push(limit)

  // No notepad. It is mediumtext, list views never render it, and at a
  // thousand meetings it is dead weight in the payload shipped to the
  // browser. getMeeting selects it for the one meeting being opened.
  const rows = await db.query<MeetingRow>(
    `SELECT id, title, start_at, end_at, kind, '' AS notepad, external_id,
            response_status, is_all_day, conference_url, location
       FROM meeting WHERE ${where.join(' AND ')}
      ORDER BY start_at ASC LIMIT ?`,
    params,
  )
  // Hitting the limit exactly almost certainly means rows were dropped, and
  // the symptom (an empty week) looks nothing like the cause. Say so.
  if (rows.length === limit) {
    console.warn(
      `[queries] listMeetings hit its limit of ${limit}; results are truncated ` +
        'to the OLDEST rows in the window and recent meetings may be missing.',
    )
  }

  const attendees = await attendeesFor(
    ownerEmail,
    rows.map((r) => r.id),
  )
  return rows.map((r) => toMeeting(r, attendees.get(r.id) ?? []))
}

/** One meeting with its full note. Returns null if it is not the caller's. */
export async function getMeeting(
  ownerEmail: string,
  meetingId: string,
): Promise<MeetingDetail | null> {
  const db = await getDb()
  const rows = await db.query<MeetingRow>(
    `SELECT id, title, start_at, end_at, kind, notepad, external_id,
            response_status, is_all_day, conference_url, location, private_notes
       FROM meeting WHERE id = ? AND owner_email = ? AND deleted_at IS NULL`,
    [meetingId, ownerEmail],
  )
  if (!rows.length) return null

  const attendees = await attendeesFor(ownerEmail, [meetingId])
  const meeting = toMeeting(rows[0], attendees.get(meetingId) ?? [])

  const tpRows = await db.query<{
    id: string
    text: string
    is_covered: number
    sort_order: number
  }>(
    `SELECT id, text, is_covered, sort_order FROM talking_point
      WHERE meeting_id = ? AND owner_email = ? AND deleted_at IS NULL
      ORDER BY sort_order ASC, created_at ASC`,
    [meetingId, ownerEmail],
  )

  const aiRows = await db.query<
    {
      id: string
      text: string
      is_done: number
      due_date: string | null
      completed_at: string | null
      sort_order: number
    } & Partial<PersonRow> & { assignee_id: string | null }
  >(
    `SELECT ai.id, ai.text, ai.is_done, ai.due_date, ai.completed_at, ai.sort_order,
            ai.assignee_id,
            p.id AS p_id, p.name, p.email, p.role, p.color_hex, p.is_me
       FROM action_item ai
       LEFT JOIN person p ON p.id = ai.assignee_id
      WHERE ai.meeting_id = ? AND ai.owner_email = ? AND ai.deleted_at IS NULL
      ORDER BY ai.sort_order ASC, ai.created_at ASC`,
    [meetingId, ownerEmail],
  )

  return {
    ...meeting,
    talkingPoints: tpRows.map((r) => ({
      id: r.id,
      text: r.text,
      isCovered: !!r.is_covered,
      sortOrder: r.sort_order,
    })),
    actionItems: aiRows.map((r) => ({
      id: r.id,
      text: r.text,
      isDone: !!r.is_done,
      dueDate: r.due_date,
      completedAt: r.completed_at,
      sortOrder: r.sort_order,
      assignee: r.assignee_id
        ? toPerson({
            id: r.assignee_id,
            name: r.name ?? 'Unknown',
            email: r.email ?? null,
            role: r.role ?? null,
            color_hex: r.color_hex ?? '#2563EB',
            is_me: r.is_me ?? 0,
          })
        : null,
      meetingId,
      meetingTitle: meeting.title,
    })),
  }
}

export async function createMeeting(
  ownerEmail: string,
  input: {
    title: string
    startAt: string
    endAt: string
    kind?: Meeting['kind']
    isAllDay?: boolean
    location?: string | null
    /** Person ids already in the owner's directory. */
    attendeeIds?: string[]
    /** Set when the event was also written to Google, so sync dedupes on it. */
    externalId?: string | null
  },
): Promise<string> {
  const db = await getDb()
  const id = randomUUID()
  const ts = now()
  await db.exec(
    `INSERT INTO meeting (id, owner_email, title, start_at, end_at, kind,
                          external_id, notepad, is_all_day, location,
                          created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, NULL)`,
    [
      id,
      ownerEmail,
      input.title,
      input.startAt,
      input.endAt,
      input.kind ?? 'manual',
      input.externalId ?? null,
      input.isAllDay ? 1 : 0,
      input.location ?? null,
      ts,
      ts,
    ],
  )

  for (const personId of input.attendeeIds ?? []) {
    // Ownership check per row: an id from the client must not attach a
    // stranger's person record to this meeting.
    const owned = await db.query<{ id: string }>(
      'SELECT id FROM person WHERE id = ? AND owner_email = ? AND deleted_at IS NULL',
      [personId, ownerEmail],
    )
    if (!owned.length) continue
    await db.exec('INSERT INTO meeting_attendee (meeting_id, person_id) VALUES (?, ?)', [
      id,
      personId,
    ])
  }

  return id
}

/**
 * Does this title name a 1:1? "Danya / Milena", "1:1 with Sam", "A <> B".
 *
 * Exported because BOTH renaming an existing meeting and creating a new one
 * have to agree: creation used to skip this and only count attendees, so a
 * meeting created as "Danya / Milena" came out as 'manual' while the same
 * title typed afterwards became 'oneOnOne'.
 */
export function titleLooksOneOnOne(title: string): boolean {
  const t = title.toLowerCase()
  return (
    /\b1[\s:._-]*(?:on|:|-)[\s._-]*1\b/.test(t) ||
    t.includes('<>') ||
    (title.split('/').length === 2 &&
      title.split('/').every((s) => s.trim().split(/\s+/).length <= 3 && s.trim().length > 0))
  )
}

export async function updateMeeting(
  ownerEmail: string,
  meetingId: string,
  fields: { title?: string; notepad?: string; privateNotes?: string },
): Promise<void> {
  const db = await getDb()
  const sets: string[] = []
  const params: (string | null)[] = []
  if (fields.title !== undefined) {
    sets.push('title = ?')
    params.push(fields.title)
  }
  if (fields.notepad !== undefined) {
    sets.push('notepad = ?')
    params.push(fields.notepad)
  }
  if (fields.privateNotes !== undefined) {
    sets.push('private_notes = ?')
    params.push(fields.privateNotes)
  }
  if (!sets.length) return
  sets.push('updated_at = ?')
  params.push(now(), meetingId, ownerEmail)
  await db.exec(
    `UPDATE meeting SET ${sets.join(', ')} WHERE id = ? AND owner_email = ?`,
    params,
  )
}

/**
 * Re-derive the kind of a hand-created meeting from its title.
 *
 * Calendar-sourced meetings are classified by attendee count, which is far more
 * reliable, so this only touches meetings with no external_id. Never downgrades
 * a meeting the user or the calendar already classified as a team meeting.
 */
export async function reclassifyManualMeeting(
  ownerEmail: string,
  meetingId: string,
  title: string,
): Promise<void> {
  const db = await getDb()
  const rows = await db.query<{ external_id: string | null; kind: string }>(
    'SELECT external_id, kind FROM meeting WHERE id = ? AND owner_email = ?',
    [meetingId, ownerEmail],
  )
  const row = rows[0]
  if (!row || row.external_id) return

  const next = titleLooksOneOnOne(title) ? 'oneOnOne' : 'manual'
  if (next === row.kind) return
  await db.exec('UPDATE meeting SET kind = ?, updated_at = ? WHERE id = ? AND owner_email = ?', [
    next,
    now(),
    meetingId,
    ownerEmail,
  ])
}

/* ------------------------- talking points ------------------------- */

export async function addTalkingPoint(
  ownerEmail: string,
  meetingId: string,
  text = '',
): Promise<string> {
  const db = await getDb()
  // Guard: never attach a child row to someone else's meeting.
  const owned = await db.query('SELECT id FROM meeting WHERE id = ? AND owner_email = ?', [
    meetingId,
    ownerEmail,
  ])
  if (!owned.length) throw Object.assign(new Error('Not found'), { status: 404 })

  const maxRows = await db.query<{ m: number | null }>(
    'SELECT MAX(sort_order) AS m FROM talking_point WHERE meeting_id = ?',
    [meetingId],
  )
  const id = randomUUID()
  const ts = now()
  await db.exec(
    `INSERT INTO talking_point (id, owner_email, meeting_id, text, is_covered,
                                sort_order, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, 0, ?, ?, ?, NULL)`,
    [id, ownerEmail, meetingId, text, (maxRows[0]?.m ?? -1) + 1, ts, ts],
  )
  return id
}

export async function updateTalkingPoint(
  ownerEmail: string,
  id: string,
  fields: { text?: string; isCovered?: boolean },
): Promise<void> {
  const db = await getDb()
  const sets: string[] = []
  const params: (string | number)[] = []
  if (fields.text !== undefined) {
    sets.push('text = ?')
    params.push(fields.text)
  }
  if (fields.isCovered !== undefined) {
    sets.push('is_covered = ?')
    params.push(fields.isCovered ? 1 : 0)
  }
  if (!sets.length) return
  sets.push('updated_at = ?')
  params.push(now(), id, ownerEmail)
  await db.exec(
    `UPDATE talking_point SET ${sets.join(', ')} WHERE id = ? AND owner_email = ?`,
    params,
  )
}

export async function deleteTalkingPoint(ownerEmail: string, id: string): Promise<void> {
  const db = await getDb()
  await db.exec(
    'UPDATE talking_point SET deleted_at = ?, updated_at = ? WHERE id = ? AND owner_email = ?',
    [now(), now(), id, ownerEmail],
  )
}

/* --------------------------- action items -------------------------- */

export async function addActionItem(
  ownerEmail: string,
  meetingId: string | null,
  text = '',
): Promise<string> {
  const db = await getDb()
  if (meetingId) {
    const owned = await db.query('SELECT id FROM meeting WHERE id = ? AND owner_email = ?', [
      meetingId,
      ownerEmail,
    ])
    if (!owned.length) throw Object.assign(new Error('Not found'), { status: 404 })
  }

  // `meeting_id IS ?` would be shorter, but that is SQLite-only: MySQL accepts
  // IS only with NULL/TRUE/FALSE/UNKNOWN, never a bound parameter, so it is a
  // syntax error in production while passing every test on SQLite. Branch
  // instead, because meeting_id is nullable for standalone action items and
  // `= ?` never matches NULL.
  const maxRows = await db.query<{ m: number | null }>(
    meetingId === null
      ? 'SELECT MAX(sort_order) AS m FROM action_item WHERE owner_email = ? AND meeting_id IS NULL'
      : 'SELECT MAX(sort_order) AS m FROM action_item WHERE owner_email = ? AND meeting_id = ?',
    meetingId === null ? [ownerEmail] : [ownerEmail, meetingId],
  )
  const id = randomUUID()
  const ts = now()
  await db.exec(
    `INSERT INTO action_item (id, owner_email, meeting_id, assignee_id, text, is_done,
                              due_date, completed_at, sort_order, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, NULL, ?, 0, NULL, NULL, ?, ?, ?, NULL)`,
    [id, ownerEmail, meetingId, text, (maxRows[0]?.m ?? -1) + 1, ts, ts],
  )
  return id
}

export async function updateActionItem(
  ownerEmail: string,
  id: string,
  fields: {
    text?: string
    isDone?: boolean
    dueDate?: string | null
    assigneeId?: string | null
  },
): Promise<void> {
  const db = await getDb()
  const sets: string[] = []
  const params: (string | number | null)[] = []

  if (fields.text !== undefined) {
    sets.push('text = ?')
    params.push(fields.text)
  }
  if (fields.isDone !== undefined) {
    sets.push('is_done = ?', 'completed_at = ?')
    // completedAt tracks the checkbox, as the Swift ActionItemRow did.
    params.push(fields.isDone ? 1 : 0, fields.isDone ? now() : null)
  }
  if (fields.dueDate !== undefined) {
    sets.push('due_date = ?')
    params.push(fields.dueDate)
  }
  if (fields.assigneeId !== undefined) {
    if (fields.assigneeId) {
      // Never assign to a person belonging to another owner.
      const ok = await db.query('SELECT id FROM person WHERE id = ? AND owner_email = ?', [
        fields.assigneeId,
        ownerEmail,
      ])
      if (!ok.length) throw Object.assign(new Error('Unknown assignee'), { status: 400 })
    }
    sets.push('assignee_id = ?')
    params.push(fields.assigneeId)
  }

  if (!sets.length) return
  sets.push('updated_at = ?')
  params.push(now(), id, ownerEmail)
  await db.exec(
    `UPDATE action_item SET ${sets.join(', ')} WHERE id = ? AND owner_email = ?`,
    params,
  )
}

export async function deleteActionItem(ownerEmail: string, id: string): Promise<void> {
  const db = await getDb()
  await db.exec(
    'UPDATE action_item SET deleted_at = ?, updated_at = ? WHERE id = ? AND owner_email = ?',
    [now(), now(), id, ownerEmail],
  )
}

/**
 * The unified to-do list: every open action item across all meetings, with the
 * back-link to its source. This is must-have #3 from the product brief.
 */
export async function listAllActionItems(
  ownerEmail: string,
  opts: { includeDone?: boolean } = {},
): Promise<ActionItem[]> {
  const db = await getDb()
  const rows = await db.query<{
    id: string
    text: string
    is_done: number
    due_date: string | null
    completed_at: string | null
    sort_order: number
    assignee_id: string | null
    meeting_id: string | null
    meeting_title: string | null
    p_name: string | null
    p_email: string | null
    p_role: string | null
    p_color: string | null
    p_is_me: number | null
  }>(
    `SELECT ai.id, ai.text, ai.is_done, ai.due_date, ai.completed_at, ai.sort_order,
            ai.assignee_id, ai.meeting_id,
            m.title AS meeting_title,
            p.name AS p_name, p.email AS p_email, p.role AS p_role,
            p.color_hex AS p_color, p.is_me AS p_is_me
       FROM action_item ai
       LEFT JOIN meeting m ON m.id = ai.meeting_id AND m.deleted_at IS NULL
       LEFT JOIN person p ON p.id = ai.assignee_id
      WHERE ai.owner_email = ? AND ai.deleted_at IS NULL
        ${opts.includeDone ? '' : 'AND ai.is_done = 0'}
      ORDER BY ai.due_date IS NULL, ai.due_date ASC, ai.created_at ASC`,
    [ownerEmail],
  )

  return rows.map((r) => ({
    id: r.id,
    text: r.text,
    isDone: !!r.is_done,
    dueDate: r.due_date,
    completedAt: r.completed_at,
    sortOrder: r.sort_order,
    assignee: r.assignee_id
      ? {
          id: r.assignee_id,
          name: r.p_name ?? 'Unknown',
          email: r.p_email,
          role: r.p_role,
          colorHex: r.p_color ?? '#2563EB',
          isMe: !!r.p_is_me,
          // Not surfaced in this projection; the assignee chip does not use
          // it, and the @mention pickers read from the attendee list instead.
          isRegistered: !!r.p_is_me,
        }
      : null,
    meetingId: r.meeting_id,
    meetingTitle: r.meeting_title,
  }))
}

/**
 * A person's 1:1 history.
 *
 * Derived from attendance rather than a stored stream. Models.swift had a
 * MeetingStream entity but no view ever read it - PersonStreamView recomputed
 * from attendees, so that is what is reproduced here.
 */
export async function getPersonStream(
  ownerEmail: string,
  personId: string,
): Promise<{ person: Person; meetings: Meeting[]; openItems: ActionItem[] } | null> {
  const db = await getDb()
  const personRows = await db.query<PersonRow>(
    `SELECT p.id, p.name, p.email, p.role, p.color_hex, p.is_me,
            ${REGISTERED_SELECT}
       FROM person p
      WHERE id = ? AND owner_email = ? AND deleted_at IS NULL`,
    [personId, ownerEmail],
  )
  if (!personRows.length) return null

  const meetingRows = await db.query<MeetingRow>(
    `SELECT m.id, m.title, m.start_at, m.end_at, m.kind, m.notepad, m.external_id
       FROM meeting m
       JOIN meeting_attendee ma ON ma.meeting_id = m.id
      WHERE ma.person_id = ? AND m.owner_email = ? AND m.deleted_at IS NULL
      ORDER BY m.start_at DESC LIMIT 100`,
    [personId, ownerEmail],
  )
  const attendees = await attendeesFor(
    ownerEmail,
    meetingRows.map((r) => r.id),
  )

  const all = await listAllActionItems(ownerEmail)
  return {
    person: toPerson(personRows[0]),
    meetings: meetingRows.map((r) => toMeeting(r, attendees.get(r.id) ?? [])),
    openItems: all.filter((i) => i.assignee?.id === personId),
  }
}

/* ----------------------------- search ----------------------------- */

export type SearchKind = 'meeting' | 'talkingPoint' | 'actionItem' | 'person'

export interface SearchHit {
  kind: SearchKind
  id: string
  /** Where clicking the hit goes. */
  href: string
  title: string
  /** Secondary line: the source meeting, a date, an email. */
  subtitle: string | null
  /** ISO timestamp used to order results; null sorts last. */
  at: string | null
}

/**
 * Escape a user's term for LIKE.
 *
 * Without this a search for "50%" matches everything and "a_b" matches "axb".
 * Backslash is the default LIKE escape in both MySQL and SQLite.
 */
function likeTerm(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
}

/**
 * Global search across everything the owner can see.
 *
 * Plain LIKE rather than FULLTEXT: at one manager's volume (hundreds of
 * meetings, thousands of rows) an index scan is instant, and FULLTEXT would
 * add a MySQL-only dependency plus stopword and minimum-length surprises.
 * Revisit if this ever feels slow.
 *
 * EVERY branch filters on owner_email. There is no unscoped read path.
 */
export async function searchAll(
  ownerEmail: string,
  rawTerm: string,
  limitPerKind = 6,
): Promise<SearchHit[]> {
  const term = rawTerm.trim()
  if (term.length < 2) return []

  const db = await getDb()
  const like = likeTerm(term)
  const hits: SearchHit[] = []

  const meetings = await db.query<{ id: string; title: string; start_at: string }>(
    `SELECT id, title, start_at FROM meeting
      WHERE owner_email = ? AND deleted_at IS NULL
        AND (title LIKE ? ESCAPE '\\\\' OR notepad LIKE ? ESCAPE '\\\\')
      ORDER BY start_at DESC LIMIT ?`,
    [ownerEmail, like, like, limitPerKind],
  )
  for (const m of meetings) {
    hits.push({
      kind: 'meeting',
      id: m.id,
      href: `/meetings/${m.id}`,
      title: m.title || 'Untitled',
      subtitle: new Date(m.start_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      at: m.start_at,
    })
  }

  const points = await db.query<{ id: string; text: string; meeting_id: string; title: string; start_at: string }>(
    `SELECT tp.id, tp.text, tp.meeting_id, m.title, m.start_at
       FROM talking_point tp
       JOIN meeting m ON m.id = tp.meeting_id
      WHERE tp.owner_email = ? AND tp.deleted_at IS NULL AND m.deleted_at IS NULL
        AND tp.text LIKE ? ESCAPE '\\\\' AND tp.text <> ''
      ORDER BY m.start_at DESC LIMIT ?`,
    [ownerEmail, like, limitPerKind],
  )
  for (const t of points) {
    hits.push({
      kind: 'talkingPoint',
      id: t.id,
      href: `/meetings/${t.meeting_id}`,
      title: t.text,
      subtitle: t.title,
      at: t.start_at,
    })
  }

  const items = await db.query<{
    id: string
    text: string
    meeting_id: string | null
    title: string | null
    due_date: string | null
    is_done: number
  }>(
    `SELECT ai.id, ai.text, ai.meeting_id, m.title, ai.due_date, ai.is_done
       FROM action_item ai
       LEFT JOIN meeting m ON m.id = ai.meeting_id AND m.deleted_at IS NULL
      WHERE ai.owner_email = ? AND ai.deleted_at IS NULL
        AND ai.text LIKE ? ESCAPE '\\\\' AND ai.text <> ''
      ORDER BY ai.is_done ASC, ai.updated_at DESC LIMIT ?`,
    [ownerEmail, like, limitPerKind],
  )
  for (const a of items) {
    hits.push({
      kind: 'actionItem',
      id: a.id,
      // Standalone items have no meeting to open, so send those to the list.
      href: a.meeting_id ? `/meetings/${a.meeting_id}` : '/actions',
      title: a.text,
      subtitle: a.title ?? 'No meeting',
      at: a.due_date,
    })
  }

  const people = await db.query<PersonRow>(
    `SELECT p.id, p.name, p.email, p.role, p.color_hex, p.is_me,
            ${REGISTERED_SELECT}
       FROM person p
      WHERE owner_email = ? AND deleted_at IS NULL
        AND (name LIKE ? ESCAPE '\\\\' OR email LIKE ? ESCAPE '\\\\')
      ORDER BY is_me DESC, name ASC LIMIT ?`,
    [ownerEmail, like, like, limitPerKind],
  )
  for (const p of people) {
    hits.push({
      kind: 'person',
      id: p.id,
      href: `/people/${p.id}`,
      title: p.name,
      subtitle: p.email,
      at: null,
    })
  }

  return hits
}

/**
 * Unfinished action items from the LAST meeting with the same people.
 *
 * Fellow carries unfinished items into the next meeting of a series so
 * follow-ups are not dropped; docs/04 lists it as a v1 acceptance criterion
 * and it was the last one outstanding.
 *
 * Deliberately returns the existing rows rather than copying them. Copying
 * would create a second id for the same task and break "check it once,
 * checked everywhere", which is the whole point of must-have #3.
 *
 * "The same series" is approximated by shared attendees, exactly as
 * getPersonStream approximates a person's history from attendance. A stored
 * series id would be better and does not exist.
 */
export async function carriedForwardFor(
  ownerEmail: string,
  meetingId: string,
): Promise<{ items: ActionItem[]; fromMeetingId: string; fromTitle: string } | null> {
  const db = await getDb()

  const current = await db.query<{ start_at: string }>(
    'SELECT start_at FROM meeting WHERE id = ? AND owner_email = ? AND deleted_at IS NULL',
    [meetingId, ownerEmail],
  )
  if (!current.length) return null

  const attendees = await db.query<{ person_id: string }>(
    'SELECT person_id FROM meeting_attendee WHERE meeting_id = ?',
    [meetingId],
  )
  if (!attendees.length) return null
  const ids = attendees.map((a) => a.person_id)

  // The most recent earlier meeting sharing at least one attendee.
  const placeholders = ids.map(() => '?').join(',')
  const prior = await db.query<{ id: string; title: string }>(
    `SELECT m.id, m.title
       FROM meeting m
       JOIN meeting_attendee ma ON ma.meeting_id = m.id
      WHERE m.owner_email = ? AND m.deleted_at IS NULL
        AND m.id <> ? AND m.start_at < ?
        AND ma.person_id IN (${placeholders})
      GROUP BY m.id, m.title, m.start_at
      ORDER BY m.start_at DESC
      LIMIT 1`,
    [ownerEmail, meetingId, current[0].start_at, ...ids],
  )
  if (!prior.length) return null

  // Reuse getMeeting so the ActionItem shape (assignee, back-link) matches
  // exactly what the note already renders.
  const priorDetail = await getMeeting(ownerEmail, prior[0].id)
  if (!priorDetail) return null
  const items = priorDetail.actionItems.filter((i) => !i.isDone && i.text.trim() !== '')
  if (!items.length) return null

  return { items, fromMeetingId: prior[0].id, fromTitle: prior[0].title }
}

/**
 * Soft-delete a meeting and everything written inside it.
 *
 * There was no delete path at all, so a mistyped "New meeting" was permanent.
 * Soft, like every other delete here: `deleted_at` is set and reads filter on
 * it, so a wrong click is recoverable in the database.
 *
 * Returns the external id when the meeting came from (or was pushed to)
 * Google, so the caller can offer to remove it there too.
 */
export async function deleteMeeting(
  ownerEmail: string,
  meetingId: string,
): Promise<{ externalId: string | null } | null> {
  const db = await getDb()
  const rows = await db.query<{ external_id: string | null }>(
    'SELECT external_id FROM meeting WHERE id = ? AND owner_email = ? AND deleted_at IS NULL',
    [meetingId, ownerEmail],
  )
  if (!rows.length) return null

  const ts = now()
  await db.exec('UPDATE meeting SET deleted_at = ?, updated_at = ? WHERE id = ? AND owner_email = ?', [
    ts,
    ts,
    meetingId,
    ownerEmail,
  ])
  // Notes written in the meeting go with it, so the unified list does not keep
  // showing action items whose meeting no longer exists.
  await db.exec(
    'UPDATE talking_point SET deleted_at = ?, updated_at = ? WHERE meeting_id = ? AND owner_email = ?',
    [ts, ts, meetingId, ownerEmail],
  )
  await db.exec(
    'UPDATE action_item SET deleted_at = ?, updated_at = ? WHERE meeting_id = ? AND owner_email = ?',
    [ts, ts, meetingId, ownerEmail],
  )

  return { externalId: rows[0].external_id }
}

/** Change a meeting's time. Separate from updateMeeting, which owns text. */
export async function updateMeetingTime(
  ownerEmail: string,
  meetingId: string,
  startAt: string,
  endAt: string,
): Promise<void> {
  const db = await getDb()
  await db.exec(
    'UPDATE meeting SET start_at = ?, end_at = ?, updated_at = ? WHERE id = ? AND owner_email = ?',
    [startAt, endAt, now(), meetingId, ownerEmail],
  )
}

export interface PersonWithStats extends Person {
  /** How many 1:1s (two-person meetings) you have had with them. */
  oneOnOneCount: number
  /** Total meetings shared. */
  meetingCount: number
  /** Most recent shared meeting, ISO. */
  lastMetAt: string | null
}

/**
 * People worth a row on the People page.
 *
 * `listPeople` returns EVERY attendee ever synced, which on a real calendar is
 * hundreds of names sorted alphabetically: the page opened on "Abdalla Chair"
 * and buried the handful of people the user actually has 1:1s with. Fellow's
 * People tab is about relationships, not an address book.
 *
 * Ranked by 1:1 count, then recency. `minMeetings` drops one-off invitees
 * from a single all-hands.
 */
export async function listPeopleWithStats(
  ownerEmail: string,
  opts: { minMeetings?: number } = {},
): Promise<PersonWithStats[]> {
  const db = await getDb()
  const minMeetings = opts.minMeetings ?? 1

  // AGGREGATE FIRST, THEN JOIN. The obvious shape - join person into the
  // group and GROUP BY every selected column - measured **763ms** on 580
  // people and 7.4k attendee rows, because `name` and `role` are TEXT and
  // grouping on TEXT forces an expensive temporary table. Grouping only by
  // person_id in a derived table and joining the person afterwards measured
  // **8ms** on the same data. Same result, ~95x faster; do not "simplify"
  // this back into one flat query.
  //
  // is_registered is a separate small lookup for the same reason: as a
  // correlated LOWER() subquery it ran once per output row.
  const rows = await db.query<
    PersonRow & { one_on_one_count: number; meeting_count: number; last_met_at: string | null }
  >(
    `SELECT p.id, p.name, p.email, p.role, p.color_hex, p.is_me,
            0 AS is_registered,
            s.one_on_one_count, s.meeting_count, s.last_met_at
       FROM (
         SELECT ma.person_id,
                SUM(CASE WHEN m.kind = 'oneOnOne' THEN 1 ELSE 0 END) AS one_on_one_count,
                COUNT(m.id) AS meeting_count,
                MAX(m.start_at) AS last_met_at
           FROM meeting_attendee ma
           JOIN meeting m ON m.id = ma.meeting_id AND m.deleted_at IS NULL
          WHERE m.owner_email = ?
          GROUP BY ma.person_id
         HAVING COUNT(m.id) >= ?
       ) s
       JOIN person p ON p.id = s.person_id
      WHERE p.owner_email = ? AND p.deleted_at IS NULL AND p.is_me = 0
      ORDER BY s.one_on_one_count DESC, s.last_met_at DESC, p.name ASC`,
    [ownerEmail, minMeetings, ownerEmail],
  )

  // One lookup for the whole page rather than a subquery per row.
  const connected = await db.query<{ owner_email: string }>(
    'SELECT owner_email FROM google_connection',
  )
  const registered = new Set(connected.map((c) => c.owner_email.toLowerCase()))

  return rows.map((r) => ({
    ...toPerson(r),
    isRegistered: registered.has((r.email ?? '').toLowerCase()),
    oneOnOneCount: Number(r.one_on_one_count ?? 0),
    meetingCount: Number(r.meeting_count ?? 0),
    lastMetAt: r.last_met_at,
  }))
}

/**
 * Persist a new order for the rows inside one meeting.
 *
 * `sort_order` has existed since the first schema and every read already
 * sorts by it, but nothing ever wrote a new value: rows kept their creation
 * order forever. Fellow lets you drag an agenda into the order you want to
 * discuss it, which is most of the point of writing one.
 *
 * Ids are re-checked against the owner and the meeting rather than trusted:
 * they arrive from the browser, and a foreign id here would renumber someone
 * else's rows.
 */
async function reorderRows(
  table: 'talking_point' | 'action_item',
  ownerEmail: string,
  meetingId: string,
  orderedIds: string[],
): Promise<void> {
  if (!orderedIds.length) return
  const db = await getDb()

  const placeholders = orderedIds.map(() => '?').join(',')
  const owned = await db.query<{ id: string }>(
    `SELECT id FROM ${table}
      WHERE id IN (${placeholders}) AND owner_email = ? AND meeting_id = ? AND deleted_at IS NULL`,
    [...orderedIds, ownerEmail, meetingId],
  )
  const allowed = new Set(owned.map((r) => r.id))

  const ts = now()
  let position = 0
  for (const id of orderedIds) {
    if (!allowed.has(id)) continue
    await db.exec(
      `UPDATE ${table} SET sort_order = ?, updated_at = ? WHERE id = ? AND owner_email = ?`,
      [position, ts, id, ownerEmail],
    )
    position += 1
  }
}

export function reorderTalkingPoints(
  ownerEmail: string,
  meetingId: string,
  orderedIds: string[],
): Promise<void> {
  return reorderRows('talking_point', ownerEmail, meetingId, orderedIds)
}

export function reorderActionItems(
  ownerEmail: string,
  meetingId: string,
  orderedIds: string[],
): Promise<void> {
  return reorderRows('action_item', ownerEmail, meetingId, orderedIds)
}

/**
 * Oldest and newest meeting the owner has.
 *
 * The archive's infinite scroll needs to know where to stop. Without it the
 * sentinels keep firing against empty months, re-requesting nothing forever.
 */
export async function meetingDateBounds(
  ownerEmail: string,
): Promise<{ earliest: string | null; latest: string | null }> {
  const db = await getDb()
  const rows = await db.query<{ earliest: string | null; latest: string | null }>(
    `SELECT MIN(start_at) AS earliest, MAX(start_at) AS latest
       FROM meeting WHERE owner_email = ? AND deleted_at IS NULL`,
    [ownerEmail],
  )
  return { earliest: rows[0]?.earliest ?? null, latest: rows[0]?.latest ?? null }
}

/* --------------------------- push notifications --------------------------- */

export interface PushSubscriptionRecord {
  id: string
  ownerEmail: string
  endpoint: string
  p256dh: string
  authSecret: string
}

/**
 * Store a browser's push subscription.
 *
 * Keyed on the endpoint, which is the browser's own unique handle, so
 * re-subscribing from the same browser updates rather than piling up rows.
 */
export async function savePushSubscription(
  ownerEmail: string,
  sub: { endpoint: string; p256dh: string; authSecret: string },
): Promise<void> {
  const db = await getDb()
  const ts = now()
  const existing = await db.query<{ id: string }>(
    'SELECT id FROM push_subscription WHERE endpoint = ?',
    [sub.endpoint],
  )
  if (existing.length) {
    await db.exec(
      `UPDATE push_subscription SET owner_email = ?, p256dh = ?, auth_secret = ?, updated_at = ?
        WHERE endpoint = ?`,
      [ownerEmail, sub.p256dh, sub.authSecret, ts, sub.endpoint],
    )
    return
  }
  await db.exec(
    `INSERT INTO push_subscription (id, owner_email, endpoint, p256dh, auth_secret, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [randomUUID(), ownerEmail, sub.endpoint, sub.p256dh, sub.authSecret, ts, ts],
  )
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  const db = await getDb()
  await db.exec('DELETE FROM push_subscription WHERE endpoint = ?', [endpoint])
}

export async function listPushSubscriptions(
  ownerEmail: string,
): Promise<PushSubscriptionRecord[]> {
  const db = await getDb()
  const rows = await db.query<{
    id: string
    owner_email: string
    endpoint: string
    p256dh: string
    auth_secret: string
  }>(
    'SELECT id, owner_email, endpoint, p256dh, auth_secret FROM push_subscription WHERE owner_email = ?',
    [ownerEmail],
  )
  return rows.map((r) => ({
    id: r.id,
    ownerEmail: r.owner_email,
    endpoint: r.endpoint,
    p256dh: r.p256dh,
    authSecret: r.auth_secret,
  }))
}

export interface DueReminderRow {
  meetingId: string
  ownerEmail: string
  title: string
  startAt: string
}

/**
 * Meetings starting inside the lead window that nobody has been told about.
 *
 * Crosses owners on purpose: this runs from the scheduler, not from a
 * request, so there is no "current user". Every row carries its owner and
 * the sender only ever pushes to that owner's own subscriptions.
 */
export async function dueRemindersToSend(
  leadMs: number,
  graceMs: number,
): Promise<DueReminderRow[]> {
  const db = await getDb()
  const nowMs = Date.now()
  const windowEnd = new Date(nowMs + leadMs).toISOString()
  const windowStart = new Date(nowMs - graceMs).toISOString()

  const rows = await db.query<{
    id: string
    owner_email: string
    title: string
    start_at: string
  }>(
    `SELECT m.id, m.owner_email, m.title, m.start_at
       FROM meeting m
       JOIN push_subscription ps ON ps.owner_email = m.owner_email
      WHERE m.deleted_at IS NULL
        AND m.is_all_day = 0
        AND m.start_at <= ? AND m.start_at > ?
        AND NOT EXISTS (
          SELECT 1 FROM reminder_sent rs
           WHERE rs.meeting_id = m.id AND rs.owner_email = m.owner_email
        )
      GROUP BY m.id, m.owner_email, m.title, m.start_at`,
    [windowEnd, windowStart],
  )
  return rows.map((r) => ({
    meetingId: r.id,
    ownerEmail: r.owner_email,
    title: r.title,
    startAt: r.start_at,
  }))
}

/**
 * Claim a reminder before sending it.
 *
 * Returns false when another attempt already claimed it. The primary key
 * does the work, so this is safe even if the app ever runs more than one
 * replica: the loser of the race simply does not send.
 */
export async function claimReminder(meetingId: string, ownerEmail: string): Promise<boolean> {
  const db = await getDb()
  try {
    await db.exec(
      'INSERT INTO reminder_sent (meeting_id, owner_email, sent_at) VALUES (?, ?, ?)',
      [meetingId, ownerEmail, now()],
    )
    return true
  } catch {
    // Duplicate key: someone else got there first.
    return false
  }
}
