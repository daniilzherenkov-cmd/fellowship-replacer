/**
 * Meeting reminder timing. Pure, no browser.
 *
 * Two failure modes matter: a missed meeting, and a notification that fires
 * over and over. The second is worse, because it makes people turn
 * reminders off permanently.
 */

import { test, expect } from '@playwright/test'
import { dueReminders, reminderBody, pruneFired, LEAD_MS } from '../../src/lib/reminders'
import { reminderBodyFor, PUSH_LEAD_MS } from '../../src/lib/push'

const NOW = new Date('2026-09-23T10:00:00Z').getTime()
const at = (min: number) => ({
  id: `m${min}`,
  title: `Meeting ${min}`,
  startAt: new Date(NOW + min * 60_000).toISOString(),
})
const none = new Set<string>()
const ids = (d: ReturnType<typeof dueReminders>) => d.map((x) => x.meeting.id)

test.describe('dueReminders', () => {
  test('fires inside the lead window', () => {
    expect(ids(dueReminders([at(4)], NOW, none))).toEqual(['m4'])
  })

  test('stays quiet for a meeting further out', () => {
    expect(ids(dueReminders([at(30)], NOW, none))).toEqual([])
  })

  test('fires exactly at the lead boundary', () => {
    const boundary = { id: 'edge', title: 'Edge', startAt: new Date(NOW + LEAD_MS).toISOString() }
    expect(ids(dueReminders([boundary], NOW, none))).toEqual(['edge'])
  })

  test('never fires twice for the same meeting', () => {
    // The poll runs every 30s; without this the same reminder would repeat.
    expect(ids(dueReminders([at(4)], NOW, new Set(['m4'])))).toEqual([])
  })

  test('still fires for one that just started', () => {
    expect(ids(dueReminders([at(-0.5)], NOW, none))).toEqual(['m-0.5'])
  })

  test('gives up on a meeting well underway', () => {
    // A popup for something that began ten minutes ago is pure noise.
    expect(ids(dueReminders([at(-10)], NOW, none))).toEqual([])
  })

  test('orders the soonest first', () => {
    expect(ids(dueReminders([at(4), at(1), at(3)], NOW, none))).toEqual(['m1', 'm3', 'm4'])
  })

  test('ignores an unparseable date instead of throwing', () => {
    const bad = { id: 'bad', title: 'Bad', startAt: 'not-a-date' }
    expect(ids(dueReminders([bad, at(2)], NOW, none))).toEqual(['m2'])
  })
})

test.describe('reminderBody', () => {
  test('reads naturally at the boundaries', () => {
    expect(reminderBody(0)).toBe('Starting now')
    expect(reminderBody(1)).toBe('Starting in 1 minute')
    expect(reminderBody(4)).toBe('Starting in 4 minutes')
  })
})

test.describe('pruneFired', () => {
  test('forgets meetings that are no longer listed', () => {
    // A tab open for days would otherwise accumulate ids forever.
    expect([...pruneFired(new Set(['old', 'm2']), [at(2)])]).toEqual(['m2'])
  })
})

test.describe('server-side push wording matches the in-app wording', () => {
  test('the two reminder bodies agree', () => {
    // Two code paths write this sentence. If they drift, the same meeting
    // reads differently depending on whether the tab was open.
    for (const mins of [0, 1, 2, 5]) {
      expect(reminderBodyFor(mins)).toBe(reminderBody(mins))
    }
  })

  test('the two lead windows agree', () => {
    expect(PUSH_LEAD_MS).toBe(LEAD_MS)
  })
})
