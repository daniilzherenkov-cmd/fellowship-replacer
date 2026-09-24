'use client'

/**
 * Unfinished items from the previous meeting with these people.
 *
 * docs/04 lists "action items carry forward into the next 1:1" as a v1
 * acceptance criterion; until now they were only listed on the person page,
 * which is not where you are when the meeting starts.
 *
 * These are the SAME rows as in the source note, not copies: ticking one here
 * completes it there too. Copying would give one task two ids and break the
 * unified list, which is must-have #3.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Checkbox } from '../ui/Checkbox'
import { DueDatePill } from '../ui/DueDatePill'
import { Avatar } from '../ui/Avatar'
import { updateActionItemAction } from '@/actions'
import type { ActionItem } from '@/lib/queries'

const DISMISS_PREFIX = 'fellow.carried-forward.dismissed.'

export function CarriedForward({
  meetingId,
  items,
  fromMeetingId,
  fromTitle,
}: {
  meetingId: string
  items: ActionItem[]
  fromMeetingId: string
  fromTitle: string
}) {
  const router = useRouter()
  const [dismissed, setDismissed] = useState(false)
  const [hidden, setHidden] = useState<string[]>([])

  // Per meeting, so dismissing today's block does not silence next week's.
  const key = `${DISMISS_PREFIX}${meetingId}`

  useEffect(() => {
    try {
      if (localStorage.getItem(key) === '1') setDismissed(true)
    } catch {
      // Blocked storage: showing the block is the safer failure.
    }
  }, [key])

  function dismiss() {
    setDismissed(true)
    try {
      localStorage.setItem(key, '1')
    } catch {
      // Nothing to do; it reappears next visit.
    }
  }

  const visible = items.filter((i) => !hidden.includes(i.id))
  if (dismissed || visible.length === 0) return null

  return (
    <section
      className="mb-7 p-3"
      style={{
        borderRadius: 'var(--radius-card)',
        background: 'var(--color-accent-subtle)',
      }}
    >
      <div className="mb-2 flex items-baseline gap-2">
        <h2 className="m-0 text-[length:var(--text-sm)] font-semibold">Carried forward</h2>
        <Link
          href={`/meetings/${fromMeetingId}`}
          className="min-w-0 flex-1 truncate text-[length:var(--text-xs)] no-underline"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          from {fromTitle}
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss carried forward"
          className="cursor-pointer border-0 bg-transparent p-0 text-[length:var(--text-base)] leading-none"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          ×
        </button>
      </div>

      <ul className="m-0 list-none p-0">
        {visible.map((item) => (
          <li key={item.id} className="flex items-center gap-2 py-[3px]">
            <Checkbox
              checked={item.isDone}
              onToggle={async () => {
                // Optimistically drop it: completing here should feel the same
                // as completing it in the source note.
                setHidden((h) => [...h, item.id])
                await updateActionItemAction(item.id, { isDone: true })
                router.refresh()
              }}
              label={item.isDone ? 'Mark not done' : 'Mark done'}
            />
            <span className="min-w-0 flex-1 truncate text-[length:var(--text-base)]">
              {item.text || 'Untitled'}
            </span>
            {item.dueDate && <DueDatePill date={new Date(item.dueDate)} />}
            {item.assignee && (
              <Avatar name={item.assignee.name} colorHex={item.assignee.colorHex} size={20} />
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
