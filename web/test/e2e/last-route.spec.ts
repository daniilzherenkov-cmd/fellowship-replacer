/**
 * Restoring the last screen. Pure, no browser.
 *
 * The stored value goes straight into router.replace, so it is treated as
 * untrusted input even though this app wrote it: localStorage is trivially
 * editable, and an open redirect out of a company tool is worth one
 * validation function.
 */

import { test, expect } from '@playwright/test'
import { isRestorableRoute } from '../../src/lib/last-route'

test.describe('isRestorableRoute', () => {
  test('accepts the app’s own screens', () => {
    for (const p of ['/calendar', '/actions', '/people', '/meetings', '/settings']) {
      expect(isRestorableRoute(p)).toBe(true)
    }
  })

  test('accepts a route with a query or a sub-path', () => {
    expect(isRestorableRoute('/calendar?note=abc')).toBe(true)
    expect(isRestorableRoute('/meetings/abc-123')).toBe(true)
  })

  test('refuses a protocol-relative URL', () => {
    // "//evil.com" starts with a slash and navigates off-site. This is the
    // case a naive startsWith('/') check lets through.
    expect(isRestorableRoute('//evil.com')).toBe(false)
  })

  test('refuses an absolute URL', () => {
    expect(isRestorableRoute('https://evil.com')).toBe(false)
    expect(isRestorableRoute('javascript:alert(1)')).toBe(false)
  })

  test('refuses a backslash trick', () => {
    expect(isRestorableRoute('/\\evil.com')).toBe(false)
  })

  test('refuses an unknown path', () => {
    expect(isRestorableRoute('/admin')).toBe(false)
    expect(isRestorableRoute('/api/metrics')).toBe(false)
  })

  test('refuses the root, which would loop', () => {
    expect(isRestorableRoute('/')).toBe(false)
  })
})
