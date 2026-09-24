/**
 * The "50m left" chip. Pure logic, no browser.
 */

import { test, expect } from '@playwright/test'
import { timeLeftLabel } from '../../src/components/note/time-left'

const start = '2026-09-23T10:00:00.000Z'
const end = '2026-09-23T11:00:00.000Z'
const at = (iso: string) => new Date(iso).getTime()

test.describe('timeLeftLabel', () => {
  test('counts down while the meeting is running', () => {
    expect(timeLeftLabel(start, end, at('2026-09-23T10:10:00Z'))).toBe('50m left')
  })

  test('says nothing once it is over', () => {
    // A stale "0m left" on yesterday's note would be worse than no chip.
    expect(timeLeftLabel(start, end, at('2026-09-23T11:00:01Z'))).toBeNull()
  })

  test('says nothing when it is hours away', () => {
    expect(timeLeftLabel(start, end, at('2026-09-23T06:00:00Z'))).toBeNull()
  })

  test('warns once it is within the hour', () => {
    expect(timeLeftLabel(start, end, at('2026-09-23T09:45:00Z'))).toBe('in 15m')
  })

  test('formats spans over an hour', () => {
    const long = '2026-09-23T13:00:00.000Z'
    expect(timeLeftLabel(start, long, at('2026-09-23T10:00:00Z'))).toBe('3h left')
    expect(timeLeftLabel(start, long, at('2026-09-23T10:30:00Z'))).toBe('2h 30m left')
  })

  test('never shows a zero', () => {
    // Rounding at the boundary must not produce "0m left".
    expect(timeLeftLabel(start, end, at('2026-09-23T10:59:59Z'))).toBe('1m left')
  })

  test('tolerates a malformed date', () => {
    expect(timeLeftLabel('nonsense', end)).toBeNull()
  })
})
