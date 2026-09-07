'use server'

/**
 * Server Actions.
 *
 * Every action re-derives the caller's identity from the Cloudflare Access JWT
 * on the incoming request. It is never passed in from the client - a client
 * that could name its own owner_email could read anyone's notes.
 */

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { requireIdentity } from '@/lib/auth'
import * as q from '@/lib/queries'

async function me(): Promise<string> {
  const h = await headers()
  const identity = await requireIdentity(h)
  return identity.email
}

/* ---------------------------- meetings ---------------------------- */

export async function createMeetingAction(input: {
  title: string
  startAt: string
  endAt: string
  kind?: 'oneOnOne' | 'team' | 'manual'
}): Promise<{ id: string }> {
  const owner = await me()
  const id = await q.createMeeting(owner, {
    title: input.title.trim() || 'Untitled meeting',
    startAt: input.startAt,
    endAt: input.endAt,
    kind: input.kind,
  })
  revalidatePath('/calendar')
  revalidatePath('/meetings')
  return { id }
}

export async function updateMeetingAction(
  meetingId: string,
  fields: { title?: string; notepad?: string },
): Promise<void> {
  const owner = await me()
  await q.updateMeeting(owner, meetingId, fields)
  // A hand-created meeting has no attendees to classify from, so re-derive the
  // kind from the title ("Danya / Milena" is a 1:1). Calendar-sourced meetings
  // are classified by attendee count and are not touched here.
  if (fields.title !== undefined) {
    await q.reclassifyManualMeeting(owner, meetingId, fields.title)
  }
  // Deliberately no revalidatePath on notepad edits: they autosave on a
  // debounce and a re-render mid-typing would fight the cursor.
  if (fields.title !== undefined) revalidatePath(`/meetings/${meetingId}`)
}

/* ------------------------- talking points ------------------------- */

export async function addTalkingPointAction(
  meetingId: string,
  text = '',
): Promise<{ id: string }> {
  const owner = await me()
  const id = await q.addTalkingPoint(owner, meetingId, text)
  revalidatePath(`/meetings/${meetingId}`)
  return { id }
}

export async function updateTalkingPointAction(
  id: string,
  fields: { text?: string; isCovered?: boolean },
): Promise<void> {
  const owner = await me()
  await q.updateTalkingPoint(owner, id, fields)
}

export async function deleteTalkingPointAction(id: string, meetingId: string): Promise<void> {
  const owner = await me()
  await q.deleteTalkingPoint(owner, id)
  revalidatePath(`/meetings/${meetingId}`)
}

/* --------------------------- action items -------------------------- */

export async function addActionItemAction(
  meetingId: string | null,
  text = '',
): Promise<{ id: string }> {
  const owner = await me()
  const id = await q.addActionItem(owner, meetingId, text)
  if (meetingId) revalidatePath(`/meetings/${meetingId}`)
  revalidatePath('/actions')
  return { id }
}

export async function updateActionItemAction(
  id: string,
  fields: {
    text?: string
    isDone?: boolean
    dueDate?: string | null
    assigneeId?: string | null
  },
): Promise<void> {
  const owner = await me()
  await q.updateActionItem(owner, id, fields)
  // Checking an item anywhere must check it everywhere - the unified list and
  // the note are two views of one row.
  if (fields.isDone !== undefined || fields.dueDate !== undefined) {
    revalidatePath('/actions')
  }
}

export async function deleteActionItemAction(
  id: string,
  meetingId: string | null,
): Promise<void> {
  const owner = await me()
  await q.deleteActionItem(owner, id)
  if (meetingId) revalidatePath(`/meetings/${meetingId}`)
  revalidatePath('/actions')
}

/* ----------------------------- calendar ---------------------------- */

/**
 * Connect a Google Calendar secret .ics address.
 *
 * Validated by actually fetching it, so a wrong or truncated address fails
 * immediately with a useful message rather than being saved and silently never
 * syncing.
 */
export async function connectIcsAction(
  url: string,
): Promise<{ ok: boolean; error?: string; created?: number; totalEvents?: number }> {
  const owner = await me()
  const { syncIcsCalendar, saveIcsUrl } = await import('@/lib/ics-store')

  const trial = await syncIcsCalendar(owner, url)
  if (!trial.ok) return { ok: false, error: trial.error }

  await saveIcsUrl(owner, url)
  revalidatePath('/calendar')
  revalidatePath('/meetings')
  revalidatePath('/people')
  revalidatePath('/settings')
  return { ok: true, created: trial.created, totalEvents: trial.totalEvents }
}

export async function syncIcsAction(): Promise<{ ok: boolean; error?: string; created?: number }> {
  const owner = await me()
  const { syncIcsCalendar } = await import('@/lib/ics-store')
  const result = await syncIcsCalendar(owner)
  revalidatePath('/calendar')
  revalidatePath('/meetings')
  revalidatePath('/people')
  revalidatePath('/settings')
  return result.ok ? { ok: true, created: result.created } : { ok: false, error: result.error }
}

export async function disconnectIcsAction(): Promise<void> {
  const owner = await me()
  const { removeIcsUrl } = await import('@/lib/ics-store')
  await removeIcsUrl(owner)
  revalidatePath('/settings')
}

export async function syncCalendarAction(): Promise<{ ok: boolean; error?: string }> {
  const owner = await me()
  const { syncCalendar } = await import('@/lib/sync')
  const result = await syncCalendar(owner)
  revalidatePath('/calendar')
  revalidatePath('/meetings')
  revalidatePath('/people')
  return result.error ? { ok: false, error: result.error } : { ok: true }
}
