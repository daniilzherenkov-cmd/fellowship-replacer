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
import type { SearchHit } from '@/lib/queries'

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
  fields: { title?: string; notepad?: string; privateNotes?: string },
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
): Promise<{
  ok: boolean
  error?: string
  created?: number
  totalEvents?: number
  redacted?: number
}> {
  const owner = await me()
  const { syncIcsCalendar, saveIcsUrl } = await import('@/lib/ics-store')

  const trial = await syncIcsCalendar(owner, url)
  if (!trial.ok) return { ok: false, error: trial.error }

  await saveIcsUrl(owner, url)
  revalidatePath('/calendar')
  revalidatePath('/meetings')
  revalidatePath('/people')
  revalidatePath('/settings')
  return {
    ok: true,
    created: trial.created,
    totalEvents: trial.totalEvents,
    redacted: trial.redacted,
  }
}

export async function syncIcsAction(): Promise<{
  ok: boolean
  error?: string
  created?: number
  redacted?: number
}> {
  const owner = await me()
  const { syncIcsCalendar } = await import('@/lib/ics-store')
  const result = await syncIcsCalendar(owner)
  revalidatePath('/calendar')
  revalidatePath('/meetings')
  revalidatePath('/people')
  revalidatePath('/settings')
  return result.ok
    ? { ok: true, created: result.created, redacted: result.redacted }
    : { ok: false, error: result.error }
}

export async function disconnectIcsAction(): Promise<void> {
  const owner = await me()
  const { removeIcsUrl } = await import('@/lib/ics-store')
  await removeIcsUrl(owner)
  revalidatePath('/settings')
}

export async function syncCalendarAction(): Promise<{
  ok: boolean
  error?: string
  created?: number
  updated?: number
}> {
  const owner = await me()
  const { syncCalendar } = await import('@/lib/sync')
  const result = await syncCalendar(owner)
  revalidatePath('/calendar')
  revalidatePath('/meetings')
  revalidatePath('/people')
  if (result.error) return { ok: false, error: result.error }
  // Counts come back so the caller can say what changed ("3 new") rather than
  // the uninformative "Synced." A sync that found nothing is worth showing too:
  // it tells the user the feature worked and their calendar really is empty.
  return { ok: true, created: result.created, updated: result.updated }
}

export async function searchAction(term: string): Promise<{ hits: SearchHit[] }> {
  const owner = await me()
  return { hits: await q.searchAll(owner, term) }
}

export async function createActionItemAction(text: string): Promise<{ id: string }> {
  const owner = await me()
  // meetingId null: a standalone item, the path the `IS ?` dialect bug broke.
  const id = await q.addActionItem(owner, null, text)
  revalidatePath('/actions')
  return { id }
}

export interface CreateMeetingInput {
  title: string
  /** Local wall-clock ISO without a zone, e.g. 2026-09-23T15:00, or YYYY-MM-DD when allDay. */
  startAt: string
  endAt: string
  allDay?: boolean
  location?: string | null
  description?: string | null
  attendeeIds?: string[]
  /** Also create it on the user's Google Calendar and invite the attendees. */
  pushToGoogle?: boolean
  /** IANA zone from the browser, so Google books the right wall-clock time. */
  timeZone?: string
}

/**
 * Create a meeting from the new-event dialog.
 *
 * Writes locally first and treats Google as best-effort: if the push fails
 * the meeting still exists in Fellow Hero and the caller is told. Losing the
 * user's typing because an API call 500'd would be the worse failure.
 */
export async function createMeetingFullAction(input: CreateMeetingInput): Promise<{
  id: string
  pushedToGoogle: boolean
  googleError?: string
}> {
  const owner = await me()

  const attendees = input.attendeeIds ?? []
  let externalId: string | null = null
  let pushedToGoogle = false
  let googleError: string | undefined

  if (input.pushToGoogle) {
    try {
      const { getAccessToken } = await import('@/lib/google-store')
      const { createEvent } = await import('@/lib/google-calendar-api')
      const accessToken = await getAccessToken(owner)
      if (!accessToken) {
        googleError = 'not_connected'
      } else {
        // Only people we hold an email for can be invited.
        const directory = await q.listPeople(owner)
        const emails = attendees
          .map((id) => directory.find((p) => p.id === id)?.email)
          .filter((e): e is string => Boolean(e))

        const created = await createEvent({
          accessToken,
          summary: input.title.trim() || 'Untitled meeting',
          start: input.startAt,
          end: input.endAt,
          allDay: input.allDay,
          location: input.location ?? null,
          description: input.description ?? null,
          attendeeEmails: emails,
          timeZone: input.timeZone,
        })
        // Same dedupe key the sync uses, so the next sync updates this row
        // instead of creating a duplicate.
        if (created.id) externalId = `gcal:${created.id}`
        pushedToGoogle = true
      }
    } catch (err) {
      googleError = err instanceof Error ? err.message.slice(0, 200) : 'unknown'
    }
  }

  const id = await q.createMeeting(owner, {
    title: input.title.trim() || 'Untitled meeting',
    startAt: new Date(input.startAt).toISOString(),
    endAt: new Date(input.endAt).toISOString(),
    // Attendee count first, then fall back to the title, so "Danya / Milena"
    // with no guests still comes out as a 1:1.
    kind:
      attendees.length === 1
        ? 'oneOnOne'
        : attendees.length > 1
          ? 'team'
          : q.titleLooksOneOnOne(input.title)
            ? 'oneOnOne'
            : 'manual',
    isAllDay: input.allDay,
    location: input.location ?? null,
    attendeeIds: attendees,
    externalId,
  })

  revalidatePath('/calendar')
  revalidatePath('/meetings')
  revalidatePath('/people')
  return { id, pushedToGoogle, googleError }
}

