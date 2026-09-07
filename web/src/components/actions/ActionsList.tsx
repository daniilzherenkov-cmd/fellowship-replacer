'use client'

/**
 * The unified to-do list. Port of ActionItemsView.swift.
 *
 * Grouped Overdue / Today / Upcoming / Inbox, where Inbox means "no due date"
 * (ActionItemsView.swift:29-41). Empty groups are dropped; each header carries
 * a count in tertiary text.
 *
 * Checking an item here checks it in its source note too - they are two views
 * of one row, which is the point of must-have #3.
 */

import { useRouter } from 'next/navigation'
import { ActionItemRow } from '../note/ActionItemRow'
import type { ActionItem, Person } from '@/lib/queries'
import { deleteActionItemAction, updateActionItemAction } from '@/actions'

type Bucket = 'Overdue' | 'Today' | 'Upcoming' | 'Inbox'

export function bucketFor(item: ActionItem, now = new Date()): Bucket {
  if (!item.dueDate) return 'Inbox'
  const due = new Date(item.dueDate)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfTomorrow = new Date(startOfToday.getTime() + 86_400_000)
  if (due < startOfToday) return 'Overdue'
  if (due < startOfTomorrow) return 'Today'
  return 'Upcoming'
}

const ORDER: Bucket[] = ['Overdue', 'Today', 'Upcoming', 'Inbox']

export function ActionsList({ items, people }: { items: ActionItem[]; people: Person[] }) {
  const router = useRouter()

  const groups = new Map<Bucket, ActionItem[]>()
  for (const item of items) {
    const bucket = bucketFor(item)
    groups.set(bucket, [...(groups.get(bucket) ?? []), item])
  }

  const nonEmpty = ORDER.filter((b) => (groups.get(b) ?? []).length > 0)

  return (
    <div className="mx-auto w-full" style={{ maxWidth: 'var(--note-max-width)', padding: 32 }}>
      <h1 className="mb-6 text-[22px] font-semibold">Action items</h1>

      {nonEmpty.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-[15px] font-medium">All clear</p>
          <p className="mt-1 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
            Action items you add in a meeting show up here.
          </p>
        </div>
      )}

      {nonEmpty.map((bucket) => {
        const list = groups.get(bucket) ?? []
        return (
          <section key={bucket} className="mb-7">
            <div className="mb-1 flex items-baseline gap-2 px-2">
              <h2
                className="m-0 text-[13px] font-semibold"
                style={{
                  color: bucket === 'Overdue' ? 'var(--color-overdue)' : undefined,
                }}
              >
                {bucket === 'Inbox' ? '📥 Inbox' : bucket}
              </h2>
              <span className="text-[12px]" style={{ color: 'var(--color-text-tertiary)' }}>
                {list.length}
              </span>
            </div>
            {list.map((item) => (
              <ActionItemRow
                key={item.id}
                item={item}
                people={people}
                showSource
                onOpenSource={() =>
                  item.meetingId && router.push(`/meetings/${item.meetingId}`)
                }
                onChange={async (fields) => {
                  await updateActionItemAction(item.id, fields)
                  if (fields.text === undefined) router.refresh()
                }}
                onDelete={async () => {
                  await deleteActionItemAction(item.id, item.meetingId)
                  router.refresh()
                }}
              />
            ))}
          </section>
        )
      })}
    </div>
  )
}
