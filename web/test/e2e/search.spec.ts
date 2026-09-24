/**
 * Global search, driven through the real UI.
 *
 * Danya reported ⌘K not working. The SQL was verified fine by hand, so this
 * exercises the whole path: keyboard shortcut, debounce, server action,
 * rendering and navigation.
 */

import { test, expect } from '../harness/auth-fixture'

async function makeMeeting(page: import('@playwright/test').Page, title: string) {
  await page.goto('/calendar')
  await page.getByRole('button', { name: '+ New meeting' }).click()
  await page.getByLabel('Event title').fill(title)
  await page.getByRole('button', { name: 'Save' }).click()
  await page.waitForURL(/\/meetings\/[a-f0-9-]+$/)
  return page.url()
}

test.describe('global search', () => {
  test('the field is present on every screen', async ({ signedIn }) => {
    for (const path of ['/calendar', '/actions', '/people', '/meetings']) {
      await signedIn.goto(path)
      await expect(signedIn.getByLabel('Search', { exact: true })).toBeVisible()
    }
  })

  test('cmd+K focuses the field', async ({ signedIn }) => {
    await signedIn.goto('/calendar')
    await signedIn.keyboard.press('ControlOrMeta+k')
    await expect(signedIn.getByLabel('Search', { exact: true })).toBeFocused()
  })

  test('finds a meeting by title and opens it', async ({ signedIn }) => {
    const url = await makeMeeting(signedIn, 'Quarterly pricing review')

    await signedIn.goto('/actions')
    await signedIn.getByLabel('Search', { exact: true }).fill('pricing')

    const hit = signedIn.getByRole('option', { name: /Quarterly pricing review/ })
    await expect(hit).toBeVisible()
    await hit.click()
    await expect(signedIn).toHaveURL(url)
  })

  test('says so when nothing matches', async ({ signedIn }) => {
    await signedIn.goto('/calendar')
    await signedIn.getByLabel('Search', { exact: true }).fill('zzzznotathing')
    await expect(signedIn.getByText(/Nothing matches/)).toBeVisible()
  })

  test('ignores a single character, so it does not query on every keystroke', async ({
    signedIn,
  }) => {
    await signedIn.goto('/calendar')
    await signedIn.getByLabel('Search', { exact: true }).fill('a')
    await expect(signedIn.getByRole('listbox')).toHaveCount(0)
  })
})
