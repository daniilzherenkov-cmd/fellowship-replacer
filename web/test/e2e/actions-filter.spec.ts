/**
 * Filter rules for the unified action list.
 *
 * Pure logic, no browser. This is the one screen where a wrong filter
 * silently hides work, so each rule is asserted on its own.
 */

import { test, expect } from '@playwright/test'
import { applyFilters, EMPTY_FILTERS } from '../../src/components/actions/filters'
import type { ActionItem, Person } from '../../src/lib/queries'

function person(id: string, name: string): Person {
  return { id, name, email: null, role: null, colorHex: '#111', isMe: false, isRegistered: false }
}

function item(over: Partial<ActionItem> & { id: string }): ActionItem {
  return {
    text: 'Item',
    isDone: false,
    dueDate: null,
    completedAt: null,
    sortOrder: 0,
    assignee: null,
    meetingId: null,
    meetingTitle: null,
    ...over,
  }
}

/**
 * Default to the 'others' tab for the pre-existing cases: none of these
 * fixtures are assigned to me, and 'mine' would correctly hide them all.
 * The tab itself is covered separately below.
 */
const ALL = {
  tab: 'others' as const,
  text: '',
  personId: '',
  meetingId: '',
  showDone: false,
}

const dana = person('p1', 'Dana')
const sam = person('p2', 'Sam')

const items: ActionItem[] = [
  item({ id: '1', text: 'Review pricing', assignee: dana, meetingId: 'm1', meetingTitle: 'Weekly' }),
  item({ id: '2', text: 'Send the deck', assignee: sam, meetingId: 'm1', meetingTitle: 'Weekly' }),
  item({ id: '3', text: 'Book the room', assignee: null, meetingId: null, meetingTitle: null }),
  item({ id: '4', text: 'Old thing', isDone: true, assignee: dana, meetingId: 'm2', meetingTitle: 'Retro' }),
]

const ids = (list: ActionItem[]) => list.map((i) => i.id)

test.describe('applyFilters', () => {
  test('hides done items unless asked', () => {
    expect(ids(applyFilters(items, ALL))).toEqual(['1', '2'])
    expect(ids(applyFilters(items, { ...ALL, showDone: true }))).toContain('4')
  })

  test('matches text case-insensitively', () => {
    expect(ids(applyFilters(items, { ...ALL, text: 'PRICING' }))).toEqual(['1'])
  })

  test('filters by assignee', () => {
    expect(ids(applyFilters(items, { ...ALL, personId: 'p2' }))).toEqual(['2'])
  })

  test('filters by source meeting', () => {
    expect(ids(applyFilters(items, { ...ALL, meetingId: 'm1' }))).toEqual(['1', '2'])
  })

  test('"No meeting" finds standalone items, not everything', () => {
    // The sentinel has to be distinguishable from "any", or creating a
    // standalone item would make it invisible. Item 3 is unassigned, so it
    // lives under 'mine'.
    expect(ids(applyFilters(items, { ...ALL, tab: 'mine', meetingId: '__none__' }))).toEqual([
      '3',
    ])
  })

  test('combines filters', () => {
    expect(
      ids(applyFilters(items, { ...ALL, personId: 'p1', showDone: true, text: 'old' })),
    ).toEqual(['4'])
  })

  test('an unassigned item is not returned when filtering by a person', () => {
    expect(ids(applyFilters(items, { ...ALL, personId: 'p1' }))).not.toContain('3')
  })
})

test.describe('My items vs Assigned to others', () => {
  const me = { ...person('me', 'Me'), isMe: true }
  const split: ActionItem[] = [
    item({ id: 'mine-assigned', assignee: me }),
    item({ id: 'mine-unassigned', assignee: null }),
    item({ id: 'theirs', assignee: dana }),
  ]

  test("'mine' includes items assigned to me", () => {
    expect(ids(applyFilters(split, { ...EMPTY_FILTERS, tab: 'mine' }))).toContain(
      'mine-assigned',
    )
  })

  test("'mine' also includes UNASSIGNED items", () => {
    // An item you wrote and never assigned is still yours. Dropping these
    // would silently hide work from the default tab.
    expect(ids(applyFilters(split, { ...EMPTY_FILTERS, tab: 'mine' }))).toContain(
      'mine-unassigned',
    )
  })

  test("'mine' excludes work owned by someone else", () => {
    expect(ids(applyFilters(split, { ...EMPTY_FILTERS, tab: 'mine' }))).not.toContain('theirs')
  })

  test("'others' is exactly the complement", () => {
    expect(ids(applyFilters(split, { ...EMPTY_FILTERS, tab: 'others' }))).toEqual(['theirs'])
  })

  test('every item lands in exactly one tab', () => {
    const mine = applyFilters(split, { ...EMPTY_FILTERS, tab: 'mine' }).length
    const others = applyFilters(split, { ...EMPTY_FILTERS, tab: 'others' }).length
    expect(mine + others).toBe(split.length)
  })
})
