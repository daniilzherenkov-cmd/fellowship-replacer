/**
 * Fellow importer tests.
 *
 * The single most important assertion here is that NO action items are
 * fabricated. Fellow's export carries no checkbox state, assignee, or due date,
 * so anything we generated would be invented data presented as the user's real
 * task list.
 */

import { test, expect } from '@playwright/test'
import {
  importFellowExport,
  parseNoteContent,
  detectKind,
  type FellowExport,
} from '../../src/import/fellow'

const REAL_EXPORT = '/Users/daniil.zherenkov/Downloads/exports/1411719/export.json'

test.describe('parseNoteContent', () => {
  test('splits the three fixed blocks and keeps the subtitle out of content', () => {
    const parsed = parseNoteContent([
      'Talking Points\nThe things to talk about',
      'Discuss roadmap',
      'Action Items\nWhat came out of this meeting? What are your next steps?',
      'Notepad\nAnything else to write down?',
      'Some free text',
    ])
    expect(parsed.talkingPoints).toEqual(['Discuss roadmap'])
    expect(parsed.notepad).toContain('Some free text')
    // The subtitle must never leak in as a talking point.
    expect(parsed.talkingPoints.join()).not.toContain('The things to talk about')
  })

  test('captures AI-detected prose as notes, never as tasks', () => {
    const parsed = parseNoteContent([
      'Talking Points\nThe things to talk about',
      'AI-Detected Action Items',
      'Someone to check the status of X and report back.',
      'Action Items\nWhat came out of this meeting?',
      'Notepad\nAnything else?',
    ])
    expect(parsed.aiNotes).toContain('Someone to check the status of X and report back.')
    expect(parsed.talkingPoints).toEqual([])
  })

  test('treats an entirely empty template as having no content', () => {
    const parsed = parseNoteContent([
      'Talking Points\nThe things to talk about',
      '',
      'Action Items\nWhat came out of this meeting? What are your next steps?',
      '',
      'Notepad\nAnything else to write down?',
      '',
    ])
    expect(parsed.talkingPoints).toEqual([])
    expect(parsed.aiNotes).toEqual([])
    expect(parsed.notepad).toBe('')
  })
})

test.describe('detectKind', () => {
  test('recognises 1:1 shapes', () => {
    expect(detectKind('Danya / Félix monthly')).toBe('oneOnOne')
    expect(detectKind('PeYa <> Shops Fulfillment [biweekly]')).toBe('oneOnOne')
    expect(detectKind('Daniel 1:1 Milena')).toBe('oneOnOne')
  })

  test('does not mistake long slashed titles for 1:1s', () => {
    expect(detectKind('QS Data Science Vision/Strategy for the whole org')).toBe('manual')
  })
})

test.describe('importFellowExport', () => {
  test('never fabricates action items', () => {
    const data: FellowExport = {
      notes: [
        {
          id: 'a1',
          title: 'Team sync',
          start: '2026-07-07T09:30:00+00:00',
          end: '2026-07-07T10:00:00+00:00',
          content: [
            'Talking Points\nThe things to talk about',
            'AI-Detected Action Items',
            'Yazeid to share barcode vs grid acceptance data.',
            'Action Items\nWhat came out of this meeting?',
            'Notepad\nAnything else?',
          ],
        },
      ],
    }
    const report = importFellowExport(data)
    expect(report.actionItemsCreated).toBe(0)
    // The prose survives as notepad text so nothing is lost...
    expect(report.meetings[0].notepad).toContain('Yazeid to share barcode')
    // ...but it is not presented as a task.
    expect(report.meetings[0]).not.toHaveProperty('actionItems')
  })

  test('skips empty template shells by default and keeps them on request', () => {
    const empty = {
      id: 'e1',
      title: 'Empty',
      start: '2026-07-07T09:30:00+00:00',
      end: '2026-07-07T10:00:00+00:00',
      content: ['Talking Points\nThe things to talk about', '', 'Notepad\nAnything else?'],
    }
    expect(importFellowExport({ notes: [empty] }).imported).toBe(0)
    expect(importFellowExport({ notes: [empty] }).skippedEmpty).toBe(1)
    expect(importFellowExport({ notes: [empty] }, { includeEmpty: true }).imported).toBe(1)
  })

  test('namespaces external ids so calendar sync cannot collide', () => {
    const report = importFellowExport({
      notes: [
        {
          id: 'aMzUzyPQXy',
          title: 'Real note',
          start: '2026-07-07T09:30:00+00:00',
          end: '2026-07-07T10:00:00+00:00',
          content: ['Talking Points\nThe things to talk about', 'A point'],
        },
      ],
    })
    expect(report.meetings[0].externalId).toBe('fellow:aMzUzyPQXy')
  })

  test('handles the real 875-note export', async () => {
    const fs = await import('node:fs')
    test.skip(!fs.existsSync(REAL_EXPORT), 'real export not present on this machine')

    const data = JSON.parse(fs.readFileSync(REAL_EXPORT, 'utf8')) as FellowExport
    const report = importFellowExport(data)

    expect(report.totalNotes).toBe(875)
    // The headline finding: almost everything is an empty shell.
    expect(report.skippedEmpty).toBeGreaterThan(800)
    expect(report.imported).toBeLessThan(60)
    expect(report.imported).toBeGreaterThan(0)
    expect(report.actionItemsCreated).toBe(0)

    // Every imported meeting must be well-formed.
    for (const m of report.meetings) {
      expect(m.title.length).toBeGreaterThan(0)
      expect(new Date(m.startAt).toString()).not.toBe('Invalid Date')
      expect(m.externalId.startsWith('fellow:')).toBe(true)
    }

    // eslint-disable-next-line no-console
    console.log(
      `[real export] ${report.totalNotes} notes -> ${report.imported} imported, ` +
        `${report.skippedEmpty} empty skipped, ${report.skippedUndated} undated`,
    )
  })
})

