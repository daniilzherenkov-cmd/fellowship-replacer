/**
 * "50m left" copy for the note header.
 *
 * Pure so it can be unit tested without a browser, same reason as
 * sync-messages.ts.
 *
 * Returns null when there is nothing useful to say: the meeting is over, or
 * it is far enough away that a countdown would be noise rather than help.
 */

/** Don't start counting down until the meeting is within this window. */
const LEAD_MS = 60 * 60_000

export function timeLeftLabel(
  startAt: string,
  endAt: string,
  now: number = Date.now(),
): string | null {
  const start = new Date(startAt).getTime()
  const end = new Date(endAt).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null

  // Already finished.
  if (now >= end) return null

  // Running now: how much of it is left.
  if (now >= start) {
    const mins = Math.max(1, Math.round((end - now) / 60_000))
    return `${formatMinutes(mins)} left`
  }

  // Coming up, but only worth saying when it is close.
  const until = start - now
  if (until > LEAD_MS) return null
  const mins = Math.max(1, Math.round(until / 60_000))
  return `in ${formatMinutes(mins)}`
}

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}
