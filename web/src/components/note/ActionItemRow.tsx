'use client'

/**
 * Action item row. Port of ActionItemRow in MeetingNoteView.swift - the richest
 * interaction in the app.
 *
 * Fidelity rules from the Swift original (docs/02 §8, and Danya's review notes):
 *  - NOT hovered: checkbox + text + due pill + avatar only.
 *  - Hovered: grey rounded background fades in over ~0.18s, plus the source
 *    line, the add-assignee icon and the ⋮ menu.
 *  - The ⋮ slot is reserved with a transparent spacer when not hovered, so the
 *    row does not jump sideways on hover (Swift did this at ActionItemsView:136).
 *  - The checkbox owns its own hover; hovering the row must not tint it.
 *
 * @-mention: on every keystroke, scan back to the last '@'. If no whitespace
 * follows it, open the assignee popover filtered by the text after it. Picking
 * a person strips the @token from the text.
 */

import { useEffect, useRef, useState } from 'react'
import { Checkbox } from '../ui/Checkbox'
import { DueDatePill } from '../ui/DueDatePill'
import { Avatar } from '../ui/Avatar'
import { RowMenu } from '../ui/RowMenu'
import type { ActionItem, Person } from '@/lib/queries'

export interface ActionItemRowProps {
  item: ActionItem
  people: Person[]
  onChange: (fields: {
    text?: string
    isDone?: boolean
    dueDate?: string | null
    assigneeId?: string | null
  }) => void
  onDelete: () => void
  /** Rendered under the text when hovered, in the unified list. */
  showSource?: boolean
  onOpenSource?: () => void
}

/** Scan back from the caret for an active @mention. */
export function detectMention(text: string, caret: number): string | null {
  const upto = text.slice(0, caret)
  const at = upto.lastIndexOf('@')
  if (at === -1) return null
  const after = upto.slice(at + 1)
  // A space closes the mention, matching the Swift behaviour.
  if (/\s/.test(after)) return null
  return after
}