test.describe('calendar import', () => {
  test('imports events, namespacing ids apart from notes', () => {
    const report = importFellowExport(
      {
        notes: [],
        calendars: [
          {
            name: 'me@deliveryhero.com',
            events: [
              {
                guid: 'abc123',
                title: 'Danya / Milena',
                description: 'Weekly sync',
                start: '2026-09-01T09:00:00+00:00',
                end: '2026-09-01T09:30:00+00:00',
              },
            ],
          },
        ],
      },
      { includeCalendar: true },
    )
    expect(report.importedFromCalendar).toBe(1)
    expect(report.meetings[0].externalId).toBe('gcal:abc123')
    expect(report.meetings[0].kind).toBe('oneOnOne')
    // Invite body is clearly marked as imported, not passed off as user notes.
    expect(report.meetings[0].notepad).toContain('Imported from calendar invite')
  })

  test('drops placeholder-dated events', () => {
    const report = importFellowExport(
      {
        calendars: [
          {
            events: [
              {
                guid: 'p1',
                title: 'Undated',
                start: '2000-01-01T00:00:00+00:00',
                end: '2000-01-02T00:00:00+00:00',
              },
            ],
          },
        ],
      },
      { includeCalendar: true },
    )
    expect(report.importedFromCalendar).toBe(0)
    expect(report.skippedUndatedEvents).toBe(1)
  })

  // Fellow's note ids and calendar guids are different identifier spaces
  // (verified: 0 of 875 note ids match any guid), so de-duplication has to fall
  // back to title+start. Without it, 8 of the 10 substantive notes in the real
  // export would duplicate - and those are exactly the ones with content.
  test('a note and its calendar event do not both create a meeting', () => {
    const report = importFellowExport(
      {
        notes: [
          {
            id: 'n1',
            title: 'Team sync',
            start: '2026-09-01T09:00:00+00:00',
            end: '2026-09-01T09:30:00+00:00',
            content: ['Talking Points\nThe things to talk about', 'A real point'],
          },
        ],
        calendars: [
          {
            events: [
              {
                guid: 'n1',
                title: 'Team sync',
                start: '2026-09-01T09:00:00+00:00',
                end: '2026-09-01T09:30:00+00:00',
              },
            ],
          },
        ],
      },
      { includeCalendar: true },
    )
    // One meeting total: the note wins, because it carries the content.
    expect(report.imported).toBe(1)
    expect(report.importedFromCalendar).toBe(0)
    expect(report.skippedDuplicateEvents).toBe(1)
    expect(report.meetings).toHaveLength(1)
    expect(report.meetings[0].talkingPoints).toEqual(['A real point'])
  })

  test('real export: calendar carries the actual history', async () => {
    const fs = await import('node:fs')
    test.skip(!fs.existsSync(REAL_EXPORT), 'real export not present on this machine')

    const data = JSON.parse(fs.readFileSync(REAL_EXPORT, 'utf8')) as FellowExport
    const report = importFellowExport(data, { includeCalendar: true, since: '2026-01-01' })

    expect(report.totalEvents).toBeGreaterThan(2000)
    expect(report.importedFromCalendar).toBeGreaterThan(1000)
    expect(report.actionItemsCreated).toBe(0)

    const oneOnOnes = report.meetings.filter((m) => m.kind === 'oneOnOne')
    expect(oneOnOnes.length).toBeGreaterThan(50)

    // eslint-disable-next-line no-console
    console.log(
      `[real export + calendar] ${report.importedFromCalendar} events imported ` +
        `(${report.skippedUndatedEvents} undated), ${oneOnOnes.length} detected as 1:1`,
    )
  })
})