/**
 * Delete a meeting, and its Google event when it has one.
 *
 * Local delete first: if Google fails the meeting is still gone from Fellow
 * Hero, which is what the user asked for, and they are told the calendar copy
 * survived rather than being left guessing.
 */
export async function deleteMeetingAction(
  meetingId: string,
  alsoGoogle = true,
): Promise<{ ok: boolean; googleRemoved: boolean; googleError?: string }> {
  const owner = await me()
  const result = await q.deleteMeeting(owner, meetingId)
  if (!result) return { ok: false, googleRemoved: false }

  revalidatePath('/calendar')
  revalidatePath('/meetings')
  revalidatePath('/actions')

  const externalId = result.externalId
  if (!alsoGoogle || !externalId?.startsWith('gcal:')) {
    return { ok: true, googleRemoved: false }
  }

  try {
    const { getAccessToken } = await import('@/lib/google-store')
    const { deleteEvent } = await import('@/lib/google-calendar-api')
    const accessToken = await getAccessToken(owner)
    if (!accessToken) return { ok: true, googleRemoved: false, googleError: 'not_connected' }
    await deleteEvent({ accessToken, eventId: externalId.slice('gcal:'.length) })
    return { ok: true, googleRemoved: true }
  } catch (err) {
    return {
      ok: true,
      googleRemoved: false,
      googleError: err instanceof Error ? err.message.slice(0, 160) : 'unknown',
    }
  }
}

export async function updateMeetingTimeAction(
  meetingId: string,
  startAt: string,
  endAt: string,
): Promise<void> {
  const owner = await me()
  await q.updateMeetingTime(owner, meetingId, new Date(startAt).toISOString(), new Date(endAt).toISOString())
  revalidatePath('/calendar')
  revalidatePath('/meetings')
  revalidatePath(`/meetings/${meetingId}`)
}

export async function reorderTalkingPointsAction(
  meetingId: string,
  orderedIds: string[],
): Promise<void> {
  const owner = await me()
  await q.reorderTalkingPoints(owner, meetingId, orderedIds)
  revalidatePath(`/meetings/${meetingId}`)
}

export async function reorderActionItemsAction(
  meetingId: string,
  orderedIds: string[],
): Promise<void> {
  const owner = await me()
  await q.reorderActionItems(owner, meetingId, orderedIds)
  revalidatePath(`/meetings/${meetingId}`)
  revalidatePath('/actions')
}

export async function savePushSubscriptionAction(sub: {
  endpoint: string
  p256dh: string
  authSecret: string
}): Promise<{ ok: boolean }> {
  const owner = await me()
  await q.savePushSubscription(owner, sub)
  return { ok: true }
}

export async function removePushSubscriptionAction(endpoint: string): Promise<{ ok: boolean }> {
  // Scoped by ownership on read, and the endpoint is the browser's own
  // opaque handle, so there is nothing to guess here.
  await me()
  await q.deletePushSubscription(endpoint)
  return { ok: true }
}

/** Fire one push to the caller's own devices, to prove the setup works. */
export async function sendTestPushAction(): Promise<{ ok: boolean; sent: number }> {
  const owner = await me()
  const { vapidConfigured } = await import('@/lib/push')
  if (!vapidConfigured()) return { ok: false, sent: 0 }

  const subs = await q.listPushSubscriptions(owner)
  if (!subs.length) return { ok: false, sent: 0 }

  const webpush = (await import('web-push')).default
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT as string,
    process.env.VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string,
  )
  const payload = JSON.stringify({
    title: 'Reminders are on',
    body: 'You will get a nudge five minutes before each meeting.',
  })

  let sent = 0
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.authSecret } },
        payload,
      )
      sent += 1
    } catch {
      // A failing device must not fail the whole opt-in.
    }
  }
  return { ok: sent > 0, sent }
}
