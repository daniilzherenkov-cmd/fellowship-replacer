/**
 * Fixes from the first outside UX review (2026-09).
 *
 * Each test pins one finding, so a regression names the friction it brings
 * back rather than just a selector that moved.
 */

import { test, expect } from '../harness/auth-fixture'

async function createMeeting(page: import('@playwright/test').Page, title: string) {
  await page.goto('/calendar')
  await page.getByRole('button', { name: '+ New meeting' }).click()
  await page.getByLabel('Event title').fill(title)
  await page.getByRole('button', { name: 'Save' }).click()
  await page.waitForURL(/\/meetings\/[a-f0-9-]+$/)
  return page.url()
}

test.describe('talking points', () => {
  test('a new point appears focused at once and survives a reload', async ({ signedIn }) => {
    const url = await createMeeting(signedIn, 'Optimistic add')
    await signedIn.getByRole('button', { name: 'New talking point' }).click()

    // Focused straight away, before any server round trip is guaranteed to
    // have finished: typing must land in the new row.
    const input = signedIn.getByLabel('Talking point').last()
    await expect(input).toBeFocused()
    await signedIn.keyboard.type('Typed immediately')
    await signedIn.waitForTimeout(900)

    await signedIn.goto(url)
    await expect(signedIn.getByLabel('Talking point')).toHaveValue('Typed immediately')
  })

  test('Enter adds the next point and Backspace on an empty one removes it', async ({
    signedIn,
  }) => {
    const url = await createMeeting(signedIn, 'Keyboard points')
    await signedIn.getByRole('button', { name: 'New talking point' }).click()
    await signedIn.keyboard.type('First')
    await signedIn.keyboard.press('Enter')

    const inputs = signedIn.getByLabel('Talking point')
    await expect(inputs).toHaveCount(2)
    await expect(inputs.nth(1)).toBeFocused()

    await signedIn.keyboard.press('Backspace')
    await expect(inputs).toHaveCount(1)
    await expect(inputs.first()).toBeFocused()

    await signedIn.waitForTimeout(700)
    await signedIn.goto(url)
    await expect(signedIn.getByLabel('Talking point')).toHaveCount(1)
  })

  test('covering is done from the bullet only, not duplicated in the menu', async ({
    signedIn,
  }) => {
    await createMeeting(signedIn, 'One completion control')
    await signedIn.getByRole('button', { name: 'New talking point' }).click()
    await signedIn.keyboard.type('A point')

    const row = signedIn.getByTestId('talking-point-row').first()
    await row.hover()
    await row.getByRole('button', { name: 'More actions' }).click()
    await expect(signedIn.getByRole('menuitem', { name: 'Delete' })).toBeVisible()
    await expect(signedIn.getByRole('menuitem', { name: /Mark (not )?covered/ })).toHaveCount(0)
  })
})

test.describe('search scope', () => {
  test('the field says what it searches, and an empty result explains people', async ({
    signedIn,
  }) => {
    await signedIn.goto('/calendar')
    const field = signedIn.getByLabel('Search', { exact: true })
    await expect(field).toHaveAttribute('placeholder', 'Search meetings, notes, people')
    await field.fill('zzzz-nobody')
    await expect(signedIn.getByText(/People show up once you have a meeting with them/)).toBeVisible()
  })
})

test.describe('action item continuity', () => {
  test('a new item stays visible even when the filters exclude it', async ({ signedIn }) => {
    // A meeting with an item, so the Meeting filter has something to pick.
    await createMeeting(signedIn, 'Filter source')
    await signedIn.getByRole('button', { name: 'New action item' }).click()
    await signedIn.getByLabel('Action item text').last().fill('Belongs to the meeting')
    await signedIn.waitForTimeout(900)

    await signedIn.goto('/actions')
    await signedIn.getByLabel('Meeting', { exact: true }).selectOption({ label: 'Filter source' })

    // A standalone item does not match a meeting filter.
    await signedIn.getByRole('button', { name: '+ New action item' }).click()
    await expect(signedIn.getByText(/does not match the current filters/)).toBeVisible()
    await expect(signedIn.getByLabel('Action item text').last()).toBeFocused()
  })
})

test.describe('meetings archive landing', () => {
  test('always has a Today section with a sticky header', async ({ signedIn }) => {
    await createMeeting(signedIn, 'Today anchor')
    await signedIn.goto('/meetings')
    const today = signedIn.locator('#today')
    await expect(today).toBeVisible()
    const position = await today
      .getByRole('heading', { level: 2 })
      .evaluate((el) => getComputedStyle(el).position)
    expect(position).toBe('sticky')
  })
})
