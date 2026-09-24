/**
 * Which upcoming meetings deserve a notification right now.
 *
 * Pure so the timing rules can be tested without a browser or a clock. The
 * cost of getting these wrong is either a missed meeting or a notification
 * that fires repeatedly, and the second is the kind of thing that makes
 * someone switch reminders off forever.
 */

export interface ReminderMeeting {
  id: string
  title: string
  startAt: string
}

/** How far ahead to warn. Matches the in-app banner and Fellow's own nudge. */
export const LEAD_MS = 5 * 60_000

/**
 * A meeting that started more than this ago is not worth announcing; you are
 * either in it or you missed it, and a late popup is pure noise.
 */
const GRACE_MS = 60_000

export interface ReminderDecision {
  meeting: ReminderMeeting
  /** Minutes until it starts, rounded, floored at 0. */
  minutesAway: number
}

/**
 * Meetings to notify about on this tick.
 *
 * `alreadyFired` carries the ids that have been announced, so a 30s poll does
 * not fire the same reminder ten times. It is the caller's job to persist
 * that set across reloads.
 */
export function dueReminders(
  meetings: ReminderMeeting[],
  now: number,
  alreadyFired: ReadonlySet<string>,
): ReminderDecision[] {
  return meetings
    .filter((m) => !alreadyFired.has(m.id))
    .map((m) => ({ meeting: m, start: new Date(m.startAt).getTime() }))
    .filter(({ start }) => Number.isFinite(start))
    // Inside the lead window, and not already long started.
    .filter(({ start }) => start - now <= LEAD_MS && start > now - GRACE_MS)
    .sort((a, b) => a.start - b.start)
    .map(({ meeting, start }) => ({
      meeting,
      minutesAway: Math.max(0, Math.round((start - now) / 60_000)),
    }))
}

/** The notification body. "now" reads better than "in 0 minutes". */
export function reminderBody(minutesAway: number): string {
  if (minutesAway <= 0) return 'Starting now'
  if (minutesAway === 1) return 'Starting in 1 minute'
  return `Starting in ${minutesAway} minutes`
}

/**
 * Drop ids for meetings that are no longer in play, so the fired set does not
 * grow without bound in a tab left open for days.
 */
export function pruneFired(
  fired: ReadonlySet<string>,
  meetings: ReminderMeeting[],
): Set<string> {
  const live = new Set(meetings.map((m) => m.id))
  return new Set([...fired].filter((id) => live.has(id)))
}
