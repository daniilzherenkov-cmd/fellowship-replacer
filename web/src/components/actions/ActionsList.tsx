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

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ActionItemRow } from '../note/ActionItemRow'
import type { ActionItem, Person } from '@/lib/queries'
import {
  createActionItemAction,
  deleteActionItemAction,
  updateActionItemAction,
} from '@/actions'
import { applyFilters, isFiltering, EMPTY_FILTERS, NO_MEETING, type OwnerTab } from './filters'

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
  const [tab, setTab] = useState<OwnerTab>('mine')
  const [text, setText] = useState('')
  const [personId, setPersonId] = useState('')
  const [meetingId, setMeetingId] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [adding, setAdding] = useState(false)

  // Source meetings, derived from the items themselves so the dropdown only
  // ever offers meetings that actually have items.
  const meetingOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const i of items) {
      if (i.meetingId && i.meetingTitle) seen.set(i.meetingId, i.meetingTitle)
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [items])

  const filtered = useMemo(
    () => applyFilters(items, { tab, text, personId, meetingId, showDone }),
    [items, tab, text, personId, meetingId, showDone],
  )

  const filtering = isFiltering({ tab, text, personId, meetingId, showDone })

  const otherCount = useMemo(
    () => applyFilters(items, { ...EMPTY_FILTERS, tab: 'others' }).length,
    [items],
  )
  const mineCount = useMemo(
    () => applyFilters(items, { ...EMPTY_FILTERS, tab: 'mine' }).length,
    [items],
  )

  async function addItem() {
    setAdding(true)
    try {
      // Standalone: no meeting. Lands in Inbox until given a due date.
      await createActionItemAction('')
      router.refresh()
    } finally {
      setAdding(false)
    }
  }

  const groups = new Map<Bucket, ActionItem[]>()
  for (const item of filtered) {
    const bucket = bucketFor(item)
    groups.set(bucket, [...(groups.get(bucket) ?? []), item])
  }

  const nonEmpty = ORDER.filter((b) => (groups.get(b) ?? []).length > 0)

  return (
    <div className="mx-auto w-full" style={{ maxWidth: 'var(--note-max-width)', padding: 32 }}>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="m-0 flex-1 text-[length:var(--text-3xl)] font-semibold">Action items</h1>
        <button
          type="button"
          onClick={addItem}
          disabled={adding}
          className="cursor-pointer px-3 py-[6px] text-[length:var(--text-base)] font-medium text-white"
          style={{
            borderRadius: 'var(--radius-row)',
            border: 0,
            background: 'var(--color-accent)',
            opacity: adding ? 0.6 : 1,
          }}
        >
          + New action item
        </button>
      </div>

      <div
        className="mb-4 flex gap-4"
        role="tablist"
        aria-label="Whose action items"
        style={{ borderBottom: '1px solid var(--color-hairline)' }}
      >
        {([
          ['mine', 'My items', mineCount],
          ['others', 'Assigned to others', otherCount],
        ] as const).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className="cursor-pointer border-0 bg-transparent px-1 pb-2 text-[length:var(--text-base)] font-medium"
            style={{
              color: tab === key ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              borderBottom:
                tab === key ? '2px solid var(--color-accent)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {label}
            <span className="ml-[6px]" style={{ color: 'var(--color-text-tertiary)' }}>
              {count}
            </span>
          </button>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search for items…"
          aria-label="Search action items"
          className="px-2 py-[5px] text-[length:var(--text-sm)] outline-none"
          style={{
            width: 200,
            borderRadius: 'var(--radius-row)',
            border: '1px solid var(--color-hairline)',
            background: 'var(--color-canvas)',
          }}
        />
        <FilterSelect
          label="Assignee"
          value={personId}
          onChange={setPersonId}
          options={people.map((p) => [p.id, p.isMe ? `${p.name} (me)` : p.name])}
        />
        <FilterSelect
          label="Meeting"
          value={meetingId}
          onChange={setMeetingId}
          options={[[NO_MEETING, 'No meeting'], ...meetingOptions]}
        />
        <label
          className="flex cursor-pointer items-center gap-[6px] text-[length:var(--text-sm)]"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <input
            type="checkbox"
            checked={showDone}
            onChange={(e) => setShowDone(e.target.checked)}
          />
          Show done
        </label>
        {filtering && (
          <button
            type="button"
            onClick={() => {
              setText('')
              setPersonId('')
              setMeetingId('')
              setShowDone(false)
            }}
            className="cursor-pointer border-0 bg-transparent px-1 text-[length:var(--text-sm)]"
            style={{ color: 'var(--color-accent)' }}
          >
            Clear
          </button>
        )}
      </div>

      {nonEmpty.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-[length:var(--text-lg)] font-medium">All clear</p>
          <p className="mt-1 text-[length:var(--text-base)]" style={{ color: 'var(--color-text-secondary)' }}>
            {filtering
              ? 'No items match these filters.'
              : 'Action items you add in a meeting show up here.'}
          </p>
        </div>
      )}

      {nonEmpty.map((bucket) => {
        const list = groups.get(bucket) ?? []
        return (
          <section key={bucket} className="mb-7">
            <div className="mb-1 flex items-baseline gap-2 px-2">
              <h2
                className="m-0 text-[length:var(--text-base)] font-semibold"
                style={{
                  color: bucket === 'Overdue' ? 'var(--color-overdue)' : undefined,
                }}
              >
                {bucket === 'Inbox' ? '📥 Inbox' : bucket}
              </h2>
              <span className="text-[length:var(--text-sm)]" style={{ color: 'var(--color-text-tertiary)' }}>
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

/** A labelled select that collapses to "label: value" once something is picked. */
function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: [string, string][]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="cursor-pointer px-2 py-[5px] text-[length:var(--text-sm)] outline-none"
      style={{
        borderRadius: 'var(--radius-row)',
        border: '1px solid var(--color-hairline)',
        background: value ? 'var(--color-accent-subtle)' : 'var(--color-canvas)',
        color: value ? 'var(--color-accent)' : 'inherit',
        maxWidth: 200,
      }}
    >
      <option value="">{label}: any</option>
      {options.map(([id, name]) => (
        <option key={id} value={id}>
          {name}
        </option>
      ))}
    </select>
  )
}
