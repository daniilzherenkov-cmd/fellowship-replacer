'use client'

/**
 * Overlapping avatar row. Swift used HStack(spacing: -6) with a canvas ring.
 *
 * Who is behind "+N" must always be findable (UX review, 2026-09):
 *  - every stack carries a title and aria-label naming everyone it knows of,
 *    so hovering anywhere on it works, not just on one avatar;
 *  - with `interactive`, the whole stack is a button that opens the full
 *    list. Off by default because list rows render the stack inside a Link
 *    or a <button>, where a nested button is invalid HTML.
 *
 * `total` is the real attendee count. List views load a capped preview, so
 * counting `people` there understates the overflow.
 */

import { useEffect, useRef, useState } from 'react'
import { Avatar } from './Avatar'

interface StackPerson {
  name: string
  email?: string | null
  colorHex?: string
}

export function AvatarStack({
  people,
  total = people.length,
  size = 22,
  max = 3,
  interactive = false,
}: {
  people: StackPerson[]
  total?: number
  size?: number
  max?: number
  interactive?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const count = Math.max(total, people.length)
  const shown = people.slice(0, max)
  const overflow = count - shown.length
  const unnamed = count - people.length
  const summary =
    people.map((p) => p.name).join(', ') + (unnamed > 0 ? ` and ${unnamed} more` : '')

  const avatars = (
    <>
      {shown.map((p, i) => (
        <span key={`${p.name}-${i}`} style={{ marginLeft: i === 0 ? 0 : -6 }}>
          <Avatar name={p.name} colorHex={p.colorHex} size={size} ring />
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="ml-1 text-[length:var(--text-xs)]"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          +{overflow}
        </span>
      )}
    </>
  )

  if (!interactive) {
    return (
      <span className="inline-flex items-center" title={summary} aria-label={`Attendees: ${summary}`}>
        {avatars}
      </span>
    )
  }

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`${count} ${count === 1 ? 'attendee' : 'attendees'}: ${summary}`}
        title={summary}
        className="inline-flex cursor-pointer items-center border-0 bg-transparent p-[2px]"
        style={{ borderRadius: 'var(--radius-pill)' }}
      >
        {avatars}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Attendees"
          className="absolute left-0 top-[calc(100%+6px)] z-40 max-h-[320px] min-w-[240px] overflow-auto p-1"
          style={{
            borderRadius: 'var(--radius-card)',
            border: '1px solid var(--color-hairline)',
            background: 'var(--color-canvas)',
            boxShadow: '0 8px 24px rgb(0 0 0 / 0.14)',
          }}
        >
          <p
            className="m-0 px-2 pb-1 pt-[6px] text-[length:var(--text-2xs)] font-semibold uppercase"
            style={{ color: 'var(--color-text-secondary)', letterSpacing: '0.04em' }}
          >
            {count} {count === 1 ? 'attendee' : 'attendees'}
          </p>
          <ul className="m-0 list-none p-0">
            {people.map((p, i) => (
              <li
                key={`${p.name}-${i}`}
                className="flex items-center gap-2 px-2 py-[5px]"
                style={{ borderRadius: 'var(--radius-row)' }}
              >
                <Avatar name={p.name} colorHex={p.colorHex} size={20} />
                <span className="min-w-0">
                  <span className="block truncate text-[length:var(--text-base)]">{p.name}</span>
                  {p.email && p.email !== p.name && (
                    <span
                      className="block truncate text-[length:var(--text-xs)]"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {p.email}
                    </span>
                  )}
                </span>
              </li>
            ))}
            {unnamed > 0 && (
              <li className="px-2 py-[5px] text-[length:var(--text-sm)]" style={{ color: 'var(--color-text-secondary)' }}>
                and {unnamed} more
              </li>
            )}
          </ul>
        </div>
      )}
    </span>
  )
}
