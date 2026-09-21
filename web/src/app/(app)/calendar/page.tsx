import { headers } from 'next/headers'
import { requireIdentity } from '@/lib/auth'
import { listMeetings } from '@/lib/queries'
import { getConnection } from '@/lib/google-store'
import { googleConfigured } from '@/lib/google-oauth'
import { CalendarView } from '@/components/calendar/CalendarView'

export const dynamic = 'force-dynamic'

export default async function CalendarPage() {
  const identity = await requireIdentity(await headers())

  // A generous window either side of today so the agenda and the week view can
  // both be served without a second round trip.
  const from = new Date()
  from.setDate(from.getDate() - 14)
  const to = new Date()
  to.setDate(to.getDate() + 60)

  const meetings = await listMeetings(identity.email, {
    from: from.toISOString(),
    to: to.toISOString(),
  })

  // Whether to offer "Sync now". Deliberately fail-safe: this only decides
  // whether one icon renders, so a lookup failure must not take down the whole
  // calendar. Worst case the button is hidden and Settings still works.
  let connected = false
  if (googleConfigured()) {
    try {
      connected = Boolean(await getConnection(identity.email))
    } catch {
      connected = false
    }
  }

  return <CalendarView meetings={meetings} googleConnected={connected} />
}
