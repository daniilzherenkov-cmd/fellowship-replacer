import { headers } from 'next/headers'
import { requireIdentity } from '@/lib/auth'
import { listAllActionItems, listPeople } from '@/lib/queries'
import { ActionsList } from '@/components/actions/ActionsList'

export const dynamic = 'force-dynamic'

/**
 * The unified to-do list - must-have #3: every open action item across every
 * meeting, each with a back-link to its source note.
 */
export default async function ActionsPage() {
  const identity = await requireIdentity(await headers())
  const [items, people] = await Promise.all([
    listAllActionItems(identity.email),
    listPeople(identity.email),
  ])
  return <ActionsList items={items} people={people} />
}
