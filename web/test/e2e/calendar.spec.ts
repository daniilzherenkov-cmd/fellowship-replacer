/**
 * Google Calendar normalisation tests.
 *
 * Runs against a real captured API window (40 events from Danya's calendar,
 * Sept 2026), pseudonymised: every colleague is personNN@deliveryhero.com and
 * all descriptions are stripped. Structure, ids, recurrence and RSVP states are
 * untouched, because those are exactly what the logic depends on.
 */

import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  normaliseEvent,
  normaliseEvents,
  classifyKind,
  humanAttendees,
  nameForAttendee,
  colorForEmail,
  isAllDay,
  type GCalEvent,
} from '../../src/lib/calendar'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = JSON.parse(
  readFileSync(join(here, '../fixtures/gcal-real-window.json'), 'utf8'),
) as { events: GCalEvent[] }

test.describe('attendee handling', () => {
  test('excludes rooms and equipment from human attendees', () => {
    const withRoom = fixture.events.find((e) =>
      (e.attendees ?? []).some((a) => a.resource === true),
    )
    expect(withRoom, 'fixture should contain a room booking').toBeTruthy()
    expect(humanAttendees(withRoom!).every((a) => a.resource !== true)).toBe(true)
  })

  test('derives a display name from the email local part', () => {
    expect(nameForAttendee({ email: 'daniil.zherenkov@deliveryhero.com' })).toBe(
      'Daniil Zherenkov',
    )
    expect(nameForAttendee({ email: 'muhammad.khan.31@deliveryhero.com' })).toBe(
      'Muhammad Khan 31',
    )
    expect(nameForAttendee({ displayName: 'Real Name', email: 'x@y.com' })).toBe('Real Name')
  })

  test('assigns a stable colour per email', () => {
    const a = colorForEmail('someone@deliveryhero.com')
    expect(colorForEmail('someone@deliveryhero.com')).toBe(a)
    expect(a).toMatch(/^#[0-9A-F]{6}$/i)
  })
})

test.describe('classifyKind', () => {
  test('two humans is a 1:1', () => {
    expect(
      classifyKind({
        id: 'x',
        attendees: [{ email: 'a@x.com', self: true }, { email: 'b@x.com' }],
      }),
    ).toBe('oneOnOne')
  })

  test('three or more is a team meeting', () => {
    expect(
      classifyKind({
        id: 'x',
        attendees: [{ email: 'a@x.com' }, { email: 'b@x.com' }, { email: 'c@x.com' }],
      }),
    ).toBe('team')
  })

  test('a room does not turn a 1:1 into a team meeting', () => {
    expect(
      classifyKind({
        id: 'x',
        attendees: [
          { email: 'a@x.com', self: true },
          { email: 'b@x.com' },
          { email: 'room@resource.calendar.google.com', resource: true },
        ],
      }),
    ).toBe('oneOnOne')
  })

  test('solo blocks are personal, not meetings', () => {
    expect(classifyKind({ id: 'x', summary: 'Lunch' })).toBe('manual')
  })
})

test.describe('the recurring-event dedupe trap', () => {
  test('instance ids are unique where series ids are not', () => {
    const recurring = fixture.events.filter((e) => e.recurringEventId)
    const instanceIds = new Set(recurring.map((e) => e.id))
    const seriesIds = new Set(recurring.map((e) => e.recurringEventId))

    // This is the whole point: keying on the series id would collapse distinct
    // weekly occurrences into one row and destroy their individual notes.
    expect(recurring.length).toBeGreaterThan(seriesIds.size)
    expect(instanceIds.size).toBe(recurring.length)
  })

  test('normalisation keys on the instance id', () => {
    const recurring = fixture.events.find((e) => e.recurringEventId)!
    const m = normaliseEvent(recurring, { skipDeclined: false, skipSolo: false })
    expect(m!.externalId).toBe(`gcal:${recurring.id}`)
    expect(m!.externalId).not.toContain(recurring.recurringEventId!)
  })

  test('two instances of one series produce two meetings', () => {
    const bySeries = new Map<string, GCalEvent[]>()
    for (const e of fixture.events) {
      if (!e.recurringEventId) continue
      const list = bySeries.get(e.recurringEventId) ?? []
      list.push(e)
      bySeries.set(e.recurringEventId, list)
    }
    const multi = [...bySeries.values()].find((v) => v.length > 1)
    expect(multi, 'fixture should contain a repeated series').toBeTruthy()

    const out = normaliseEvents(multi!, { skipDeclined: false, skipSolo: false })
    expect(out.length).toBe(multi!.length)
  })
})

test.describe('filtering rules', () => {
  test('drops cancelled events', () => {
    expect(normaliseEvent({ id: 'x', status: 'cancelled', start: { dateTime: '2026-09-01T09:00:00Z' }, end: { dateTime: '2026-09-01T10:00:00Z' } })).toBeNull()
  })

  test('drops declined meetings by default and keeps them on request', () => {
    const ev: GCalEvent = {
      id: 'x',
      summary: 'Something I declined',
      start: { dateTime: '2026-09-01T09:00:00Z' },
      end: { dateTime: '2026-09-01T10:00:00Z' },
      attendees: [
        { email: 'me@x.com', self: true, responseStatus: 'declined' },
        { email: 'other@x.com' },
      ],
    }
    expect(normaliseEvent(ev)).toBeNull()
    expect(normaliseEvent(ev, { skipDeclined: false })).not.toBeNull()
  })

  test('drops all-day events by default', () => {
    const holiday: GCalEvent = {
      id: 'x',
      summary: 'All DH Offices Closed',
      start: { date: '2026-12-25' },
      end: { date: '2026-12-26' },
    }
    expect(isAllDay(holiday)).toBe(true)
    expect(normaliseEvent(holiday)).toBeNull()
  })

  test('drops solo blocks by default', () => {
    const focus: GCalEvent = {
      id: 'x',
      summary: 'Deep Work Block',
      start: { dateTime: '2026-09-01T09:00:00Z' },
      end: { dateTime: '2026-09-01T11:00:00Z' },
    }
    expect(normaliseEvent(focus)).toBeNull()
    expect(normaliseEvent(focus, { skipSolo: false })).not.toBeNull()
  })
})

test.describe('real captured window', () => {
  test('normalises into sensible meetings', () => {
    const out = normaliseEvents(fixture.events)

    expect(out.length).toBeGreaterThan(0)
    expect(out.length).toBeLessThan(fixture.events.length) // some were filtered

    for (const m of out) {
      expect(m.externalId.startsWith('gcal:')).toBe(true)
      expect(new Date(m.startAt).toString()).not.toBe('Invalid Date')
      expect(new Date(m.endAt).getTime()).toBeGreaterThanOrEqual(new Date(m.startAt).getTime())
      expect(m.title.length).toBeGreaterThan(0)
      // The user is never in their own attendee list.
      expect(m.attendees.some((a) => a.email === 'daniil.zherenkov@deliveryhero.com')).toBe(false)
    }

    const oneOnOnes = out.filter((m) => m.kind === 'oneOnOne')
    const teams = out.filter((m) => m.kind === 'team')
    expect(oneOnOnes.length).toBeGreaterThan(0)
    expect(teams.length).toBeGreaterThan(0)

    // eslint-disable-next-line no-console
    console.log(
      `[real gcal] ${fixture.events.length} events -> ${out.length} meetings ` +
        `(${oneOnOnes.length} 1:1, ${teams.length} team)`,
    )
  })

  test('captures Google Meet links where present', () => {
    const out = normaliseEvents(fixture.events)
    const withMeet = out.filter((m) => m.conferenceUrl)
    expect(withMeet.length).toBeGreaterThan(0)
    expect(withMeet[0].conferenceUrl).toContain('meet.google.com')
  })
})
