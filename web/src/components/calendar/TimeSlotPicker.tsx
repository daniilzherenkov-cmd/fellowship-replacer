'use client'

/**
 * Pick a time by dragging on a day column, the way Fellow and Google Calendar
 * do it.
 *
 * Two <input type="datetime-local"> fields are precise and horrible: you tab
 * through five segments to say "Tuesday afternoon". Fellow shows the week and
 * lets you draw the box. Danya asked for that specifically.
 *
 * The typed fields stay as the accessible path and the keyboard fallback -
 * dragging is an addition, not a replacement, because a drag target cannot be
 * operated by a screen reader or a keyboard.
 */

import { useMemo, useRef, useState } from 'react'

const HOUR_HEIGHT = 34
const DAY_START_HOUR = 7
const DAY_END_HOUR = 22
/** Google's granularity, and fine enough that a shaky drag still lands well. */
const SNAP_MINUTES = 15
const MIN_MINUTES = 15

function startOfWeek(d: Date): Date {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  out.setDate(out.getDate() - out.getDay())
  return out
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Minutes from the top of the visible day, snapped. */
function snapMinutes(y: number): number {
  const raw = (y / HOUR_HEIGHT) * 60
  const snapped = Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES
  const max = (DAY_END_HOUR - DAY_START_HOUR) * 60
  return Math.min(Math.max(0, snapped), max)
}

function atMinutes(day: Date, minutes: number): Date {
  const out = new Date(day)
  out.setHours(DAY_START_HOUR, 0, 0, 0)
  out.setMinutes(out.getMinutes() + minutes)
  return out
}

export function TimeSlotPicker({
  start,
  end,
  onChange,
}: {
  start: Date
  end: Date
  onChange: (start: Date, end: Date) => void
}) {
  const [weekOf, setWeekOf] = useState(() => startOfWeek(start))
  // While dragging, the provisional selection; null when idle.
  const [drag, setDrag] = useState<{ day: Date; from: number; to: number } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekOf)
      d.setDate(d.getDate() + i)
      return d
    }),
    [weekOf],
  )

  const hours = useMemo(
    () => Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i),
    [],
  )

  function commit(day: Date, from: number, to: number) {
    const lo = Math.min(from, to)
    const hi = Math.max(from, to)
    // A click with no movement means "30 minutes here", not a zero-length event.
    const span = hi - lo < MIN_MINUTES ? 30 : hi - lo
    onChange(atMinutes(day, lo), atMinutes(day, lo + span))
  }

  function selectionFor(day: Date): { top: number; height: number } | null {
    if (drag && sameDay(drag.day, day)) {
      const lo = Math.min(drag.from, drag.to)
      const hi = Math.max(drag.from, drag.to)
      return {
        top: (lo / 60) * HOUR_HEIGHT,
        height: Math.max(((hi - lo) / 60) * HOUR_HEIGHT, 6),
      }
    }
    if (!drag && sameDay(start, day)) {
      const from = (start.getHours() - DAY_START_HOUR) * 60 + start.getMinutes()
      const to = (end.getHours() - DAY_START_HOUR) * 60 + end.getMinutes()
      return {
        top: (from / 60) * HOUR_HEIGHT,
        height: Math.max(((to - from) / 60) * HOUR_HEIGHT, 6),
      }
    }
    return null
  }

  function shiftWeek(delta: number) {
    const next = new Date(weekOf)
    next.setDate(next.getDate() + delta * 7)
    setWeekOf(next)
  }

  return (
    <div
      className="mb-3"
      style={{ border: '1px solid var(--color-hairline)', borderRadius: 'var(--radius-card)' }}
    >
      <div className="flex items-center gap-2 px-2 py-[6px]">
        <button
          type="button"
          onClick={() => shiftWeek(-1)}
          aria-label="Previous week"
          className="cursor-pointer border-0 bg-transparent px-1 text-[length:var(--text-sm)]"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          ‹
        </button>
        <span className="flex-1 text-center text-[length:var(--text-sm)] font-medium">
          {days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} –{' '}
          {days[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
        <button
          type="button"
          onClick={() => shiftWeek(1)}
          aria-label="Next week"
          className="cursor-pointer border-0 bg-transparent px-1 text-[length:var(--text-sm)]"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          ›
        </button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '34px repeat(7, minmax(0, 1fr))' }}>
        <span />
        {days.map((d) => (
          <span
            key={d.toISOString()}
            className="pb-1 text-center text-[length:var(--text-2xs)]"
            style={{
              color: sameDay(d, start) ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              fontWeight: sameDay(d, start) ? 600 : 400,
            }}
          >
            {d.toLocaleDateString('en-US', { weekday: 'narrow' })} {d.getDate()}
          </span>
        ))}
      </div>

      <div ref={scrollRef} className="overflow-auto" style={{ maxHeight: 210 }}>
        <div className="grid" style={{ gridTemplateColumns: '34px repeat(7, minmax(0, 1fr))' }}>
          <div className="relative" style={{ height: hours.length * HOUR_HEIGHT }}>
            {hours.map((h) => (
              <span
                key={h}
                className="absolute right-1 text-[length:var(--text-3xs)]"
                style={{
                  top: (h - DAY_START_HOUR) * HOUR_HEIGHT - 5,
                  color: 'var(--color-text-tertiary)',
                }}
              >
                {h % 12 === 0 ? 12 : h % 12}
                {h < 12 ? 'a' : 'p'}
              </span>
            ))}
          </div>

          {days.map((day) => {
            const sel = selectionFor(day)
            return (
              <div
                key={day.toISOString()}
                className="relative"
                style={{
                  height: hours.length * HOUR_HEIGHT,
                  borderLeft: '1px solid var(--color-hairline)',
                  cursor: 'crosshair',
                  touchAction: 'none',
                }}
                onPointerDown={(e) => {
                  ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
                  const rect = e.currentTarget.getBoundingClientRect()
                  const m = snapMinutes(e.clientY - rect.top)
                  setDrag({ day, from: m, to: m })
                }}
                onPointerMove={(e) => {
                  if (!drag || !sameDay(drag.day, day)) return
                  const rect = e.currentTarget.getBoundingClientRect()
                  setDrag({ ...drag, to: snapMinutes(e.clientY - rect.top) })
                }}
                onPointerUp={() => {
                  if (!drag) return
                  commit(drag.day, drag.from, drag.to)
                  setDrag(null)
                }}
              >
                {hours.map((h) => (
                  <div
                    key={h}
                    className="pointer-events-none absolute inset-x-0"
                    style={{
                      top: (h - DAY_START_HOUR) * HOUR_HEIGHT,
                      borderTop: '1px solid var(--color-hairline)',
                    }}
                  />
                ))}
                {sel && (
                  <div
                    className="pointer-events-none absolute inset-x-[2px]"
                    style={{
                      top: sel.top,
                      height: sel.height,
                      borderRadius: 4,
                      background: 'var(--color-accent)',
                      opacity: 0.85,
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
