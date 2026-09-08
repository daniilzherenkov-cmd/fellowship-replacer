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

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AvatarStack } from '../ui/Avatar'
import { createMeetingAction } from '@/actions'
import { WeekGrid, weekDaysFor } from './WeekGrid'
import type { Meeting } from '@/lib/queries'

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function CalendarView({ meetings }: { meetings: Meeting[] }) {
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [creating, setCreating] = useState(false)
  const [mode, setMode] = useState<'today' | 'week'>('today')

  const dayMeetings = useMemo(
    () => meetings.filter((m) => sameDay(new Date(m.startAt), selectedDate)),
    [meetings, selectedDate],
  )

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

  function shiftDay(delta: number) {
    const next = new Date(selectedDate)
    next.setDate(next.getDate() + delta)
    setSelectedDate(next)
  }

  async function newMeeting() {
    setCreating(true)
    const start = new Date(selectedDate)
    start.setHours(9, 0, 0, 0)
    const end = new Date(start.getTime() + 30 * 60_000)
    const { id } = await createMeetingAction({
      title: 'New meeting',
      startAt: start.toISOString(),
      endAt: end.toISOString(),
    })
    router.push(`/meetings/${id}`)
  }

  return (
    <div className="flex h-full">
      <aside
        className="flex shrink-0 flex-col overflow-auto"
        style={{
          width: 'var(--agenda-width)',
          borderRight: '1px solid var(--color-hairline)',
        }}
      >
        <div className="flex items-center gap-1 px-3 py-3">
          <h1 className="m-0 flex-1 text-[15px] font-semibold">
            {selectedDate.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </h1>
          <NavButton label="Previous day" onClick={() => shiftDay(-1)}>
            ‹
          </NavButton>
          <NavButton label="Today" onClick={() => setSelectedDate(new Date())}>
            •
          </NavButton>
          <NavButton label="Next day" onClick={() => shiftDay(1)}>
            ›
          </NavButton>
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
              className="flex-1 cursor-pointer border-0 py-[4px] text-[12px] font-medium capitalize"
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

        <div className="px-2 pb-2">
          <button
            type="button"
            onClick={newMeeting}
            disabled={creating}
            className="w-full cursor-pointer px-3 py-[6px] text-left text-[13px] font-medium"
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
            <p className="px-2 py-6 text-[13px]" style={{ color: 'var(--color-text-tertiary)' }}>
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
          />
        ) : (
          <div className="flex h-full items-center justify-center p-8">
            <p className="text-[13px]" style={{ color: 'var(--color-text-tertiary)' }}>
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
      className="cursor-pointer border-0 bg-transparent px-[6px] py-[2px] text-[13px] leading-none"
      style={{ color: 'var(--color-text-secondary)' }}
    >
      {children}
    </button>
  )
}

function NowLine() {
  return (
    <div className="my-1 flex items-center gap-2 px-2" aria-label="Now">
      <span className="text-[10px] font-medium" style={{ color: 'var(--color-now)' }}>
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
          <span className="truncate text-[14px] font-medium">{meeting.title}</span>
          {meeting.kind === 'oneOnOne' && (
            <span
              className="shrink-0 px-[6px] text-[10px] font-medium"
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
          <span className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
            {fmt(start)} – {fmt(end)}
          </span>
          {meeting.attendees.length > 0 && (
            <AvatarStack people={meeting.attendees} size={18} max={3} />
          )}
        </span>
      </span>
    </button>
  )
}
