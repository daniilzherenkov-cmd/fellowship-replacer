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
  attendees: Person[]
}

export interface MeetingDetail extends Meeting {
  talkingPoints: TalkingPoint[]
  actionItems: ActionItem[]
}

interface PersonRow {
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
  }
}

/* ----------------------------- people ----------------------------- */

export async function listPeople(ownerEmail: string): Promise<Person[]> {
  const db = await getDb()
  const rows = await db.query<PersonRow>(
    `SELECT id, name, email, role, color_hex, is_me FROM person
      WHERE owner_email = ? AND deleted_at IS NULL
      ORDER BY is_me DESC, name ASC`,
    [ownerEmail],
  )
  return rows.map(toPerson)
}

/* ---------------------------- meetings ---------------------------- */

async function attendeesFor(
  ownerEmail: string,
  meetingIds: string[],
): Promise<Map<string, Person[]>> {
  const out = new Map<string, Person[]>()
  if (!meetingIds.length) return out

  const db = await getDb()
  const placeholders = meetingIds.map(() => '?').join(',')
  const rows = await db.query<PersonRow & { meeting_id: string }>(
    `SELECT ma.meeting_id, p.id, p.name, p.email, p.role, p.color_hex, p.is_me
       FROM meeting_attendee ma
       JOIN person p ON p.id = ma.person_id
      WHERE ma.meeting_id IN (${placeholders}) AND p.owner_email = ?
      ORDER BY p.name`,
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
  params.push(opts.limit ?? 500)

  const rows = await db.query<MeetingRow>(
    `SELECT id, title, start_at, end_at, kind, notepad, external_id
       FROM meeting WHERE ${where.join(' AND ')}
      ORDER BY start_at ASC LIMIT ?`,
    params,
  )
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
    `SELECT id, title, start_at, end_at, kind, notepad, external_id
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
  input: { title: string; startAt: string; endAt: string; kind?: Meeting['kind'] },
): Promise<string> {
  const db = await getDb()
  const id = randomUUID()
  const ts = now()
  await db.exec(
    `INSERT INTO meeting (id, owner_email, title, start_at, end_at, kind,
                          external_id, notepad, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, '', ?, ?, NULL)`,
    [id, ownerEmail, input.title, input.startAt, input.endAt, input.kind ?? 'manual', ts, ts],
  )
  return id
}

export async function updateMeeting(
  ownerEmail: string,
  meetingId: string,
  fields: { title?: string; notepad?: string },
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

  const t = title.toLowerCase()
  const looksOneOnOne =
    /\b1[\s:._-]*(?:on|:|-)[\s._-]*1\b/.test(t) ||
    t.includes('<>') ||
    (title.split('/').length === 2 &&
      title.split('/').every((s) => s.trim().split(/\s+/).length <= 3 && s.trim().length > 0))

  const next = looksOneOnOne ? 'oneOnOne' : 'manual'
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

  const maxRows = await db.query<{ m: number | null }>(
    'SELECT MAX(sort_order) AS m FROM action_item WHERE owner_email = ? AND meeting_id IS ?',
    [ownerEmail, meetingId],
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
    `SELECT id, name, email, role, color_hex, is_me FROM person
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
