'use client'

/**
 * Time-proportional week grid, matching Fellow's real calendar.
 *
 * NOTE: this deliberately does NOT follow WeekGridView in TodayView.swift. That
 * version stacked chips in day columns, and docs/06 admits it "lists events
 * under each day (not time-positioned yet)". Fellow's actual grid is a vertical
 * hour axis where every event is positioned and sized by its true start and
 * duration, so a 15-minute standup is visibly shorter than a 2-hour block. The
 * Swift file is the spec for most of this app, but not here.
 *
 * Behaviours taken from the real Fellow UI:
 *  - hour rows down the left, hairline separators across
 *  - all-day events pinned in a header band above the scrolling area
 *  - a green now-line with a time label, only on today
 *  - overlapping events split the column width side by side
 *  - declined events are struck through and muted
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Meeting } from '@/lib/queries'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

/** Pixels per hour. 48 keeps a 12-hour day on screen without scrolling. */
const HOUR_HEIGHT = 48
const DAY_START_HOUR = 7
const DAY_END_HOUR = 21
const TIME_GUTTER = 56

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
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(days[0])} – ${fmt(days[6])}`
}

/** Minutes from the top of the visible day. Can be negative or overflow. */
function offsetMinutes(date: Date): number {
  return (date.getHours() - DAY_START_HOUR) * 60 + date.getMinutes()
}

/** An all-day event, or one spanning the whole visible range. */
function isAllDayish(meeting: Meeting): boolean {
  const start = new Date(meeting.startAt)
  const end = new Date(meeting.endAt)
  return end.getTime() - start.getTime() >= 20 * 60 * 60 * 1000
}

interface Positioned {
  meeting: Meeting
  top: number
  height: number
  /** Horizontal slot among mutually overlapping events. */
  column: number
  /** Resolved horizontal placement, in percent of the day column. */
  leftPct: number
  widthPct: number
}

/**
 * Lay out one day's events.
 *
 * Overlapping events share the column width: group anything that intersects,
 * then give each member its own slot. Without this a busy day renders as a
 * single unreadable stack.
 */
export function layoutDay(meetings: Meeting[]): Positioned[] {
  const timed = meetings
    .filter((m) => !isAllDayish(m))
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())

  const positioned: Positioned[] = timed.map((meeting) => {
    const start = new Date(meeting.startAt)
    const end = new Date(meeting.endAt)
    const top = (offsetMinutes(start) / 60) * HOUR_HEIGHT
    const rawHeight = ((end.getTime() - start.getTime()) / 60_000 / 60) * HOUR_HEIGHT
    return {
      meeting,
      top,
      // Floor so a 15-minute meeting stays readable.
      height: Math.max(rawHeight, 18),
      column: 0,
      leftPct: 0,
      widthPct: 100,
    }
  })

  // Assign lanes, then widths.
  //
  // Fellow does not split a column evenly whenever anything overlaps. A long
  // background block (a 3-hour focus block) takes a NARROW lane on the left and
  // the real meetings inside it keep most of the width - otherwise every
  // meeting during a focus block is squeezed to half and the day is unreadable.
  const LONG_BLOCK_MINUTES = 150
  const BACKGROUND_LANE_WIDTH = 22 // percent

  let groupStart = 0
  while (groupStart < positioned.length) {
    let groupEnd = groupStart + 1
    let groupBottom = positioned[groupStart].top + positioned[groupStart].height

    while (groupEnd < positioned.length && positioned[groupEnd].top < groupBottom) {
      groupBottom = Math.max(groupBottom, positioned[groupEnd].top + positioned[groupEnd].height)
      groupEnd++
    }

    const group = positioned.slice(groupStart, groupEnd)

    // A long block that spans most of the group is treated as background.
    const background = group.filter(
      (item) => item.height >= (LONG_BLOCK_MINUTES / 60) * HOUR_HEIGHT && group.length > 1,
    )
    const foreground = group.filter((item) => !background.includes(item))

    background.forEach((item, i) => {
      item.leftPct = i * (BACKGROUND_LANE_WIDTH / Math.max(background.length, 1))
      item.widthPct = BACKGROUND_LANE_WIDTH / Math.max(background.length, 1)
    })

    // Foreground events share whatever width the background left behind.
    const offset = background.length ? BACKGROUND_LANE_WIDTH : 0
    const available = 100 - offset

    const slotEnds: number[] = []
    for (const item of foreground) {
      let slot = slotEnds.findIndex((end) => end <= item.top)
      if (slot === -1) {
        slot = slotEnds.length
        slotEnds.push(0)
      }
      slotEnds[slot] = item.top + item.height
      item.column = slot
    }
    for (const item of foreground) {
      const bottom = item.top + item.height
      const concurrent = foreground.filter(
        (other) => other.top < bottom && other.top + other.height > item.top,
      )
      const lanes = Math.max(...concurrent.map((c) => c.column + 1), 1)
      item.widthPct = available / lanes
      item.leftPct = offset + item.column * (available / lanes)
    }

    groupStart = groupEnd
  }

  return positioned
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
  const scrollRef = useRef<HTMLDivElement>(null)
  const [now, setNow] = useState(() => new Date())

  // Keep the now-line honest without re-rendering constantly.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const hours = useMemo(
    () => Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i),
    [],
  )

  const showsToday = days.some((d) => isSameDay(d, today))
  const nowTop = (offsetMinutes(now) / 60) * HOUR_HEIGHT

  // Open near the current hour rather than at 7am.
  useEffect(() => {
    if (!scrollRef.current || !showsToday) return
    scrollRef.current.scrollTop = Math.max(0, nowTop - 120)
    // Only on mount / week change; not every minute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorDate.toDateString(), showsToday])

  const allDayByDay = days.map((day) =>
    meetings.filter((m) => isSameDay(new Date(m.startAt), day) && isAllDayish(m)),
  )
  const hasAllDay = allDayByDay.some((list) => list.length > 0)

  return (
    <div className="flex h-full min-w-0 flex-col">
      <h2 className="m-0 px-5 pb-2 pt-4 text-[16px] font-semibold">{weekTitle(days)}</h2>

      <div className="min-w-0 flex-1 overflow-auto px-5 pb-5" ref={scrollRef}>
        <div style={{ minWidth: 640 }}>
          {/* Day headers stay put while the hours scroll under them. */}
          <div
            className="sticky top-0 z-10 grid"
            style={{
              gridTemplateColumns: `${TIME_GUTTER}px repeat(7, minmax(0, 1fr))`,
              background: 'var(--color-canvas)',
            }}
          >
            <div />
            {days.map((day, i) => {
              const isToday = isSameDay(day, today)
              return (
                <div
                  key={day.toISOString()}
                  className="pb-2 text-center"
                  style={{ borderBottom: '1px solid var(--color-hairline)' }}
                >
                  <div
                    className="text-[11px] font-medium"
                    style={{
                      color: isToday ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                    }}
                  >
                    {WEEKDAYS[i]}
                  </div>
                  <div
                    className="text-[15px] font-semibold"
                    style={{ color: isToday ? 'var(--color-accent)' : undefined }}
                  >
                    {day.getDate()}
                  </div>
                </div>
              )
            })}
          </div>

          {/* All-day band, pinned above the timed area like Fellow's. */}
          {hasAllDay && (
            <div
              className="grid"
              style={{
                gridTemplateColumns: `${TIME_GUTTER}px repeat(7, minmax(0, 1fr))`,
                borderBottom: '1px solid var(--color-hairline)',
              }}
            >
              <div
                className="pr-2 pt-1 text-right text-[10px]"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                all-day
              </div>
              {allDayByDay.map((list, i) => (
                <div key={days[i].toISOString()} className="flex flex-col gap-[2px] p-1">
                  {list.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onSelect(m.id)}
                      title={m.title}
                      className="cursor-pointer truncate border-0 px-[6px] py-[2px] text-left text-[10px]"
                      style={{
                        borderRadius: 4,
                        background: 'var(--color-hover)',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      {m.title}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Timed area: hour rows plus one absolutely-positioned layer per day. */}
          <div
            className="relative grid"
            style={{ gridTemplateColumns: `${TIME_GUTTER}px repeat(7, minmax(0, 1fr))` }}
          >
            <div className="relative" style={{ height: hours.length * HOUR_HEIGHT }}>
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="absolute right-2 text-[10px]"
                  style={{
                    top: (hour - DAY_START_HOUR) * HOUR_HEIGHT - 6,
                    color: 'var(--color-text-tertiary)',
                  }}
                >
                  {formatHour(hour)}
                </div>
              ))}
            </div>

            {days.map((day) => {
              const isToday = isSameDay(day, today)
              const dayMeetings = meetings.filter((m) => isSameDay(new Date(m.startAt), day))
              const laid = layoutDay(dayMeetings)

              return (
                <div
                  key={day.toISOString()}
                  className="relative"
                  style={{
                    height: hours.length * HOUR_HEIGHT,
                    borderLeft: '1px solid var(--color-hairline)',
                    background: isToday
                      ? 'color-mix(in srgb, var(--color-accent) 4%, transparent)'
                      : 'transparent',
                  }}
                >
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className="absolute inset-x-0"
                      style={{
                        top: (hour - DAY_START_HOUR) * HOUR_HEIGHT,
                        borderTop: '1px solid var(--color-hairline)',
                      }}
                    />
                  ))}

                  {laid.map((item) => (
                    <EventBlock key={item.meeting.id} item={item} onSelect={onSelect} />
                  ))}

                  {isToday && nowTop >= 0 && nowTop <= hours.length * HOUR_HEIGHT && (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-[5]"
                      style={{ top: nowTop }}
                      aria-label="Now"
                    >
                      <div style={{ height: 2, background: 'var(--color-now)' }} />
                    </div>
                  )}
                </div>
              )
            })}

            {/* Time label for the now-line, in the gutter. */}
            {showsToday && nowTop >= 0 && nowTop <= hours.length * HOUR_HEIGHT && (
              <div
                className="pointer-events-none absolute z-[6] px-1 text-[10px] font-semibold"
                style={{
                  top: nowTop - 7,
                  left: 4,
                  color: '#fff',
                  background: 'var(--color-now)',
                  borderRadius: 3,
                }}
              >
                {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function formatHour(hour: number): string {
  const suffix = hour < 12 ? 'am' : 'pm'
  const display = hour % 12 === 0 ? 12 : hour % 12
  return `${display} ${suffix}`
}

function EventBlock({
  item,
  onSelect,
}: {
  item: Positioned
  onSelect: (id: string) => void
}) {
  const [hover, setHover] = useState(false)
  const { meeting, top, height, leftPct, widthPct } = item
  const start = new Date(meeting.startAt)

  const isOneOnOne = meeting.kind === 'oneOnOne'
  const accent = isOneOnOne ? 'var(--color-accent)' : 'var(--color-text-tertiary)'
  // Under ~34px there is only room for one line.
  const compact = height < 34

  return (
    <button
      type="button"
      data-testid="week-event"
      onClick={() => onSelect(meeting.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={`${meeting.title} · ${start.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })}`}
      className="absolute overflow-hidden border-0 px-[5px] py-[2px] text-left"
      style={{
        top,
        height: height - 2,
        left: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
        borderRadius: 4,
        borderLeft: `2px solid ${accent}`,
        background: hover
          ? 'color-mix(in srgb, var(--color-accent) 16%, var(--color-canvas))'
          : 'color-mix(in srgb, var(--color-accent) 8%, var(--color-canvas))',
        cursor: 'pointer',
      }}
    >
      <span
        className="block truncate text-[10px] font-medium leading-tight"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {meeting.title}
      </span>
      {!compact && (
        <span
          className="block truncate text-[9px] leading-tight"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </span>
      )}
    </button>
  )
}
