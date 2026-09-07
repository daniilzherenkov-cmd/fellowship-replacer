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
