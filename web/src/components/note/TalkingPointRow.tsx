'use client'

/**
 * Talking point row. Port of TalkingPointRow in MeetingNoteView.swift.
 *
 * The bullet is TRI-STATE, which is easy to miss:
 *   idle    -> empty circle
 *   hover   -> small filled circle, accent at 50%
 *   covered -> large filled circle, accent
 * with strikethrough text once covered.
 *
 * State handling note: the row is keyed by id in the parent, and `key` includes
 * the id, so React gives each row its own instance. Local text is seeded once
 * from props and thereafter owned by this component until it unmounts - it is
 * deliberately NOT re-synced on every prop change, because a router.refresh()
 * triggered by adding a sibling row re-renders this one with pre-edit data and
 * would otherwise clobber what the user is typing.
 */

import { useEffect, useRef, useState } from 'react'
import { RowMenu } from '../ui/RowMenu'
import type { TalkingPoint } from '@/lib/queries'

export function TalkingPointRow({
  point,
  onChange,
  onDelete,
}: {
  point: TalkingPoint
  onChange: (fields: { text?: string; isCovered?: boolean }) => void
  onDelete: () => void
}) {
  const [hover, setHover] = useState(false)
  const [bulletHover, setBulletHover] = useState(false)
  const [text, setText] = useState(point.text)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<string | null>(null)

  // Always flush an unsaved edit before this row goes away.
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

  function save(next: string) {
    pendingRef.current = next
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const value = pendingRef.current
      pendingRef.current = null
      if (value !== null) onChange({ text: value })
    }, 400)
  }

  function flush() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const value = pendingRef.current
    pendingRef.current = null
    if (value !== null && value !== point.text) onChange({ text: value })
  }

  return (
    <div
      data-testid="talking-point-row"
      className="flex items-start gap-2 px-2 py-[6px] transition-colors duration-[180ms]"
      style={{
        borderRadius: 'var(--radius-row)',
        background: hover ? 'var(--color-hover)' : 'transparent',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        aria-label={point.isCovered ? 'Mark not covered' : 'Mark covered'}
        aria-pressed={point.isCovered}
        onClick={() => {
          flush()
          onChange({ isCovered: !point.isCovered })
        }}
        onMouseEnter={() => setBulletHover(true)}
        onMouseLeave={() => setBulletHover(false)}
        className="mt-[3px] cursor-pointer border-0 bg-transparent p-0 leading-none"
      >
        <Bullet covered={point.isCovered} hover={bulletHover} />
      </button>

      <input
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          save(e.target.value)
        }}
        onBlur={flush}
        placeholder="New talking point"
        aria-label="Talking point"
        className="min-w-0 flex-1 border-0 bg-transparent p-0 outline-none"
        style={{
          color: point.isCovered ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
          textDecoration: point.isCovered ? 'line-through' : 'none',
        }}
      />

      {hover ? (
        <RowMenu
          items={[
            {
              label: point.isCovered ? 'Mark not covered' : 'Mark covered',
              onSelect: () => {
                flush()
                onChange({ isCovered: !point.isCovered })
              },
            },
            { label: 'Delete', onSelect: onDelete, destructive: true },
          ]}
        />
      ) : (
        <span style={{ width: 16, display: 'inline-block' }} aria-hidden="true" />
      )}
    </div>
  )
}

function Bullet({ covered, hover }: { covered: boolean; hover: boolean }) {
  if (covered) {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <circle cx="7" cy="7" r="6" fill="none" stroke="var(--color-accent)" strokeWidth="1.4" />
        <circle cx="7" cy="7" r="3.6" fill="var(--color-accent)" />
      </svg>
    )
  }
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <circle
        cx="7"
        cy="7"
        r="6"
        fill="none"
        stroke={hover ? 'var(--color-accent)' : 'var(--color-text-tertiary)'}
        strokeWidth="1.4"
      />
      {hover && <circle cx="7" cy="7" r="2.2" fill="var(--color-accent)" opacity="0.5" />}
    </svg>
  )
}
