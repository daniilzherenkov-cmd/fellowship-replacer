'use client'

/**
 * Calendar agenda. Port of the agenda column in TodayView.swift.
 *
 * Details carried over from the Swift version:
 *  - AgendaCard has a 3px accent left bar for 1:1s, tertiary otherwise.
 *  - Cards are TRANSPARENT when neither selected nor hovered. The Swift source
 *    is explicit about this: "clean cards on white, like Fellow (no grey film)".
 *  - Selection uses a custom light-blue tint with an accent title, never a
 *    solid-blue list selection.
 *  - The now-line is a green separator inserted BETWEEN cards, at the first
 *    meeting starting after now, and only when viewing today.
 */

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AvatarStack } from '../ui/Avatar'
import { createMeetingAction } from '@/actions'
import { WeekGrid, weekDaysFor } from './WeekGrid'
import { SyncButton } from './SyncButton'
import { ConnectPrompt } from './ConnectPrompt'
import { AutoSync } from './AutoSync'
import { NewMeetingDialog } from './NewMeetingDialog'
import type { Meeting, Person } from '@/lib/queries'

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function CalendarView({
  meetings,
  googleConnected = false,
  googleConfigured = false,
  lastSyncAt = null,
  people = [],
  anchorDate,
  windowFrom,
  windowTo,
}: {
  meetings: Meeting[]
  /** Controls whether "Sync now" is offered. Defaults off so no dead control appears. */
  googleConnected?: boolean
  /** Whether the deployment has OAuth credentials, so connecting is possible at all. */
  googleConfigured?: boolean
  /** Last successful sync, used to decide whether a load-time sync is due. */
  lastSyncAt?: string | null
  /** Directory for the new-event guest picker. */
  people?: Person[]
  /** The date the server fetched around, ISO. */
  anchorDate?: string
  /** Bounds of the loaded slice; navigating outside re-anchors the URL. */
  windowFrom?: string
  windowTo?: string
}) {
  const router = useRouter()
  // Seeded from the server's anchor so a shared or reloaded URL lands on the
  // right day. Local state keeps arrow clicks instant; the effect below only
  // re-anchors when the user leaves the slice the server sent.
  const [selectedDate, setSelectedDate] = useState(() =>
    anchorDate ? new Date(anchorDate) : new Date(),
  )
  const [createAt, setCreateAt] = useState<Date | null>(null)
  const [loadingSlice, startTransition] = useTransition()
  const [mode, setMode] = useState<'today' | 'week'>('today')

  const dayMeetings = useMemo(
    () => meetings.filter((m) => sameDay(new Date(m.startAt), selectedDate)),
    [meetings, selectedDate],
  )

  /**
   * Fetch the next slice when navigation leaves the loaded window.
   *
   * The calendar used to load three months up front, which is 1.17MB of JSON
   * to draw one week. Now the server sends a fortnight either side and this
   * asks for more only when the user actually walks out of it, so ordinary
   * arrow clicks stay local and instant.
   */
  useEffect(() => {
    if (!windowFrom || !windowTo) return
    const t = selectedDate.getTime()
    // Keep a day of slack so landing exactly on the edge does not thrash.
    const lo = new Date(windowFrom).getTime() + 86_400_000
    const hi = new Date(windowTo).getTime() - 86_400_000
    if (t >= lo && t <= hi) return

    const pad = (n: number) => String(n).padStart(2, '0')
    const d = `${selectedDate.getFullYear()}-${pad(selectedDate.getMonth() + 1)}-${pad(selectedDate.getDate())}`
    startTransition(() => router.replace(`/calendar?d=${d}`, { scroll: false }))
  }, [selectedDate, windowFrom, windowTo, router])

  // ⌘N, as docs/04 asked for. Ignored while typing so it does not hijack a
  // browser shortcut inside a note field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key !== 'n') return
      const el = document.activeElement
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return
      e.preventDefault()
      openCreate()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const isToday = sameDay(selectedDate, new Date())

  const weekMeetings = useMemo(() => {
    const days = weekDaysFor(selectedDate)
    const start = days[0]
    const end = new Date(days[6])
    end.setHours(23, 59, 59, 999)
    return meetings.filter((m) => {
      const t = new Date(m.startAt).getTime()
      return t >= start.getTime() && t <= end.getTime()
    })
  }, [meetings, selectedDate])

  // Only meaningful on today: index of the first meeting still to come.
  const nowLineIndex = useMemo(() => {
    if (!isToday) return -1
    const now = Date.now()
    return dayMeetings.findIndex((m) => new Date(m.startAt).getTime() > now)
  }, [dayMeetings, isToday])

  // Step by a whole week in week mode. Stepping one day there moved the agenda
  // but left the grid alone until the shift happened to cross a week boundary,
  // which reads as the arrows being broken.
  function shiftDay(delta: number) {
    const next = new Date(selectedDate)
    next.setDate(next.getDate() + delta * (mode === 'week' ? 7 : 1))
    setSelectedDate(next)
  }

  /**
   * Open the create dialog at a sensible time rather than inserting a stub.
   * The old button dropped an unnamed 09:00 meeting you could only rename or
   * delete, which is how two identical "New meeting 9:00 AM" rows appeared.
   */
  function openCreate(at?: Date) {
    if (at) {
      setCreateAt(at)
      return
    }
    const now = new Date()
    const base = sameDay(selectedDate, now) ? now : new Date(selectedDate)
    if (!sameDay(selectedDate, now)) base.setHours(9, 0, 0, 0)
    // Round up to the next quarter hour so the default is not 14:37.
    base.setMinutes(Math.ceil(base.getMinutes() / 15) * 15, 0, 0)
    setCreateAt(base)
  }

  return (
    <div className="flex h-full">
      <AutoSync connected={googleConnected} lastSyncAt={lastSyncAt} />

      {createAt && (
        <NewMeetingDialog
          people={people}
          initialStart={createAt}
          googleConnected={googleConnected}
          onClose={() => setCreateAt(null)}
        />
      )}
      <aside
        className="flex shrink-0 flex-col overflow-auto"
        style={{
          width: 'var(--agenda-width)',
          borderRight: '1px solid var(--color-hairline)',
        }}
      >
        <div className="flex items-center gap-1 px-3 py-3">
          <h1 className="m-0 flex-1 text-[length:var(--text-lg)] font-semibold">
            {selectedDate.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </h1>
          <NavButton label={mode === 'week' ? 'Previous week' : 'Previous day'} onClick={() => shiftDay(-1)}>
            ‹
          </NavButton>
          <NavButton label="Today" onClick={() => setSelectedDate(new Date())}>
            •
          </NavButton>
          <NavButton label={mode === 'week' ? 'Next week' : 'Next day'} onClick={() => shiftDay(1)}>
            ›
          </NavButton>
          {loadingSlice && (
            <span
              className="text-[length:var(--text-2xs)]"
              style={{ color: 'var(--color-text-tertiary)' }}
              role="status"
            >
              …
            </span>
          )}
          <SyncButton connected={googleConnected} />
        </div>

        <div
          className="mx-2 mb-2 flex gap-1 p-[2px]"
          style={{ borderRadius: 'var(--radius-row)', background: 'var(--color-sidebar)' }}
          role="tablist"
          aria-label="Calendar view"
        >
          {(['today', 'week'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className="flex-1 cursor-pointer border-0 py-[4px] text-[length:var(--text-sm)] font-medium capitalize"
              style={{
                borderRadius: 4,
                background: mode === m ? 'var(--color-canvas)' : 'transparent',
                color: mode === m ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              }}
            >
              {m}
            </button>
          ))}
        </div>

        <ConnectPrompt configured={googleConfigured} connected={googleConnected} />

        <div className="px-2 pb-2">
          <button
            type="button"
            onClick={() => openCreate()}
            className="w-full cursor-pointer px-3 py-[6px] text-left text-[length:var(--text-base)] font-medium"
            style={{
              borderRadius: 'var(--radius-row)',
              border: '1px solid var(--color-hairline)',
              background: 'transparent',
              color: 'var(--color-accent)',
            }}
          >
            + New meeting
          </button>
        </div>

        <div className="flex-1 px-2 pb-4">
          {dayMeetings.length === 0 && (
            <p className="px-2 py-6 text-[length:var(--text-base)]" style={{ color: 'var(--color-text-tertiary)' }}>
              Nothing scheduled.
            </p>
          )}

          {dayMeetings.map((meeting, i) => (
            <div key={meeting.id}>
              {i === nowLineIndex && <NowLine />}
              <AgendaCard meeting={meeting} onOpen={() => router.push(`/meetings/${meeting.id}`)} />
            </div>
          ))}

          {/* The now-line sits after every meeting once the day is done. */}
          {isToday && nowLineIndex === -1 && dayMeetings.length > 0 && <NowLine />}
        </div>
      </aside>

      <div className="min-w-0 flex-1 overflow-auto">
        {mode === 'week' ? (
          <WeekGrid
            meetings={weekMeetings}
            anchorDate={selectedDate}
            onSelect={(id) => router.push(`/meetings/${id}`)}
            onCreateAt={(at) => openCreate(at)}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-8">
            <p className="text-[length:var(--text-base)]" style={{ color: 'var(--color-text-tertiary)' }}>
              Select a meeting to open its note.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function NavButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="cursor-pointer border-0 bg-transparent px-[6px] py-[2px] text-[length:var(--text-base)] leading-none"
      style={{ color: 'var(--color-text-secondary)' }}
    >
      {children}
    </button>
  )
}

function NowLine() {
  return (
    <div className="my-1 flex items-center gap-2 px-2" aria-label="Now">
      <span className="text-[length:var(--text-2xs)] font-medium" style={{ color: 'var(--color-now)' }}>
        Now
      </span>
      <span className="h-px flex-1" style={{ background: 'var(--color-now)' }} />
    </div>
  )
}

function AgendaCard({ meeting, onOpen }: { meeting: Meeting; onOpen: () => void }) {
  const [hover, setHover] = useState(false)
  const start = new Date(meeting.startAt)
  const end = new Date(meeting.endAt)
  const fmt = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  // Fellow keeps declined meetings on the calendar and strikes them through,
  // rather than hiding them. Seeing what you turned down is the point.
  const declined = meeting.responseStatus === 'declined'

  return (
    <button
      type="button"
      data-testid="agenda-card"
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="mb-[2px] flex w-full cursor-pointer items-stretch gap-2 border-0 p-0 text-left"
      style={{
        borderRadius: 8,
        // Transparent when idle - no grey film, matching Fellow.
        background: hover ? 'var(--color-hover)' : 'transparent',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 3,
          borderRadius: 2,
          margin: '6px 0',
          background:
            meeting.kind === 'oneOnOne'
              ? 'var(--color-accent)'
              : 'var(--color-text-tertiary)',
        }}
      />
      <span className="min-w-0 flex-1 py-[6px] pr-2">
        <span className="flex items-center gap-[6px]">
          <span
            className="truncate text-[length:var(--text-md)] font-medium"
            style={{
              textDecoration: declined ? 'line-through' : undefined,
              color: declined ? 'var(--color-text-tertiary)' : undefined,
            }}
          >
            {meeting.title}
          </span>
          {meeting.kind === 'oneOnOne' && (
            <span
              className="shrink-0 px-[6px] text-[length:var(--text-2xs)] font-medium"
              style={{
                borderRadius: 'var(--radius-pill)',
                background: 'var(--color-accent-subtle)',
                color: 'var(--color-accent)',
              }}
            >
              1:1
            </span>
          )}
        </span>
        <span className="mt-[2px] flex items-center gap-2">
          <span
            className="text-[length:var(--text-sm)]"
            style={{
              color: 'var(--color-text-secondary)',
              textDecoration: declined ? 'line-through' : undefined,
            }}
          >
            {meeting.isAllDay ? 'All day' : `${fmt(start)} – ${fmt(end)}`}
          </span>
          {meeting.attendees.length > 0 && (
            <AvatarStack people={meeting.attendees} size={18} max={3} />
          )}
        </span>
      </span>
    </button>
  )
}
