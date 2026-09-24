/**
 * Input and resource limits. Pure, no browser.
 *
 * These exist because a shared note is broadcast IN FULL to every
 * subscriber, through a pod with 200MB of memory. The failure being
 * prevented is a pasted document, not a long note, so the limits are
 * deliberately generous and the tests pin the boundaries rather than the
 * middle.
 */

import { test, expect } from '@playwright/test'
import {
  enforceLength,
  rateLimit,
  __resetRateLimits,
  LimitExceededError,
  MAX_DOCUMENT_CHARS,
  MAX_ROW_CHARS,
  MAX_NOTE_WRITES_PER_MINUTE,
} from '../../src/lib/limits'

test.beforeEach(() => __resetRateLimits())

test.describe('enforceLength', () => {
  test('accepts exactly the limit', () => {
    // Off by one here would reject a note someone can legitimately write.
    expect(() => enforceLength('note', 'x'.repeat(MAX_DOCUMENT_CHARS), MAX_DOCUMENT_CHARS)).not.toThrow()
  })

  test('rejects one over', () => {
    expect(() =>
      enforceLength('note', 'x'.repeat(MAX_DOCUMENT_CHARS + 1), MAX_DOCUMENT_CHARS),
    ).toThrow(LimitExceededError)
  })

  test('the error names the field and both numbers', () => {
    // The caller turns this into a message, so it has to be useful.
    try {
      enforceLength('talking point', 'x'.repeat(MAX_ROW_CHARS + 5), MAX_ROW_CHARS)
      throw new Error('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(LimitExceededError)
      const e = err as LimitExceededError
      expect(e.field).toBe('talking point')
      expect(e.limit).toBe(MAX_ROW_CHARS)
      expect(e.actual).toBe(MAX_ROW_CHARS + 5)
    }
  })

  test('a realistic meeting note is nowhere near the limit', () => {
    // 10,000 words of notes. If this ever fails the limit is too tight.
    const realistic = 'word '.repeat(10_000)
    expect(realistic.length).toBeLessThan(MAX_DOCUMENT_CHARS)
  })

  test('an empty value is fine', () => {
    expect(() => enforceLength('note', '', MAX_DOCUMENT_CHARS)).not.toThrow()
  })
})

test.describe('rateLimit', () => {
  test('allows a burst up to the limit', () => {
    for (let i = 0; i < MAX_NOTE_WRITES_PER_MINUTE; i += 1) {
      expect(rateLimit('user:a', MAX_NOTE_WRITES_PER_MINUTE)).toBe(true)
    }
  })

  test('refuses the one after', () => {
    for (let i = 0; i < MAX_NOTE_WRITES_PER_MINUTE; i += 1) rateLimit('user:a', MAX_NOTE_WRITES_PER_MINUTE)
    expect(rateLimit('user:a', MAX_NOTE_WRITES_PER_MINUTE)).toBe(false)
  })

  test('keys are independent, so one user cannot starve another', () => {
    for (let i = 0; i < MAX_NOTE_WRITES_PER_MINUTE; i += 1) rateLimit('user:a', MAX_NOTE_WRITES_PER_MINUTE)
    expect(rateLimit('user:a', MAX_NOTE_WRITES_PER_MINUTE)).toBe(false)
    expect(rateLimit('user:b', MAX_NOTE_WRITES_PER_MINUTE)).toBe(true)
  })

  test('the limit is far above what typing can produce', () => {
    // The client writes only after a 400ms pause, so sustained typing
    // produces well under two per second. If this assumption changes, the
    // limit needs revisiting rather than the debounce.
    const writesPerMinuteWhileTyping = 60_000 / 400
    expect(MAX_NOTE_WRITES_PER_MINUTE).toBeGreaterThanOrEqual(writesPerMinuteWhileTyping * 0.8)
  })
})
