import { headers } from 'next/headers'
import { requireIdentity } from '@/lib/auth'
import { listMeetings, listPeople } from '@/lib/queries'
import { getConnection } from '@/lib/google-store'
import { googleConfigured } from '@/lib/google-oauth'
import { CalendarView } from '@/components/calendar/CalendarView'

export const dynamic = 'force-dynamic'

/**
 * Days either side of the anchor date to load.
 *
 * The calendar renders ONE day (agenda) or ONE week (grid), so fetching three
 * months to draw one week shipped 1.17MB of JSON per navigation and made tab
 * switching crawl. A fortnight either side covers the visible week plus a
 * buffer, so most arrow clicks need no new data at all; stepping outside it
 * re-anchors the URL and the server sends the next slice.
 *
 * Navigation is still unbounded - there is no three-month wall.
 */
const WINDOW_DAYS = 14

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>
}) {
  const identity = await requireIdentity(await headers())
  const { d } = await searchParams

  // `d` comes from our own links, but it is still user input in the URL.
  const parsed = d ? new Date(`${d}T00:00:00`) : new Date()
  const anchor = Number.isNaN(parsed.getTime()) ? new Date() : parsed

  const from = new Date(anchor)
  from.setDate(from.getDate() - WINDOW_DAYS)
  from.setHours(0, 0, 0, 0)
  const to = new Date(anchor)
  to.setDate(to.getDate() + WINDOW_DAYS)
  to.setHours(23, 59, 59, 999)

  const [meetings, people] = await Promise.all([
    listMeetings(identity.email, { from: from.toISOString(), to: to.toISOString() }),
    listPeople(identity.email),
  ])

  // Whether to offer "Sync now". Deliberately fail-safe: this only decides
  // whether one icon renders, so a lookup failure must not take down the whole
  // calendar. Worst case the button is hidden and Settings still works.
  const configured = googleConfigured()
  let connected = false
  let lastSyncAt: string | null = null
  if (configured) {
    try {
      const connection = await getConnection(identity.email)
      connected = Boolean(connection)
      lastSyncAt = connection?.lastSyncAt ?? null
    } catch {
      connected = false
    }
  }

  return (
    <CalendarView
      meetings={meetings}
      googleConnected={connected}
      googleConfigured={configured}
      lastSyncAt={lastSyncAt}
      people={people}
      anchorDate={anchor.toISOString()}
      windowFrom={from.toISOString()}
      windowTo={to.toISOString()}
    />
  )
}
