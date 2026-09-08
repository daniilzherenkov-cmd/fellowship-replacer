/**
 * .ics feed parsing tests.
 *
 * Three behaviours here are traps that silently lose or corrupt data, all
 * verified against node-ical's real output rather than assumed:
 *   - recurring events arrive as a rule and must be expanded
 *   - moved/cancelled occurrences hide in `recurrences`/`exdate`
 *   - all-day events shift timezone
 *
 * Plus the SSRF guard, since the URL is user-supplied and fetched server-side.
 */

import { test, expect } from '@playwright/test'
import { parseIcsFeed, fetchIcsFeed, maskIcsUrl, IcsFetchError } from '../../src/lib/ics'

const WINDOW = { from: new Date('2026-09-01'), to: new Date('2026-10-15') }

function feed(...events: string[]): string {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', ...events, 'END:VCALENDAR'].join('\n')
}

const WEEKLY = `BEGIN:VEVENT
DTSTART:20260907T090000Z
DTEND:20260907T093000Z
RRULE:FREQ=WEEKLY;COUNT=4
UID:weekly@google.com
SUMMARY:Shops Science standup
ATTENDEE;CN=Alice:mailto:alice@deliveryhero.com
ATTENDEE;CN=Bob:mailto:bob@deliveryhero.com
ATTENDEE:mailto:danya@deliveryhero.com
END:VEVENT`

test.describe('recurring expansion', () => {
  test('expands a weekly series into one meeting per occurrence', async () => {
    const result = await parseIcsFeed(feed(WEEKLY), WINDOW)
    // Without expansion this would be 1. That is the whole trap.
    expect(result.meetings.length).toBe(4)
    expect(result.expandedOccurrences).toBe(4)
  })

  test('gives each occurrence a distinct externalId', async () => {
    const result = await parseIcsFeed(feed(WEEKLY), WINDOW)
    const ids = new Set(result.meetings.map((m) => m.externalId))
    // Sharing an id would collapse the series into one row on sync and destroy
    // each occurrence's notes - the same bug the Swift app hit.
    expect(ids.size).toBe(4)
  })

  test('namespaces ids apart from the API and Fellow import paths', async () => {
    const result = await parseIcsFeed(feed(WEEKLY), WINDOW)
    expect(result.meetings[0].externalId.startsWith('ics:')).toBe(true)
  })

  test('only expands within the requested window', async () => {
    const result = await parseIcsFeed(feed(WEEKLY), {
      from: new Date('2026-09-01'),
      to: new Date('2026-09-16'),
    })
    expect(result.meetings.length).toBe(2)
  })
})

test.describe('recurrence exceptions', () => {
  test('honours a cancelled occurrence (EXDATE)', async () => {
    const withExdate = WEEKLY.replace(
      'UID:weekly@google.com',
      'EXDATE:20260914T090000Z\nUID:weekly@google.com',
    )
    const result = await parseIcsFeed(feed(withExdate), WINDOW)
    expect(result.meetings.length).toBe(3)
    expect(result.meetings.some((m) => m.startAt.startsWith('2026-09-14'))).toBe(false)
  })

  test('uses the moved time for an edited occurrence, not the original', async () => {
    const override = `BEGIN:VEVENT
DTSTART:20260921T140000Z
DTEND:20260921T143000Z
UID:weekly@google.com
RECURRENCE-ID:20260921T090000Z
SUMMARY:Shops Science standup (moved)
END:VEVENT`
    const result = await parseIcsFeed(feed(WEEKLY, override), WINDOW)

    const onThatDay = result.meetings.filter((m) => m.startAt.startsWith('2026-09-21'))
    // Exactly one meeting that day - not the original AND the override.
    expect(onThatDay).toHaveLength(1)
    expect(onThatDay[0].startAt).toContain('T14:00')
    expect(onThatDay[0].title).toContain('moved')
  })
})

test.describe('filtering', () => {
  test('drops all-day events by default', async () => {
    const holiday = `BEGIN:VEVENT
DTSTART;VALUE=DATE:20260925
DTEND;VALUE=DATE:20260926
UID:holiday@google.com
SUMMARY:All DH Offices Closed
END:VEVENT`
    const result = await parseIcsFeed(feed(holiday), WINDOW)
    expect(result.meetings).toHaveLength(0)
    expect(result.skippedAllDay).toBe(1)
  })

  test('drops solo blocks with no attendees', async () => {
    const focus = `BEGIN:VEVENT
DTSTART:20260908T090000Z
DTEND:20260908T110000Z
UID:focus@google.com
SUMMARY:Deep Work Block
END:VEVENT`
    const result = await parseIcsFeed(feed(focus), WINDOW)
    expect(result.meetings).toHaveLength(0)
    expect(result.skippedSolo).toBe(1)
  })

  test('drops cancelled events', async () => {
    const cancelled = `BEGIN:VEVENT
DTSTART:20260908T090000Z
DTEND:20260908T093000Z
UID:cancelled@google.com
STATUS:CANCELLED
SUMMARY:Called off
ATTENDEE:mailto:a@deliveryhero.com
ATTENDEE:mailto:b@deliveryhero.com
END:VEVENT`
    const result = await parseIcsFeed(feed(cancelled), WINDOW)
    expect(result.meetings).toHaveLength(0)
    expect(result.skippedCancelled).toBe(1)
  })
})

