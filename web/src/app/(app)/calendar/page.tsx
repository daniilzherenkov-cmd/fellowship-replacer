import { headers } from 'next/headers'
import { requireIdentity } from '@/lib/auth'
import { listMeetings } from '@/lib/queries'
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

  return <CalendarView meetings={meetings} />
}
