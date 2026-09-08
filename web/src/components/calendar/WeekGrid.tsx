'use client'

/**
 * Week grid. Port of WeekGridView / DayColumn in TodayView.swift.
 *
 * Seven equal Sunday-first columns separated by 1px gaps over a hairline
 * background, which is how the Swift version faked grid lines rather than
 * drawing borders per cell. Today's column is tinted accent-subtle, and the
 * title reads "This week" when the range contains today.
 */

import { useState } from 'react'
import type { Meeting } from '@/lib/queries'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export function weekDaysFor(anchor: Date): Date[] {
  const base = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())
  const sunday = new Date(base)
  sunday.setDate(base.getDate() - base.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday)
    d.setDate(sunday.getDate() + i)
    return d
  })
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function weekTitle(days: Date[], now = new Date()): string {
  if (days.some((d) => isSameDay(d, now))) return 'This week'
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(days[0])} – ${fmt(days[6])}`
}

export function WeekGrid({
  meetings,
  anchorDate,
  onSelect,
}: {
  meetings: Meeting[]
  anchorDate: Date
  onSelect: (id: string) => void
}) {
  const days = weekDaysFor(anchorDate)
  const today = new Date()

  return (
    <div className="flex h-full flex-col p-5">
      <h2 className="m-0 mb-3 text-[16px] font-semibold">{weekTitle(days)}</h2>

      {/* Seven columns need real width. Rather than crushing them when the
          agenda panel is open on a narrow window, scroll horizontally - the
          chips stay readable. */}
      <div className="min-w-0 overflow-x-auto">
        <div
          className="grid grid-cols-7 overflow-hidden"
          style={{
            gap: 1,
            // The 1px gaps let this background show through as grid lines.
            background: 'var(--color-hairline)',
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--radius-card)',
            minHeight: 220,
            minWidth: 560,
          }}
        >
          {days.map((day, i) => (
            <DayColumn
              key={day.toISOString()}
              weekday={WEEKDAYS[i]}
              date={day}
              isToday={isSameDay(day, today)}
              meetings={meetings.filter((m) => isSameDay(new Date(m.startAt), day))}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function DayColumn({
  weekday,
  date,
  isToday,
  meetings,
  onSelect,
}: {
  weekday: string
  date: Date
  isToday: boolean
  meetings: Meeting[]
  onSelect: (id: string) => void
}) {
  return (
    <div
      className="flex flex-col gap-[6px] p-2"
      style={{
        background: isToday ? 'var(--color-accent-subtle)' : 'var(--color-canvas)',
        minHeight: 220,
      }}
    >
      <span
        className="text-[12px] font-semibold"
        style={{ color: isToday ? 'var(--color-accent)' : 'var(--color-text-primary)' }}
      >
        {weekday}
      </span>
      <span
        className="text-[15px] font-medium"
        style={{ color: isToday ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}
      >
        {date.getDate()}
      </span>

      {meetings.map((meeting) => (
        <EventChip key={meeting.id} meeting={meeting} onSelect={onSelect} />
      ))}
    </div>
  )
}

function EventChip({
  meeting,
  onSelect,
}: {
  meeting: Meeting
  onSelect: (id: string) => void
}) {
  const [hover, setHover] = useState(false)
  const start = new Date(meeting.startAt)

  return (
    <button
      type="button"
      data-testid="week-event"
      onClick={() => onSelect(meeting.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={meeting.title}
      className="w-full cursor-pointer border-0 px-[6px] py-1 text-left"
      style={{
        borderRadius: 4,
        // 2px accent left edge, matching the Swift chip.
        borderLeft: `2px solid ${
          meeting.kind === 'oneOnOne'
            ? 'var(--color-accent)'
            : 'var(--color-text-tertiary)'
        }`,
        background: hover ? 'var(--color-hover)' : 'transparent',
      }}
    >
      <span className="block truncate text-[11px] font-medium leading-tight">
        {meeting.title}
      </span>
      <span className="block text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
        {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
      </span>
    </button>
  )
}
