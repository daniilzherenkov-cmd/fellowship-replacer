import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { requireIdentity } from '@/lib/auth'
import { getMeeting, listPeople } from '@/lib/queries'
import { MeetingNote } from '@/components/note/MeetingNote'

export const dynamic = 'force-dynamic'

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const identity = await requireIdentity(await headers())

  // getMeeting scopes on owner_email, so another user's meeting id yields null
  // here rather than leaking a note.
  const [meeting, people] = await Promise.all([
    getMeeting(identity.email, id),
    listPeople(identity.email),
  ])
  if (!meeting) notFound()

  return <MeetingNote meeting={meeting} people={people} />
}
