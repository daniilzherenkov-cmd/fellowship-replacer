/**
 * Google Calendar API client.
 *
 * Response shapes verified against live API output for Danya's account (see
 * test/fixtures/gcal-real-window.json).
 *
 * Two API behaviours worth knowing, both of which bite silently:
 *
 * 1. `singleEvents=true` expands recurring series into individual instances.
 *    Without it you get the series master and a recurrence rule, and the app
 *    would show one row for a weekly meeting instead of one per week. It is
 *    also required for `orderBy=startTime`.
 *
 * 2. `syncToken` gives cheap incremental sync, but Google can expire it at any
 *    time (410 GONE), which REQUIRES a full resync. Treating 410 as a normal
 *    error leaves sync permanently broken.
 */

import type { GCalEvent } from './calendar'

const BASE = 'https://www.googleapis.com/calendar/v3'

export interface ListEventsParams {
  accessToken: string
  calendarId?: string
  timeMin?: string
  timeMax?: string
  syncToken?: string
  pageToken?: string
  maxResults?: number
}

export interface ListEventsResult {
  events: GCalEvent[]
  nextPageToken: string | null
  /** Present only on the final page. Store it to enable incremental sync. */
  nextSyncToken: string | null
  /** True when Google expired the sync token and a full resync is required. */
  syncTokenExpired: boolean
}

export class GoogleApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'GoogleApiError'
  }
}

/**
 * One page of events.
 *
 * Note: when a syncToken is supplied, Google rejects timeMin/timeMax and
 * singleEvents changes - the token already encodes the original query. Sending
 * them together is a 400.
 */
export async function listEvents(params: ListEventsParams): Promise<ListEventsResult> {
  const {
    accessToken,
    calendarId = 'primary',
    timeMin,
    timeMax,
    syncToken,
    pageToken,
    maxResults = 250,
  } = params

  const url = new URL(`${BASE}/calendars/${encodeURIComponent(calendarId)}/events`)
  url.searchParams.set('maxResults', String(maxResults))
  // Expand recurrence into instances - see the module comment.
  url.searchParams.set('singleEvents', 'true')

  if (syncToken) {
    url.searchParams.set('syncToken', syncToken)
  } else {
    url.searchParams.set('orderBy', 'startTime')
    if (timeMin) url.searchParams.set('timeMin', timeMin)
    if (timeMax) url.searchParams.set('timeMax', timeMax)
  }
  if (pageToken) url.searchParams.set('pageToken', pageToken)

  const res = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
  })

  if (res.status === 410) {
    // Sync token expired. Not a failure - a signal to start over.
    return { events: [], nextPageToken: null, nextSyncToken: null, syncTokenExpired: true }
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new GoogleApiError(
      `Calendar API ${res.status}: ${body.slice(0, 200)}`,
      res.status,
    )
  }

  const data = (await res.json()) as {
    items?: GCalEvent[]
    nextPageToken?: string
    nextSyncToken?: string
  }

  return {
    events: data.items ?? [],
    nextPageToken: data.nextPageToken ?? null,
    nextSyncToken: data.nextSyncToken ?? null,
    syncTokenExpired: false,
  }
}

export interface FetchAllResult {
  events: GCalEvent[]
  syncToken: string | null
  /** Set when a stale sync token forced a full refetch. */
  didFullResync: boolean
}

/**
 * Fetch every event across all pages, following pagination and recovering
 * automatically from an expired sync token.
 *
 * `maxPages` bounds the work: a first sync of a busy calendar can be thousands
 * of events, and this runs inside a request on a 200MB container.
 */
export async function fetchAllEvents(params: {
  accessToken: string
  calendarId?: string
  timeMin?: string
  timeMax?: string
  syncToken?: string
  maxPages?: number
}): Promise<FetchAllResult> {
  const { maxPages = 20, syncToken, ...rest } = params

  const collect = async (token?: string): Promise<FetchAllResult | 'expired'> => {
    const events: GCalEvent[] = []
    let pageToken: string | undefined
    let finalSyncToken: string | null = null

    for (let page = 0; page < maxPages; page++) {
      const res: ListEventsResult = await listEvents({
        ...rest,
        syncToken: token,
        pageToken,
      })
      if (res.syncTokenExpired) return 'expired'

      events.push(...res.events)
      finalSyncToken = res.nextSyncToken ?? finalSyncToken
      if (!res.nextPageToken) break
      pageToken = res.nextPageToken
    }

    return { events, syncToken: finalSyncToken, didFullResync: false }
  }

  const first = await collect(syncToken)
  if (first !== 'expired') return first

  // Token was stale: redo the query from scratch, without it.
  const full = await collect(undefined)
  if (full === 'expired') {
    throw new GoogleApiError('Sync token expired twice - aborting', 410)
  }
  return { ...full, didFullResync: true }
}

/**
 * Default sync window: the Swift app imported +/-3 months, which matched what
 * Milena was told in the onboarding message. Keep parity.
 */
export function defaultWindow(now = new Date()): { timeMin: string; timeMax: string } {
  const min = new Date(now)
  min.setMonth(min.getMonth() - 3)
  const max = new Date(now)
  max.setMonth(max.getMonth() + 3)
  return { timeMin: min.toISOString(), timeMax: max.toISOString() }
}
