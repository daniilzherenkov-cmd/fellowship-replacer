/**
 * Week grid layout tests.
 *
 * The grid is time-proportional: a block's height IS its duration, so these
 * assertions are about geometry, not appearance. They exist because the layout
 * has real edge cases (overlaps, long background blocks, sub-30-minute
 * meetings) that are easy to regress and hard to spot by eye.
 */

import { test, expect } from '@playwright/test'
import { layoutDay, weekDaysFor, weekTitle } from '../../src/components/calendar/WeekGrid'
import type { Meeting } from '../../src/lib/queries'

const HOUR = 48 // must match HOUR_HEIGHT

function meeting(
  id: string,
  startHour: number,
  startMin: number,
  durationMin: number,
  title = id,
): Meeting {
  const start = new Date(2026, 8, 8, startHour, startMin, 0, 0)
  const end = new Date(start.getTime() + durationMin * 60_000)
  return {
    id,
    title,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    kind: 'team',
    notepad: '',
    externalId: null,
    attendees: [],
  }
}

test.describe('vertical placement', () => {
  test('height is proportional to duration', () => {
    const [short, long] = layoutDay([
      meeting('a', 9, 0, 30),
      meeting('b', 11, 0, 120),
    ])
    expect(short.height).toBeCloseTo(HOUR / 2, 0)
    expect(long.height).toBeCloseTo(HOUR * 2, 0)
    // The whole point of the rewrite: a 2h block is 4x a 30m block.
    expect(long.height / short.height).toBeCloseTo(4, 1)
  })

  test('top reflects the start time', () => {
    // Day starts at 07:00, so a 09:30 meeting sits 2.5 hours down.
    const [item] = layoutDay([meeting('a', 9, 30, 60)])
    expect(item.top).toBeCloseTo(2.5 * HOUR, 0)
  })

  test('very short meetings keep a readable minimum height', () => {
    const [item] = layoutDay([meeting('a', 9, 0, 10)])
    // 10 minutes would be 8px, which cannot show a title.
    expect(item.height).toBeGreaterThanOrEqual(18)
  })
})

test.describe('horizontal placement', () => {
  test('a lone meeting takes the full width', () => {
    const [item] = layoutDay([meeting('a', 9, 0, 60)])
    expect(item.widthPct).toBe(100)
    expect(item.leftPct).toBe(0)
  })

  test('back-to-back meetings both stay full width', () => {
    const items = layoutDay([meeting('a', 9, 0, 60), meeting('b', 10, 0, 60)])
    // Touching but not overlapping - neither should be narrowed.
    for (const item of items) expect(item.widthPct).toBe(100)
  })

  test('two genuinely overlapping meetings split the width', () => {
    const items = layoutDay([meeting('a', 9, 0, 60), meeting('b', 9, 30, 60)])
    for (const item of items) expect(item.widthPct).toBeCloseTo(50, 0)
    expect(items[0].leftPct).toBe(0)
    expect(items[1].leftPct).toBeCloseTo(50, 0)
  })

  test('a long background block takes a narrow lane, not half the column', () => {
    // The real case from Danya's calendar: a 3h focus block containing a
    // 15-minute standup. Splitting 50/50 makes the standup unreadable.
    const items = layoutDay([
      meeting('focus', 9, 0, 180, 'Deep Work Block'),
      meeting('standup', 10, 0, 15, 'Shops Science standup'),
    ])
    const focus = items.find((i) => i.meeting.id === 'focus')!
    const standup = items.find((i) => i.meeting.id === 'standup')!

    expect(focus.widthPct).toBeLessThan(30)
    // The real meeting keeps most of the column.
    expect(standup.widthPct).toBeGreaterThan(70)
    expect(standup.leftPct).toBeGreaterThan(0)
  })

  test('meetings inside a background block still split among themselves', () => {
    const items = layoutDay([
      meeting('focus', 9, 0, 180, 'Deep Work Block'),
      meeting('a', 10, 0, 60),
      meeting('b', 10, 30, 60),
    ])
    const a = items.find((i) => i.meeting.id === 'a')!
    const b = items.find((i) => i.meeting.id === 'b')!
    // Two overlapping foreground meetings share the non-background width.
    expect(a.widthPct).toBeCloseTo(b.widthPct, 0)
    expect(a.widthPct).toBeLessThan(50)
    expect(b.leftPct).toBeGreaterThan(a.leftPct)
  })

  test('never overflows the column', () => {
    const items = layoutDay([
      meeting('focus', 9, 0, 200),
      meeting('a', 9, 30, 60),
      meeting('b', 10, 0, 60),
      meeting('c', 10, 15, 30),
    ])
    for (const item of items) {
      expect(item.leftPct + item.widthPct).toBeLessThanOrEqual(100.01)
    }
  })
})

test.describe('all-day events', () => {
  test('are excluded from the timed layout', () => {
    // They render in the pinned header band instead.
    const items = layoutDay([meeting('holiday', 0, 0, 24 * 60), meeting('real', 9, 0, 60)])
    expect(items).toHaveLength(1)
    expect(items[0].meeting.id).toBe('real')
  })
})

test.describe('week helpers', () => {
  test('weekDaysFor returns seven Sunday-first days', () => {
    const days = weekDaysFor(new Date(2026, 8, 8)) // a Tuesday
    expect(days).toHaveLength(7)
    expect(days[0].getDay()).toBe(0)
    expect(days[6].getDay()).toBe(6)
    expect(days.some((d) => d.getDate() === 8)).toBe(true)
  })

  test('weekTitle says "This week" only when it contains today', () => {
    const now = new Date(2026, 8, 8)
    expect(weekTitle(weekDaysFor(now), now)).toBe('This week')
    const other = weekDaysFor(new Date(2026, 8, 22))
    expect(weekTitle(other, now)).toMatch(/Sep \d+ – Sep \d+/)
  })
})
