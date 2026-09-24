import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { requireIdentity } from '@/lib/auth'
import { carriedForwardFor, getMeeting, listPeople } from '@/lib/queries'
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

  // Fails soft: the carry-forward block is a helper, never a reason to 500
  // the note it sits above.
  let carried = null
  try {
    carried = await carriedForwardFor(identity.email, id)
  } catch {
    carried = null
  }

  return <MeetingNote meeting={meeting} people={people} carried={carried} />
}