export function ActionItemRow({
  item,
  people,
  onChange,
  onDelete,
  showSource = false,
  onOpenSource,
}: ActionItemRowProps) {
  const [hover, setHover] = useState(false)
  const [text, setText] = useState(item.text)
  const [mention, setMention] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<string | null>(null)

  // Local text is seeded once and owned by this row until it unmounts. It is
  // deliberately NOT re-synced from props: a router.refresh() triggered by
  // adding a sibling row re-renders this one with pre-edit data and would
  // otherwise clobber what is being typed.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      if (pendingRef.current !== null) {
        onChangeRef.current({ text: pendingRef.current })
      }
    },
    [],
  )

  function commit(next: string) {
    pendingRef.current = next
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const value = pendingRef.current
      pendingRef.current = null
      if (value !== null) onChange({ text: value })
    }, 400)
  }

  /** Persist immediately - used before any action that re-renders the list. */
  function flush() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const value = pendingRef.current
    pendingRef.current = null
    if (value !== null && value !== item.text) onChange({ text: value })
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value
    setText(next)
    setMention(detectMention(next, e.target.selectionStart ?? next.length))
    commit(next)
  }

  function assign(person: Person) {
    // Strip the @token the user was typing.
    const caret = inputRef.current?.selectionStart ?? text.length
    const upto = text.slice(0, caret)
    const at = upto.lastIndexOf('@')
    const cleaned = at === -1 ? text : (upto.slice(0, at) + text.slice(caret)).trimEnd()
    setText(cleaned)
    setMention(null)
    onChange({ text: cleaned, assigneeId: person.id })
  }

  const candidates = people
    .filter((p) => !mention || p.name.toLowerCase().includes(mention.toLowerCase()))
    // "Me" first, exactly as the Swift assignee popover ordered it.
    .sort((a, b) => Number(b.isMe) - Number(a.isMe))
    .slice(0, 6)

  return (
    <div
      data-testid="action-item-row"
      className="group relative flex items-start gap-2 px-2 py-[6px] transition-colors duration-[180ms]"
      style={{
        borderRadius: 'var(--radius-row)',
        background: hover ? 'var(--color-hover)' : 'transparent',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="pt-[2px]">
        <Checkbox
          checked={item.isDone}
          label={item.text || 'Action item'}
          onToggle={() => {
            flush()
            onChange({ isDone: !item.isDone })
          }}
        />
      </div>

      <div className="min-w-0 flex-1">
        <input
          ref={inputRef}
          value={text}
          onChange={handleInput}
          onBlur={() => {
            flush()
            // Delay so a click on the popover still registers.
            setTimeout(() => setMention(null), 150)
          }}
          placeholder="New action item"
          aria-label="Action item text"
          className="w-full border-0 bg-transparent p-0 outline-none"
          style={{
            color: item.isDone ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
            textDecoration: item.isDone ? 'line-through' : 'none',
          }}
        />

        {showSource && hover && (
          <div className="mt-[2px] text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
            {item.meetingId ? (
              <button
                type="button"
                onClick={onOpenSource}
                className="cursor-pointer border-0 bg-transparent p-0 underline"
                style={{ color: 'var(--color-accent)' }}
              >
                {item.meetingTitle ?? 'Untitled'}
              </button>
            ) : (
              <span style={{ color: 'var(--color-text-tertiary)' }}>No series</span>
            )}
          </div>
        )}

        {mention !== null && candidates.length > 0 && (
          <div
            role="listbox"
            aria-label="Assign to"
            className="absolute left-8 z-20 mt-1 w-56 overflow-hidden py-1"
            style={{
              background: 'var(--color-canvas)',
              border: '1px solid var(--color-hairline)',
              borderRadius: 'var(--radius-card)',
              boxShadow: 'var(--shadow-popover)',
            }}
          >
            {candidates.map((p) => (
              <button
                key={p.id}
                type="button"
                role="option"
                // onMouseDown, not onClick: blur fires first and would close it.
                onMouseDown={(e) => {
                  e.preventDefault()
                  assign(p)
                }}
                className="flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-3 py-[6px] text-left text-[13px] hover:bg-[var(--color-hover)]"
              >
                <Avatar name={p.name} colorHex={p.colorHex} size={20} />
                <span>
                  {p.name}
                  {p.isMe && (
                    <span style={{ color: 'var(--color-text-tertiary)' }}> (You)</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 pt-[1px]">
        {item.dueDate && <DueDatePill date={new Date(item.dueDate)} />}

        {item.assignee ? (
          <Avatar name={item.assignee.name} colorHex={item.assignee.colorHex} size={22} />
        ) : (
          hover && (
            <button
              type="button"
              onClick={() => {
                inputRef.current?.focus()
                setMention('')
              }}
              title="Assign"
              aria-label="Assign"
              className="cursor-pointer border-0 bg-transparent p-0"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <circle cx="8" cy="7.5" r="3" stroke="currentColor" strokeWidth="1.3" />
                <path d="M2.8 16c0-2.5 2.3-4 5.2-4 .7 0 1.3.1 1.9.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                <path d="M14.5 11.5v5M12 14h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
          )
        )}

        {/* Reserve the menu slot so the row never shifts on hover. */}
        {hover ? (
          <RowMenu
            items={[
              { label: 'Due today', onSelect: () => onChange({ dueDate: isoToday() }) },
              { label: 'Due tomorrow', onSelect: () => onChange({ dueDate: isoTomorrow() }) },
              ...(item.dueDate
                ? [{ label: 'Clear due date', onSelect: () => onChange({ dueDate: null }) }]
                : []),
              { label: 'Delete', onSelect: onDelete, destructive: true },
            ]}
          />
        ) : (
          <span style={{ width: 16, display: 'inline-block' }} aria-hidden="true" />
        )}
      </div>
    </div>
  )
}

function isoToday(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString()
}

function isoTomorrow(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString()
}
