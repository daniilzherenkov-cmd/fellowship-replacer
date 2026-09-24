/**
 * Sending Web Push, and the scheduler that decides when.
 *
 * WHY AN IN-PROCESS SCHEDULER IS SAFE HERE: the platform's app.yaml pins this
 * app to `min: 1, max: 1`, so exactly one always-on replica serves it. That
 * removes the two usual objections to a timer inside the app - duplicate
 * sends from multiple replicas, and a timer that dies when the pod scales to
 * zero. There is no platform cron; the app hosts its own.
 *
 * It does NOT rely on that being true forever. Every reminder is claimed
 * through `reminder_sent`, whose primary key rejects a second attempt, so
 * raising `max` above 1 later degrades to "one of them sends" rather than
 * "everyone gets two notifications".
 */

import {
  dueRemindersToSend,
  claimReminder,
  listPushSubscriptions,
  deletePushSubscription,
} from './queries'

/** How far ahead to notify. Matches the in-app banner. */
export const PUSH_LEAD_MS = 5 * 60_000
/** Past this, the meeting is underway and a popup is noise. */
const PUSH_GRACE_MS = 60_000
/** A minute is accurate enough for a five-minute warning and costs nothing. */
const TICK_MS = 60_000

let timer: ReturnType<typeof setInterval> | null = null
let running = false

export function vapidConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  )
}

async function configuredWebPush() {
  const webpush = (await import('web-push')).default
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT as string,
    process.env.VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string,
  )
  return webpush
}

/** Minutes until start, floored at zero, for the notification body. */
function minutesUntil(startAt: string): number {
  return Math.max(0, Math.round((new Date(startAt).getTime() - Date.now()) / 60_000))
}

export function reminderBodyFor(minutes: number): string {
  if (minutes <= 0) return 'Starting now'
  if (minutes === 1) return 'Starting in 1 minute'
  return `Starting in ${minutes} minutes`
}

/**
 * One pass: find due reminders, claim each, push to that owner's browsers.
 *
 * Returns counts so the boot log says something useful rather than nothing.
 */
export async function sendDueReminders(): Promise<{ sent: number; failed: number }> {
  if (!vapidConfigured()) return { sent: 0, failed: 0 }

  const due = await dueRemindersToSend(PUSH_LEAD_MS, PUSH_GRACE_MS)
  if (!due.length) return { sent: 0, failed: 0 }

  const webpush = await configuredWebPush()
  let sent = 0
  let failed = 0

  for (const reminder of due) {
    // Claim BEFORE sending. Sending first and recording after would send
    // twice if the process died in between.
    const claimed = await claimReminder(reminder.meetingId, reminder.ownerEmail)
    if (!claimed) continue

    const subscriptions = await listPushSubscriptions(reminder.ownerEmail)
    const payload = JSON.stringify({
      title: reminder.title || 'Meeting',
      body: reminderBodyFor(minutesUntil(reminder.startAt)),
      meetingId: reminder.meetingId,
    })

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.authSecret },
          },
          payload,
        )
        sent += 1
      } catch (err) {
        failed += 1
        // 404 or 410 means the browser threw the subscription away; keeping
        // it would mean failing forever on every future tick.
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await deletePushSubscription(sub.endpoint).catch(() => {})
        }
      }
    }
  }

  return { sent, failed }
}

/**
 * Start the ticker. Called once per server process from instrumentation.ts.
 *
 * Guarded against overlapping runs: a slow pass must not have a second one
 * started on top of it.
 */
export function startReminderScheduler(): void {
  if (timer) return
  if (!vapidConfigured()) {
    console.info('[push] VAPID not configured - reminder scheduler not started')
    return
  }

  console.info('[push] reminder scheduler started')
  timer = setInterval(() => {
    if (running) return
    running = true
    sendDueReminders()
      .then(({ sent, failed }) => {
        if (sent || failed) console.info(`[push] sent ${sent}, failed ${failed}`)
      })
      .catch((err) => console.error('[push] tick failed', err))
      .finally(() => {
        running = false
      })
  }, TICK_MS)

  // Do not hold the process open on shutdown.
  timer.unref?.()
}
