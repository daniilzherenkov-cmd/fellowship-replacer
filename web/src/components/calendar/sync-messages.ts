/**
 * Wording for the calendar sync readout.
 *
 * Separate from SyncButton.tsx on purpose: that file is a client component and
 * imports next/navigation, which a plain Node test process cannot resolve. Pure
 * strings live here so they can be unit tested without a browser or a bundler.
 */

/**
 * Say what changed, not merely that something happened.
 *
 * "Synced." tells the user nothing they could not have assumed. "3 new" answers
 * the question they actually had when they clicked. The zero case matters too:
 * it distinguishes "the feature ran and your calendar really is empty" from
 * "nothing happened and I cannot tell why".
 */
export function summarise(created: number, updated: number): string {
  if (created === 0 && updated === 0) return 'Already up to date'
  const parts: string[] = []
  if (created > 0) parts.push(`${created} new`)
  if (updated > 0) parts.push(`${updated} updated`)
  return parts.join(', ')
}

/**
 * Turn a sync error code into something the user can act on.
 *
 * The button is on the calendar page but connecting happens in Settings, so any
 * message about a missing or expired connection has to say where to go.
 */
export function describeError(error?: string): string {
  switch (error) {
    case 'not_connected':
      return 'Connect Google Calendar in Settings.'
    case 'reconnect_required':
      return 'Authorisation expired. Reconnect in Settings.'
    case 'google_not_configured':
      return 'Google Calendar is not set up yet.'
    default:
      return 'Sync failed. Try again.'
  }
}
