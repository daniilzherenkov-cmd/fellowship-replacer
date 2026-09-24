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
import { useSearchParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { AvatarStack } from '../ui/Avatar'
import { createMeetingAction } from '@/actions'
import { WeekGrid, weekDaysFor } from './WeekGrid'
import { SyncButton } from './SyncButton'
import { ConnectPrompt } from './ConnectPrompt'
import { AutoSync } from './AutoSync'
import { NewMeetingDialog } from './NewMeetingDialog'
import { rememberRoute } from '@/lib/last-route'
import type { Meeting, Person } from '@/lib/queries'

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Local calendar date as YYYY-MM-DD. toISOString() would shift the day in any
 *  timezone behind UTC, which is how a date picked at 21:00 became tomorrow. */
function ymd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Put view state in the URL WITHOUT a server round trip.
 *
 * Which day you are on and whether you are in Week view have to survive a
 * reload: this page is `force-dynamic`, so routing through router.replace
 * would re-run the server component and make every arrow click and every
 * Today/Week toggle wait on a fetch. history.replaceState is understood by
 * the App Router, so the URL and the client state stay in step for free.
 *
 * It records the route itself because the RememberRoute effect hangs off
 * useSearchParams, and there is no guarantee a replaceState edit re-runs it.
 */
function patchUrl(updates: Record<string, string | null>): void {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  for (const [key, value] of Object.entries(updates)) {
    if (value === null) params.delete(key)
    else params.set(key, value)
  }
  const query = params.toString()
  const path = query ? `${window.location.pathname}?${query}` : window.location.pathname
  if (path === window.location.pathname + window.location.search) return
  window.history.replaceState(null, '', path)
  rememberRoute(path)
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
  note = null,
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
  /**
   * The selected meeting's note, rendered by the server and passed in as a
   * slot. Keeps this component free of data fetching while the note still
   * renders beside the agenda.
   */
  note?: React.ReactNode
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Seeded from the server's anchor so a shared or reloaded URL lands on the
  // right day. Local state keeps arrow clicks instant; the effect below only
  // re-anchors when the user leaves the slice the server sent.
  const [selectedDate, setSelectedDate] = useState(() =>
    anchorDate ? new Date(anchorDate) : new Date(),
  )
  const [createAt, setCreateAt] = useState<Date | null>(null)
  const [loadingSlice, startTransition] = useTransition()
  /**
   * Today or Week, seeded from the URL.
   *
   * This used to be plain client state, so a reload always dropped you back
   * into Today even though the rest of the screen was restored. The toggle
   * writes `?v=week` back into the URL, which also makes the view part of
   * what "reopen where I left off" restores.
   */
  const [mode, setMode] = useState<'today' | 'week'>(() =>
    searchParams.get('v') === 'week' ? 'week' : 'today',
  )

  /** Which note is open, so the agenda can show which card you are reading. */
  const openNoteId = searchParams.get('note')

  function selectMode(next: 'today' | 'week') {
    setMode(next)
    // An open note fills the right pane in both views, so the toggle would
    // look dead while one is up. Switching the view closes it.
    if (openNoteId) {
      const query = new URLSearchParams(window.location.search)
      query.delete('note')
      if (next === 'week') query.set('v', 'week')
      else query.delete('v')
      const qs = query.toString()
      startTransition(() => router.replace(qs ? `/calendar?${qs}` : '/calendar', { scroll: false }))
      return
    }
    patchUrl({ v: next === 'week' ? 'week' : null })
  }

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

    const params = new URLSearchParams(
      typeof window === 'undefined' ? '' : window.location.search,
    )
    // Keep ?note= and ?v=: re-anchoring is a data fetch, not a change of view.
    params.set('d', ymd(selectedDate))
    startTransition(() => router.replace(`/calendar?${params.toString()}`, { scroll: false }))
  }, [selectedDate, windowFrom, windowTo, router])

  /**
   * Mirror the selected day into the URL so a reload lands on it.
   *
   * Cleared when the day IS today, on purpose: coming back tomorrow should
   * open tomorrow, not pin you to the date you happened to close the tab on.
   */
  useEffect(() => {
    patchUrl({ d: sameDay(selectedDate, new Date()) ? null : ymd(selectedDate) })
  }, [selectedDate])

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
   * Open a note WITHOUT leaving the calendar.
   *
   * This used to router.push to /meetings/[id], which replaced the whole
   * screen and took the agenda with it. Fellow keeps the day's list on the
   * left and renders the note beside it, so you can move between meetings
   * without going back each time.
   *
   * A search param rather than client state, so the note survives a reload
   * and can be linked to. /meetings/[id] still exists for direct links from
   * search and back-links.
   */
  function openNote(meetingId: string) {
    // Read the live URL rather than useSearchParams: ?d= and ?v= are written
    // with history.replaceState, which the hook is not guaranteed to observe.
    const query = new URLSearchParams(window.location.search)
    query.set('note', meetingId)
    startTransition(() => router.replace(`/calendar?${query.toString()}`, { scroll: false }))
  }

  /**
   * Close the note and go back to whatever was behind it.
   *
   * Without this there was no way out of a note opened from the week grid:
   * the note replaces the grid, and the only route back was editing the URL.
   */
  function closeNote() {
    const query = new URLSearchParams(window.location.search)
    query.delete('note')
    const qs = query.toString()
    startTransition(() => router.replace(qs ? `/calendar?${qs}` : '/calendar', { scroll: false }))
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
              onClick={() => selectMode(m)}
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
              <AgendaCard
                meeting={meeting}
                selected={meeting.id === openNoteId}
                onOpen={() => openNote(meeting.id)}
              />
            </div>
          ))}

          {/* The now-line sits after every meeting once the day is done. */}
          {isToday && nowLineIndex === -1 && dayMeetings.length > 0 && <NowLine />}
        </div>
      </aside>

      <div className="min-w-0 flex-1 overflow-auto">
        {note ? (
          <div className="relative h-full">
            <button
              type="button"
              onClick={closeNote}
              data-testid="close-note"
              className="absolute right-3 top-3 z-10 cursor-pointer px-[10px] py-[3px] text-[length:var(--text-sm)] font-medium"
              style={{
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--color-hairline)',
                background: 'var(--color-canvas)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {mode === 'week' ? '‹ Week' : '‹ Close'}
            </button>
            {note}
          </div>
        ) : mode === 'week' ? (
          <WeekGrid
            meetings={weekMeetings}
            anchorDate={selectedDate}
            onSelect={(id) => openNote(id)}
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

function AgendaCard({
  meeting,
  onOpen,
  selected = false,
}: {
  meeting: Meeting
  onOpen: () => void
  /** The note open beside the agenda. Light-blue tint, accent title; never
   *  the solid-blue list selection, as the header comment explains. */
  selected?: boolean
}) {
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
        background: selected
          ? 'var(--color-accent-subtle)'
          : hover
            ? 'var(--color-hover)'
            : 'transparent',
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
              color: declined
                ? 'var(--color-text-tertiary)'
                : selected
                  ? 'var(--color-accent)'
                  : undefined,
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
