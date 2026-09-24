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
import type { Person, TalkingPoint } from '@/lib/queries'
import { Avatar } from '../ui/Avatar'
import { detectMention } from './ActionItemRow'

export function TalkingPointRow({
  point,
  people = [],
  onChange,
  onDelete,
}: {
  point: TalkingPoint
  /**
   * Meeting attendees, for the @mention picker. Defaults to empty so a row
   * rendered without them simply has no picker rather than crashing.
   */
  people?: Person[]
  onChange: (fields: { text?: string; isCovered?: boolean }) => void
  onDelete: () => void
}) {
  const [hover, setHover] = useState(false)
  const [bulletHover, setBulletHover] = useState(false)
  const [text, setText] = useState(point.text)
  // Active @query, or null when not mentioning. A talking point has no
  // assignee column, so unlike an action item the pick inserts the name as
  // text rather than assigning anyone.
  const [mention, setMention] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
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

  /**
   * Replace the @token being typed with the person's name.
   *
   * Plain text on purpose: talking_point stores only text, so a marker syntax
   * or a join table would be a schema change for a cosmetic link. The name
   * reads correctly in the note and in any export.
   */
  function insertMention(person: Person) {
    const caret = inputRef.current?.selectionStart ?? text.length
    const upto = text.slice(0, caret)
    const at = upto.lastIndexOf('@')
    const next =
      at === -1 ? text : `${upto.slice(0, at)}@${person.name} ${text.slice(caret)}`.trimEnd() + ' '
    setText(next)
    setMention(null)
    save(next)
    inputRef.current?.focus()
  }

  const candidates = people
    .filter((p) => !mention || p.name.toLowerCase().includes(mention.toLowerCase()))
    .sort((a, b) => Number(b.isMe) - Number(a.isMe))
    .slice(0, 6)

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

      <span className="relative min-w-0 flex-1">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setMention(detectMention(e.target.value, e.target.selectionStart ?? e.target.value.length))
            save(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && mention !== null) {
              e.preventDefault()
              setMention(null)
            }
          }}
          // Blur closes the picker, but only after a click on it has landed.
          onBlur={() => {
            flush()
            setTimeout(() => setMention(null), 120)
          }}
          placeholder="New talking point"
          aria-label="Talking point"
          className="w-full border-0 bg-transparent p-0 outline-none"
          style={{
            color: point.isCovered ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
            textDecoration: point.isCovered ? 'line-through' : 'none',
          }}
        />

        {mention !== null && candidates.length > 0 && (
          <ul
            role="listbox"
            aria-label="Mention a person"
            className="absolute left-0 top-[22px] z-30 m-0 min-w-[190px] list-none p-1"
            style={{
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--color-hairline)',
              background: 'var(--color-canvas)',
              boxShadow: '0 8px 24px rgb(0 0 0 / 0.14)',
            }}
          >
            {candidates.map((person) => (
              <li key={person.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  // onMouseDown, not onClick: the input's blur would otherwise
                  // close the list before a click could register.
                  onMouseDown={(e) => {
                    e.preventDefault()
                    insertMention(person)
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-2 py-[5px] text-left text-[length:var(--text-base)]"
                  style={{ borderRadius: 'var(--radius-row)' }}
                >
                  <Avatar name={person.name} colorHex={person.colorHex} size={18} />
                  <span className="truncate">{person.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </span>

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
