/**
 * Input and resource limits.
 *
 * All in one file so the numbers can be argued about in one place rather
 * than discovered scattered through the code.
 *
 * The point of these is NOT storage. `mediumtext` could hold 16MB happily.
 * The pod has 200MB of memory and a shared note is broadcast IN FULL to
 * every subscriber on its channel, so a large paste is a fan-out problem
 * before it is a database one.
 *
 * Every limit is enforced server-side. A client-side check is a courtesy to
 * the user, never a control.
 */

/**
 * Long-form fields: notepad, private notes, shared notes.
 *
 * 64KB is roughly 10,000 words, which is far more than anyone writes in a
 * meeting note and still small enough to fan out to a channel without
 * thinking about it. Chosen to be generous rather than tight: the failure
 * we care about is a pasted document, not a long note.
 */
export const MAX_DOCUMENT_CHARS = 64 * 1024

/**
 * List rows: talking points and action items.
 *
 * 2,000 characters is already several paragraphs in something that renders
 * as one line. Anything longer belongs in the notepad.
 */
export const MAX_ROW_CHARS = 2_000

/** Meeting titles. Google itself is impractical well before this. */
export const MAX_TITLE_CHARS = 500

/** Location and the create-dialog description, matching the columns and Google. */
export const MAX_LOCATION_CHARS = 500
export const MAX_DESCRIPTION_CHARS = 8_000

/**
 * Shared-note writes per user per minute.
 *
 * The client debounces at 400ms and only writes on a PAUSE, so ordinary
 * typing produces far fewer than this: you have to stop for 400ms to
 * trigger one. 120 allows two per second sustained, which no human reaches
 * by typing, while still bounding a script.
 */
export const MAX_NOTE_WRITES_PER_MINUTE = 120

/**
 * Live SSE subscribers.
 *
 * Per channel is about a meeting: twenty is far above any real 1:1 or team
 * note. Per user is about tabs and runaway reconnect loops, and each one
 * pins a server connection for as long as it is open.
 */
export const MAX_SUBSCRIBERS_PER_CHANNEL = 20
export const MAX_SUBSCRIBERS_PER_USER = 10

export class LimitExceededError extends Error {
  constructor(
    readonly field: string,
    readonly limit: number,
    readonly actual: number,
  ) {
    super(`${field} is ${actual} characters, over the ${limit} limit`)
    this.name = 'LimitExceededError'
  }
}

/**
 * Reject, never truncate.
 *
 * Silently cutting someone's text is worse than refusing it: they lose work
 * and are not told. The caller turns this into a message.
 */
export function enforceLength(field: string, value: string, limit: number): void {
  if (value.length > limit) throw new LimitExceededError(field, limit, value.length)
}

/**
 * A fixed-window counter, per key.
 *
 * In memory, which is correct here for the same reason the note hub is:
 * one always-on replica. It is deliberately not a token bucket - a window
 * is easier to reason about and the precision does not matter for a limit
 * this far above real use.
 */
const windows = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(key: string, maxPerMinute: number): boolean {
  const now = Date.now()
  const existing = windows.get(key)

  if (!existing || now >= existing.resetAt) {
    windows.set(key, { count: 1, resetAt: now + 60_000 })
    // Opportunistic sweep so an idle process does not hold every key it has
    // ever seen. Cheap because it only runs when a window rolls over.
    if (windows.size > 1_000) {
      for (const [k, v] of windows) if (now >= v.resetAt) windows.delete(k)
    }
    return true
  }

  if (existing.count >= maxPerMinute) return false
  existing.count += 1
  return true
}

/** Test seam. */
export function __resetRateLimits(): void {
  windows.clear()
}
