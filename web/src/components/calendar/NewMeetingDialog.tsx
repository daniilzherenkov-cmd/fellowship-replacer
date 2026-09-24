'use client'

/**
 * Create-event dialog, modelled on Fellow's (docs/15 A3).
 *
 * Replaces the old "+ New meeting" button, which inserted an unnamed stub at
 * 09:00 that you could only rename or delete - two identical "New meeting
 * 9:00 AM" rows in Danya's screenshot came from exactly that.
 *
 * ATTENDEE SEARCH IS DELIBERATELY NARROW. Fellow searches the whole Google
 * Workspace directory; that needs a directory scope, a new consent screen and
 * another admin approval. Decision 2026-09-23: search only people already in
 * `person`, i.e. anyone from a synced calendar event. See CLAUDE.md.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createMeetingFullAction } from '@/actions'
import { Avatar } from '../ui/Avatar'
import { TimeSlotPicker } from './TimeSlotPicker'
import type { Person } from '@/lib/queries'

/** "2026-09-23T15:00", the shape <input type="datetime-local"> wants. */
function localInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function dateInputValue(d: Date): string {
  return localInputValue(d).slice(0, 10)
}

export function NewMeetingDialog({
  people,
  initialStart,
  googleConnected,
  onClose,
}: {
  people: Person[]
  /** Pre-filled from the clicked slot, or "now rounded up" from the button. */
  initialStart: Date
  googleConnected: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [allDay, setAllDay] = useState(false)
  const [start, setStart] = useState(() => localInputValue(initialStart))
  const [end, setEnd] = useState(() =>
    localInputValue(new Date(initialStart.getTime() + 30 * 60_000)),
  )
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<Person[]>([])
  const [pushToGoogle, setPushToGoogle] = useState(googleConnected)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => titleRef.current?.focus(), [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const chosen = new Set(picked.map((p) => p.id))
    return people
      .filter((p) => !chosen.has(p.id) && !p.isMe)
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) || (p.email ?? '').toLowerCase().includes(q),
      )
      .slice(0, 6)
  }, [query, people, picked])

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const result = await createMeetingFullAction({
        title,
        startAt: allDay ? start.slice(0, 10) : start,
        endAt: allDay ? end.slice(0, 10) : end,
        allDay,
        location: location.trim() || null,
        description: description.trim() || null,
        attendeeIds: picked.map((p) => p.id),
        pushToGoogle: pushToGoogle && googleConnected,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })

      // The meeting exists either way; only the Google push is best-effort.
      if (pushToGoogle && googleConnected && !result.pushedToGoogle) {
        setError(
          result.googleError === 'not_connected'
            ? 'Saved here, but Google is not connected.'
            : 'Saved here, but adding it to Google Calendar failed.',
        )
        setSaving(false)
        router.refresh()
        return
      }

      onClose()
      router.push(`/meetings/${result.id}`)
    } catch {
      setError('Could not create the meeting.')
      setSaving(false)
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgb(0 0 0 / 0.32)' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-meeting-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full overflow-auto p-5"
        style={{
          maxWidth: 560,
          maxHeight: '86vh',
          background: 'var(--color-canvas)',
          border: '1px solid var(--color-hairline)',
          borderRadius: 'var(--radius-card)',
          boxShadow: '0 16px 48px rgb(0 0 0 / 0.2)',
        }}
      >
        <h2 id="new-meeting-title" className="m-0 mb-4 text-[length:var(--text-xl)] font-semibold">
          Create event
        </h2>

        <input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add event title"
          aria-label="Event title"
          className="mb-3 w-full px-3 py-2 text-[length:var(--text-lg)] outline-none"
          style={{
            borderRadius: 'var(--radius-row)',
            border: '1px solid var(--color-hairline)',
            background: 'var(--color-canvas)',
          }}
        />

        {/* Drag on the grid to set the time, the way Fellow does. The typed
            fields below stay: they are the keyboard and screen-reader path,
            and the only way to reach a date outside the visible week. */}
        {!allDay && (
          <TimeSlotPicker
            start={new Date(start)}
            end={new Date(end)}
            onChange={(s, e) => {
              setStart(localInputValue(s))
              setEnd(localInputValue(e))
            }}
          />
        )}

        <div className="mb-3 flex items-center gap-2">
          <Field
            label="Starts"
            type={allDay ? 'date' : 'datetime-local'}
            value={allDay ? start.slice(0, 10) : start}
            onChange={(v) => setStart(allDay ? `${v}T00:00` : v)}
          />
          <Field
            label="Ends"
            type={allDay ? 'date' : 'datetime-local'}
            value={allDay ? end.slice(0, 10) : end}
            onChange={(v) => setEnd(allDay ? `${v}T00:00` : v)}
          />
        </div>

        <label
          className="mb-3 flex cursor-pointer items-center gap-2 text-[length:var(--text-sm)]"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          All day
        </label>

        {/* Attendees */}
        <div className="mb-3">
          <p
            className="m-0 mb-1 text-[length:var(--text-sm)]"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Guests
          </p>
          {picked.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {picked.map((p) => (
                <span
                  key={p.id}
                  className="flex items-center gap-[6px] py-[2px] pl-[2px] pr-2 text-[length:var(--text-sm)]"
                  style={{
                    borderRadius: 'var(--radius-pill)',
                    background: 'var(--color-sidebar)',
                  }}
                >
                  <Avatar name={p.name} colorHex={p.colorHex} size={18} />
                  {p.name}
                  <button
                    type="button"
                    aria-label={`Remove ${p.name}`}
                    onClick={() => setPicked((cur) => cur.filter((x) => x.id !== p.id))}
                    className="cursor-pointer border-0 bg-transparent p-0 leading-none"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people you have met"
              aria-label="Search guests"
              className="w-full px-3 py-2 text-[length:var(--text-base)] outline-none"
              style={{
                borderRadius: 'var(--radius-row)',
                border: '1px solid var(--color-hairline)',
                background: 'var(--color-canvas)',
              }}
            />
            {matches.length > 0 && (
              <ul
                role="listbox"
                className="absolute left-0 right-0 top-[38px] z-10 m-0 list-none p-1"
                style={{
                  borderRadius: 'var(--radius-card)',
                  border: '1px solid var(--color-hairline)',
                  background: 'var(--color-canvas)',
                  boxShadow: '0 8px 24px rgb(0 0 0 / 0.14)',
                }}
              >
                {matches.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        setPicked((cur) => [...cur, p])
                        setQuery('')
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-2 py-[5px] text-left"
                      style={{ borderRadius: 'var(--radius-row)' }}
                    >
                      <Avatar name={p.name} colorHex={p.colorHex} size={20} />
                      <span className="min-w-0 flex-1 truncate text-[length:var(--text-base)]">
                        {p.name}
                      </span>
                      {p.email && (
                        <span
                          className="shrink-0 truncate text-[length:var(--text-xs)]"
                          style={{ color: 'var(--color-text-secondary)', maxWidth: 160 }}
                        >
                          {p.email}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Location"
          aria-label="Location"
          className="mb-3 w-full px-3 py-2 text-[length:var(--text-base)] outline-none"
          style={{
            borderRadius: 'var(--radius-row)',
            border: '1px solid var(--color-hairline)',
            background: 'var(--color-canvas)',
          }}
        />

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add a description"
          aria-label="Description"
          className="mb-3 w-full resize-y px-3 py-2 text-[length:var(--text-base)] outline-none"
          style={{
            minHeight: 60,
            borderRadius: 'var(--radius-row)',
            border: '1px solid var(--color-hairline)',
            background: 'var(--color-canvas)',
          }}
        />

        <label
          className="mb-4 flex cursor-pointer items-center gap-2 text-[length:var(--text-sm)]"
          style={{ color: googleConnected ? 'inherit' : 'var(--color-text-tertiary)' }}
          title={googleConnected ? undefined : 'Connect Google Calendar in Settings first'}
        >
          <input
            type="checkbox"
            checked={pushToGoogle && googleConnected}
            disabled={!googleConnected}
            onChange={(e) => setPushToGoogle(e.target.checked)}
          />
          Also add to my Google Calendar and invite guests
        </label>

        {error && (
          <p className="mb-3 text-[length:var(--text-sm)]" style={{ color: 'var(--color-due)' }}>
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer border-0 bg-transparent px-3 py-2 text-[length:var(--text-base)]"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="cursor-pointer px-4 py-2 text-[length:var(--text-base)] font-medium text-white"
            style={{
              borderRadius: 'var(--radius-row)',
              border: 0,
              background: 'var(--color-accent)',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  type,
  value,
  onChange,
}: {
  label: string
  type: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="flex-1">
      <span
        className="mb-1 block text-[length:var(--text-sm)]"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-[6px] text-[length:var(--text-sm)] outline-none"
        style={{
          borderRadius: 'var(--radius-row)',
          border: '1px solid var(--color-hairline)',
          background: 'var(--color-canvas)',
        }}
      />
    </label>
  )
}
