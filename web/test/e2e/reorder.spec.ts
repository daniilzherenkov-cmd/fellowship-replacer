/**
 * The move used by drag-to-reorder. Pure, so no browser.
 *
 * Off-by-one here silently scrambles someone's agenda, and the visible
 * symptom (a row in the wrong place) is easy to mistake for a slip of the
 * hand, so every edge is pinned down.
 */

import { test, expect } from '@playwright/test'
import { moveItem } from '../../src/components/note/useRowDrag'

const list = ['a', 'b', 'c', 'd']

test.describe('moveItem', () => {
  test('moves an item down', () => {
    expect(moveItem(list, 0, 2)).toEqual(['b', 'c', 'a', 'd'])
  })

  test('moves an item up', () => {
    expect(moveItem(list, 3, 1)).toEqual(['a', 'd', 'b', 'c'])
  })

  test('moving onto itself changes nothing', () => {
    expect(moveItem(list, 2, 2)).toEqual(list)
  })

  test('moves to the very end', () => {
    expect(moveItem(list, 0, 3)).toEqual(['b', 'c', 'd', 'a'])
  })

  test('moves to the very start', () => {
    expect(moveItem(list, 2, 0)).toEqual(['c', 'a', 'b', 'd'])
  })

  test('ignores out-of-range indices instead of corrupting the list', () => {
    expect(moveItem(list, -1, 2)).toEqual(list)
    expect(moveItem(list, 0, 99)).toEqual(list)
  })

  test('does not mutate the original', () => {
    const original = [...list]
    moveItem(list, 0, 3)
    expect(list).toEqual(original)
  })
})
