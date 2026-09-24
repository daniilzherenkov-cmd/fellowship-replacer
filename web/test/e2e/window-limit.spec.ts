/**
 * Regression: a wide date window plus a low LIMIT hid the present.
 *
 * listMeetings orders by start_at ASC, so LIMIT returns the OLDEST rows in
 * the window. Widening the calendar to +/-3 months while the limit defaulted
 * to 500 meant a calendar holding ~1000 meetings served June to mid-September
 * and nothing after: the current week rendered completely empty, which looks
 * exactly like data loss and is not.
 *
 * Driven through the UI because the bug only appears with enough rows to
 * exceed the limit, which is a property of the page's own window.
 */

import { test, expect } from '../harness/auth-fixture'

test.describe('wide windows do not hide the present', () => {
  test("a meeting created today appears on today's calendar", async ({ signedIn }) => {
    await signedIn.goto('/calendar')
    await signedIn.getByRole('button', { name: '+ New meeting' }).click()
    await signedIn.getByLabel('Event title').fill('Today window check')
    await signedIn.getByRole('button', { name: 'Save' }).click()
    await signedIn.waitForURL(/\/meetings\/[a-f0-9-]+$/)

    await signedIn.goto('/calendar')
    await expect(
      signedIn.getByTestId('agenda-card').filter({ hasText: 'Today window check' }),
    ).toHaveCount(1)
  })

  test('it also appears in the week grid', async ({ signedIn }) => {
    await signedIn.goto('/calendar')
    await signedIn.getByRole('button', { name: '+ New meeting' }).click()
    await signedIn.getByLabel('Event title').fill('Week window check')
    await signedIn.getByRole('button', { name: 'Save' }).click()
    await signedIn.waitForURL(/\/meetings\/[a-f0-9-]+$/)

    await signedIn.goto('/calendar')
    await signedIn.getByRole('tab', { name: 'week' }).click()
    await expect(
      signedIn.getByTestId('week-event').filter({ hasText: 'Week window check' }),
    ).toHaveCount(1)
  })

  test('the archive opens on today, not on the oldest row', async ({ signedIn }) => {
    await signedIn.goto('/calendar')
    await signedIn.getByRole('button', { name: '+ New meeting' }).click()
    await signedIn.getByLabel('Event title').fill('Archive window check')
    await signedIn.getByRole('button', { name: 'Save' }).click()
    await signedIn.waitForURL(/\/meetings\/[a-f0-9-]+$/)

    await signedIn.goto('/meetings')
    // Scoped to the list: a meeting starting now also appears in the
    // upcoming-meeting banner, so a bare text match finds two elements.
    await expect(
      signedIn.getByRole('link', { name: /Archive window check/ }),
    ).toBeVisible()
  })
})
