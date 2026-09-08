/**
 * Calendar -> database sync.
 *
 * Idempotent by construction: meetings are keyed on (owner_email, external_id)
 * where external_id is the Google *instance* id. Re-running a sync updates
 * existing rows instead of duplicating them, which is what makes the "Sync"
 * button safe to press repeatedly.
 *
 * What sync must never do is clobber the user's own writing. A meeting's
 * notepad, talking points and action items belong to the user; only calendar
 * facts (title, time, attendees) are refreshed from Google.
 */

import { randomUUID } from 'node:crypto'
import { getDb } from './db'
import { normaliseEvents, type NormalisedMeeting, type NormalisedPerson } from './calendar'
import { fetchAllEvents, defaultWindow, GoogleApiError } from './google-calendar-api'
import { getAccessToken, getConnection, updateSyncState } from './google-store'

export interface SyncResult {
  created: number
  updated: number
  peopleCreated: number
  didFullResync: boolean
  error?: string
}

const now = () => new Date().toISOString()

/** Find-or-create a Person by email, scoped to the owner. */
async function upsertPerson(
  ownerEmail: string,
  person: NormalisedPerson,
): Promise<{ id: string; created: boolean }> {
  const db = await getDb()
  const existing = await db.query<{ id: string; name: string }>(
    'SELECT id, name FROM person WHERE owner_email = ? AND email = ? AND deleted_at IS NULL',
    [ownerEmail, person.email],
  )

  if (existing.length) {
    const row = existing[0]
    // Only fill in a better name; never overwrite one the user edited to
    // something shorter or more personal.
    if (person.name.length > row.name.length) {
      await db.exec('UPDATE person SET name = ?, updated_at = ? WHERE id = ?', [
        person.name,
        now(),
        row.id,
      ])
    }
    return { id: row.id, created: false }
  }

  const id = randomUUID()
  const ts = now()
  await db.exec(
    `INSERT INTO person (id, owner_email, name, email, role, color_hex, is_me,
                         created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, NULL, ?, 0, ?, ?, NULL)`,
    [id, ownerEmail, person.name, person.email, person.colorHex, ts, ts],
  )
  return { id, created: true }
}

/** Ensure the owner has a Person row, so "assign to me" works. */
export async function ensureSelfPerson(ownerEmail: string): Promise<string> {
  const db = await getDb()
  const existing = await db.query<{ id: string }>(
    'SELECT id FROM person WHERE owner_email = ? AND is_me = 1',
    [ownerEmail],
  )
  if (existing.length) return existing[0].id

  const id = randomUUID()
  const ts = now()
  const local = ownerEmail.split('@')[0]
  const name = local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
  await db.exec(
    `INSERT INTO person (id, owner_email, name, email, role, color_hex, is_me,
                         created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, NULL, '#2563EB', 1, ?, ?, NULL)`,
    [id, ownerEmail, name || ownerEmail, ownerEmail, ts, ts],
  )
  return id
}

async function upsertMeeting(
  ownerEmail: string,
  meeting: NormalisedMeeting,
): Promise<{ created: boolean; peopleCreated: number }> {
  const db = await getDb()
  const ts = now()
  let peopleCreated = 0

  const existing = await db.query<{ id: string }>(
    'SELECT id FROM meeting WHERE owner_email = ? AND external_id = ?',
    [ownerEmail, meeting.externalId],
  )

  let meetingId: string
  let created: boolean

  if (existing.length) {
    meetingId = existing[0].id
    created = false
    // Calendar facts only. notepad is untouched - it is the user's writing.
    await db.exec(
      `UPDATE meeting SET title = ?, start_at = ?, end_at = ?, kind = ?, updated_at = ?
        WHERE id = ?`,
      [meeting.title, meeting.startAt, meeting.endAt, meeting.kind, ts, meetingId],
    )
  } else {
    meetingId = randomUUID()
    created = true
    await db.exec(
      `INSERT INTO meeting (id, owner_email, title, start_at, end_at, kind,
                            external_id, notepad, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, ?, NULL)`,
      [
        meetingId,
        ownerEmail,
        meeting.title,
        meeting.startAt,
        meeting.endAt,
        meeting.kind,
        meeting.externalId,
        ts,
        ts,
      ],
    )
  }

  // Refresh the attendee set: people get added and removed from invites.
  await db.exec('DELETE FROM meeting_attendee WHERE meeting_id = ?', [meetingId])
  for (const attendee of meeting.attendees) {
    const { id: personId, created: isNew } = await upsertPerson(ownerEmail, attendee)
    if (isNew) peopleCreated++
    await db.exec(
      'INSERT INTO meeting_attendee (meeting_id, person_id) VALUES (?, ?)',
      [meetingId, personId],
    )
  }

  return { created, peopleCreated }
}

/**
 * Write normalised meetings into the database.
 *
 * Shared by both calendar sources - the Google API path and the .ics feed - so
 * dedupe, attendee handling and the "never clobber the user's writing" rule
 * exist in exactly one place.
 */
export async function upsertCalendarMeetings(
  ownerEmail: string,
  meetings: NormalisedMeeting[],
): Promise<{ created: number; updated: number; peopleCreated: number }> {
  await ensureSelfPerson(ownerEmail)
  let created = 0
  let updated = 0
  let peopleCreated = 0
  for (const meeting of meetings) {
    const res = await upsertMeeting(ownerEmail, meeting)
    if (res.created) created++
    else updated++
    peopleCreated += res.peopleCreated
  }
  return { created, updated, peopleCreated }
}

/**
 * Pull the calendar and write it in.
 *
 * Uses the stored sync token when present, falling back to a full window if
 * Google has expired it.
 */
export async function syncCalendar(ownerEmail: string): Promise<SyncResult> {
  const connection = await getConnection(ownerEmail)
  if (!connection) {
    return { created: 0, updated: 0, peopleCreated: 0, didFullResync: false, error: 'not_connected' }
  }

  const accessToken = await getAccessToken(ownerEmail)
  if (!accessToken) {
    return {
      created: 0,
      updated: 0,
      peopleCreated: 0,
      didFullResync: false,
      error: 'reconnect_required',
    }
  }

  await ensureSelfPerson(ownerEmail)

  try {
    const window = defaultWindow()
    const result = await fetchAllEvents({
      accessToken,
      syncToken: connection.syncToken ?? undefined,
      ...(connection.syncToken ? {} : window),
    })

    const meetings = normaliseEvents(result.events)
    const written = await upsertCalendarMeetings(ownerEmail, meetings)

    await updateSyncState({ ownerEmail, syncToken: result.syncToken, error: null })

    return { ...written, didFullResync: result.didFullResync }
  } catch (err) {
    const message =
      err instanceof GoogleApiError ? `Calendar API error (${err.status})` : 'Sync failed'
    await updateSyncState({ ownerEmail, syncToken: connection.syncToken, error: message })
    return { created: 0, updated: 0, peopleCreated: 0, didFullResync: false, error: message }
  }
}