test.describe('attendees and classification', () => {
  test('two humans is a 1:1 and excludes the viewer from the list', async () => {
    const oneOnOne = `BEGIN:VEVENT
DTSTART:20260909T140000Z
DTEND:20260909T150000Z
UID:oneoff@google.com
SUMMARY:Danya / Milena
ATTENDEE:mailto:danya@deliveryhero.com
ATTENDEE:mailto:milena@deliveryhero.com
END:VEVENT`
    const result = await parseIcsFeed(feed(oneOnOne), {
      ...WINDOW,
      selfEmail: 'danya@deliveryhero.com',
    })
    expect(result.meetings[0].kind).toBe('oneOnOne')
    expect(result.meetings[0].attendees.map((a) => a.email)).toEqual([
      'milena@deliveryhero.com',
    ])
  })

  test('a room booking does not turn a 1:1 into a team meeting', async () => {
    const withRoom = `BEGIN:VEVENT
DTSTART:20260909T140000Z
DTEND:20260909T150000Z
UID:room@google.com
SUMMARY:Danya / Milena
ATTENDEE:mailto:danya@deliveryhero.com
ATTENDEE:mailto:milena@deliveryhero.com
ATTENDEE;CUTYPE=ROOM:mailto:room-b703@resource.calendar.google.com
END:VEVENT`
    const result = await parseIcsFeed(feed(withRoom), {
      ...WINDOW,
      selfEmail: 'danya@deliveryhero.com',
    })
    expect(result.meetings[0].kind).toBe('oneOnOne')
  })

  test('three or more humans is a team meeting', async () => {
    const result = await parseIcsFeed(feed(WEEKLY), {
      ...WINDOW,
      selfEmail: 'danya@deliveryhero.com',
    })
    expect(result.meetings[0].kind).toBe('team')
  })

  test('derives a name from the email when CN is absent', async () => {
    const ev = `BEGIN:VEVENT
DTSTART:20260909T140000Z
DTEND:20260909T150000Z
UID:name@google.com
SUMMARY:Sync
ATTENDEE:mailto:danya@deliveryhero.com
ATTENDEE:mailto:milena.lazarevska@deliveryhero.com
END:VEVENT`
    const result = await parseIcsFeed(feed(ev), {
      ...WINDOW,
      selfEmail: 'danya@deliveryhero.com',
    })
    expect(result.meetings[0].attendees[0].name).toBe('Milena Lazarevska')
  })

  test('picks up a Google Meet link from the description', async () => {
    const ev = `BEGIN:VEVENT
DTSTART:20260909T140000Z
DTEND:20260909T150000Z
UID:meet@google.com
SUMMARY:Sync
DESCRIPTION:Join at https://meet.google.com/abc-defg-hij for the call
ATTENDEE:mailto:a@deliveryhero.com
ATTENDEE:mailto:b@deliveryhero.com
END:VEVENT`
    const result = await parseIcsFeed(feed(ev), WINDOW)
    expect(result.meetings[0].conferenceUrl).toBe('https://meet.google.com/abc-defg-hij')
  })
})

test.describe('feed URL safety', () => {
  // The URL is user-supplied and fetched by the SERVER, so without host
  // restrictions the app becomes a proxy for reading internal addresses.
  test('rejects non-https', async () => {
    await expect(fetchIcsFeed('http://calendar.google.com/x.ics')).rejects.toThrow(
      /must start with https/i,
    )
  })

  test('rejects hosts other than Google Calendar', async () => {
    for (const url of [
      'https://evil.example/feed.ics',
      'https://169.254.169.254/latest/meta-data/',
      'https://localhost:3000/api/health',
      'https://calendar.google.com.evil.example/x.ics',
    ]) {
      await expect(fetchIcsFeed(url)).rejects.toBeInstanceOf(IcsFetchError)
    }
  })

  test('rejects malformed input', async () => {
    await expect(fetchIcsFeed('not a url')).rejects.toThrow(/does not look like a URL/i)
  })
})

test.describe('maskIcsUrl', () => {
  test('redacts the secret segment', () => {
    const masked = maskIcsUrl(
      'https://calendar.google.com/calendar/ical/me%40deliveryhero.com/private-abc123secret/basic.ics',
    )
    expect(masked).not.toContain('abc123secret')
    expect(masked).toContain('private-')
  })

  test('never throws on junk', () => {
    expect(maskIcsUrl('nonsense')).toBe('the saved address')
  })
})

test.describe('private / redacted events', () => {
  // Google strips the title AND the attendee list server-side for events the
  // user marked private, so they arrive as "Busy" with nothing usable. Danya
  // hit this on a real import: the archive filled with identical rows.
  const BUSY = `BEGIN:VEVENT
DTSTART:20260910T100000Z
DTEND:20260910T103000Z
UID:private1@google.com
SUMMARY:Busy
CLASS:PRIVATE
END:VEVENT`

  test('skips redacted events by default and counts them', async () => {
    const result = await parseIcsFeed(feed(BUSY), WINDOW)
    expect(result.meetings).toHaveLength(0)
    expect(result.redacted).toBe(1)
  })

  test('can keep them when explicitly asked', async () => {
    const result = await parseIcsFeed(feed(BUSY), { ...WINDOW, skipRedacted: false })
    expect(result.meetings).toHaveLength(1)
    expect(result.redacted).toBe(1)
  })

  test('detects the shape even without CLASS:PRIVATE', async () => {
    const noClass = BUSY.replace('CLASS:PRIVATE\n', '')
    const result = await parseIcsFeed(feed(noClass), WINDOW)
    expect(result.redacted).toBe(1)
  })

  test('does not mistake a real meeting titled "Busy season kickoff"', async () => {
    const real = `BEGIN:VEVENT
DTSTART:20260910T100000Z
DTEND:20260910T103000Z
UID:real@google.com
SUMMARY:Busy season kickoff
ATTENDEE:mailto:a@deliveryhero.com
ATTENDEE:mailto:b@deliveryhero.com
END:VEVENT`
    const result = await parseIcsFeed(feed(real), WINDOW)
    expect(result.redacted).toBe(0)
    expect(result.meetings).toHaveLength(1)
  })
})
