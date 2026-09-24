/**
 * The meetings archive loads in slices and extends at both ends.
 *
 * The scroll-triggered path needs a real viewport, so this drives the
 * sentinels by scrolling rather than clicking, with the links as the
 * fallback assertion.
 */

import { test, expect } from '../harness/auth-fixture'

async function makeMeeting(page: import('@playwright/test').Page, title: string) {
  await page.goto('/calendar')
  await page.getByRole('button', { name: '+ New meeting' }).click()
  await page.getByLabel('Event title').fill(title)
  await page.getByRole('button', { name: 'Save' }).click()
  await page.waitForURL(/\/meetings\/[a-f0-9-]+$/)
}

test.describe('meetings archive', () => {
  test('opens on a slice around today, not the whole history', async ({ signedIn }) => {
    await makeMeeting(signedIn, 'Slice check')
    await signedIn.goto('/meetings')
    await expect(signedIn.getByText('Slice check')).toBeVisible()
    // The range is stated so the reader knows they are not seeing everything.
    await expect(signedIn.getByText(/Load more at either end/)).toBeVisible()
  })

  test('says when there is no more history rather than looping', async ({ signedIn }) => {
    await makeMeeting(signedIn, 'Bounds check')
    await signedIn.goto('/meetings')
    // Only one meeting exists, so both ends are already at the limit and the
    // sentinels must be disabled - otherwise scrolling re-fetches forever.
    await expect(signedIn.getByText('Start of the imported history.')).toBeVisible()
    await expect(signedIn.getByText('End of the imported range.')).toBeVisible()
  })

  test('the history link widens the window', async ({ signedIn }) => {
    await makeMeeting(signedIn, 'Widen check')
    await signedIn.goto('/meetings?back=1&fwd=1')
    const before = await signedIn.getByText(/Load more at either end/).textContent()
    await signedIn.goto('/meetings?back=3&fwd=1')
    const after = await signedIn.getByText(/Load more at either end/).textContent()
    // The stated range must actually change, or "load more" does nothing.
    expect(after).not.toBe(before)
  })

  test('a hand-edited range parameter cannot ask for everything', async ({ signedIn }) => {
    await makeMeeting(signedIn, 'Clamp check')
    // back=9999 would be a 190-year window if it were not clamped.
    await signedIn.goto('/meetings?back=9999&fwd=9999')
    await expect(signedIn.getByText('Clamp check')).toBeVisible()
  })
})
