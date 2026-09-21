/**
 * Sync readout logic.
 *
 * The button's value is that it says WHAT changed. "Synced." tells the user
 * nothing they could not have guessed; "3 new" is the actual answer to the
 * question they had when they clicked it. These tests pin that wording,
 * including the easily-missed case where a sync legitimately finds nothing.
 */

import { test, expect } from '@playwright/test'
import { summarise, describeError } from '../../src/components/calendar/sync-messages'

test.describe('summarise', () => {
  test('a sync that changed nothing says so, rather than looking broken', () => {
    expect(summarise(0, 0)).toBe('Already up to date')
  })

  test('reports new meetings', () => {
    expect(summarise(3, 0)).toBe('3 new')
  })

  test('reports updated meetings', () => {
    expect(summarise(0, 5)).toBe('5 updated')
  })

  test('reports both when both happened', () => {
    expect(summarise(2, 4)).toBe('2 new, 4 updated')
  })

  test('a single item is still counted, not special-cased away', () => {
    expect(summarise(1, 0)).toBe('1 new')
  })
})

test.describe('describeError', () => {
  test('points at Settings, because that is where the fix is', () => {
    // The button lives on the calendar page but connecting happens in Settings,
    // so an error that does not say where to go leaves the user stuck.
    expect(describeError('not_connected')).toContain('Settings')
    expect(describeError('reconnect_required')).toContain('Settings')
  })

  test('distinguishes an expired authorisation from never having connected', () => {
    expect(describeError('reconnect_required')).not.toBe(describeError('not_connected'))
  })

  test('explains a deployment with no OAuth credentials', () => {
    expect(describeError('google_not_configured')).toContain('not set up')
  })

  test('an unknown error still produces something actionable', () => {
    const text = describeError('some_unmapped_failure')
    expect(text).toBe('Sync failed. Try again.')
  })

  test('a missing error code does not render "undefined"', () => {
    expect(describeError(undefined)).not.toContain('undefined')
  })
})
