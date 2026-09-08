/**
 * End-to-end UI tests.
 *
 * These drive the real app with genuine signed Access tokens, so the auth path
 * under test is the one that runs in production.
 *
 * The isolation test is the one that matters most: on Protoship, any Delivery
 * Hero account can reach this app, so per-user scoping is the only thing
 * keeping one manager's 1:1 notes away from everyone else.
 */

import { test, expect, signInAs, PRIMARY_USER, OTHER_USER, mintUiToken } from '../harness/auth-fixture'

async function createMeeting(page: import('@playwright/test').Page, title: string) {
  await page.goto('/calendar')
  await page.getByRole('button', { name: '+ New meeting' }).click()
  await page.waitForURL(/\/meetings\/[a-f0-9-]+$/)
  const titleInput = page.getByLabel('Meeting title')
  await titleInput.fill(title)
  // Title autosaves on a 500ms debounce.
  await page.waitForTimeout(900)
  return page.url()
}

test.describe('authentication', () => {
  test('an unauthenticated visitor sees no data', async ({ page }) => {
    // No Access header at all.
    await page.goto('/calendar')
    await expect(page.getByText('Not signed in')).toBeVisible()
  })

  test('a forged plain email header is not accepted', async ({ page }) => {
    // The header most apps on this platform trust directly.
    await page.setExtraHTTPHeaders({
      'cf-access-authenticated-user-email': 'attacker@deliveryhero.com',
    })
    await page.goto('/calendar')
    await expect(page.getByText('Not signed in')).toBeVisible()
  })

  test('an expired token is rejected', async ({ page }) => {
    await page.setExtraHTTPHeaders({
      'cf-access-jwt-assertion': mintUiToken(PRIMARY_USER, { expiresIn: -60 }),
    })
    await page.goto('/calendar')
    await expect(page.getByText('Not signed in')).toBeVisible()
  })

  test('a valid token signs the user in', async ({ signedIn }) => {
    await signedIn.goto('/calendar')
    await expect(signedIn.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(signedIn.getByText(PRIMARY_USER)).toBeVisible()
  })
})

test.describe('meeting note', () => {
  test('creates a meeting and persists the whole note across a reload', async ({ signedIn }) => {
    const url = await createMeeting(signedIn, 'Weekly 1:1')

    await signedIn.getByRole('button', { name: 'New talking point' }).click()
    await signedIn.getByLabel('Talking point').last().fill('Discuss roadmap')

    await signedIn.getByRole('button', { name: 'New action item' }).click()
    await signedIn.getByLabel('Action item text').last().fill('Send the summary')

    await signedIn.getByLabel('Notepad').fill('Some free-form notes.')

    // Autosave debounces at 400-500ms.
    await signedIn.waitForTimeout(1200)
    await signedIn.goto(url)

    await expect(signedIn.getByLabel('Meeting title')).toHaveValue('Weekly 1:1')
    await expect(signedIn.getByLabel('Talking point').first()).toHaveValue('Discuss roadmap')
    await expect(signedIn.getByLabel('Action item text').first()).toHaveValue('Send the summary')
    await expect(signedIn.getByLabel('Notepad')).toHaveValue('Some free-form notes.')
  })

  test('adding a second row does not discard the first row\'s text', async ({ signedIn }) => {
    // Regression: the debounced text save was being discarded by the
    // router.refresh() that follows adding a row, silently losing typed text.
    const url = await createMeeting(signedIn, 'Rapid entry')

    const points = ['First point', 'Second point']
    for (const [i, t] of points.entries()) {
      await signedIn.getByRole('button', { name: 'New talking point' }).click()
      // Wait for the new row to exist before typing, otherwise .last() still
      // resolves to the previous row and overwrites it.
      await expect(signedIn.getByLabel('Talking point')).toHaveCount(i + 1)
      await signedIn.getByLabel('Talking point').last().fill(t)
      // Deliberately shorter than the 400ms debounce: the next add must not
      // discard this pending save.
      await signedIn.waitForTimeout(150)
    }

    const tasks = ['First task', 'Second task']
    for (const [i, t] of tasks.entries()) {
      await signedIn.getByRole('button', { name: 'New action item' }).click()
      await expect(signedIn.getByLabel('Action item text')).toHaveCount(i + 1)
      await signedIn.getByLabel('Action item text').last().fill(t)
      await signedIn.waitForTimeout(150)
    }

    await signedIn.waitForTimeout(1000)
    await signedIn.goto(url)

    expect(
      await signedIn.getByLabel('Talking point').evaluateAll((els) =>
        els.map((e) => (e as HTMLInputElement).value),
      ),
    ).toEqual(['First point', 'Second point'])
    expect(
      await signedIn.getByLabel('Action item text').evaluateAll((els) =>
        els.map((e) => (e as HTMLInputElement).value),
      ),
    ).toEqual(['First task', 'Second task'])
  })

  test('infers a 1:1 from a "A / B" title', async ({ signedIn }) => {
    await createMeeting(signedIn, 'Danya / Milena')
    await signedIn.reload()
    await expect(signedIn.getByText('1:1', { exact: true })).toBeVisible()
  })

  test('keeps Calendar active in the rail while viewing a note', async ({ signedIn }) => {
    await createMeeting(signedIn, 'Rail check')
    await expect(signedIn.getByRole('link', { name: /Calendar/ })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  test('renders the three fixed blocks in order', async ({ signedIn }) => {
    await createMeeting(signedIn, 'Template check')
    const headings = await signedIn.getByRole('heading', { level: 2 }).allTextContents()
    expect(headings).toEqual(['Talking Points', 'Action Items', 'Notepad'])
  })

  test('marks a talking point covered', async ({ signedIn }) => {
    const url = await createMeeting(signedIn, 'Covered test')
    await signedIn.getByRole('button', { name: 'New talking point' }).click()
    await signedIn.getByLabel('Talking point').last().fill('A point')
    await signedIn.waitForTimeout(700)

    await signedIn.getByRole('button', { name: 'Mark covered' }).click()
    await signedIn.waitForTimeout(500)
    await signedIn.goto(url)

    await expect(signedIn.getByRole('button', { name: 'Mark not covered' })).toBeVisible()
  })
})

test.describe('unified action list', () => {
  test('checking an item in the note checks it in the unified list', async ({ signedIn }) => {
    await createMeeting(signedIn, 'Cross-screen test')
    await signedIn.getByRole('button', { name: 'New action item' }).click()
    await signedIn.getByLabel('Action item text').last().fill('Shared item')
    await signedIn.waitForTimeout(900)

    // Tick it in the note.
    await signedIn.getByRole('checkbox').first().click()
    await signedIn.waitForTimeout(600)

    // The unified list shows only open items by default, so a checked item
    // should have left it.
    await signedIn.goto('/actions')
    await expect(signedIn.getByText('Shared item')).toHaveCount(0)
  })

  test('an open item appears in the unified list with a back-link', async ({ signedIn }) => {
    const url = await createMeeting(signedIn, 'Backlink source')
    await signedIn.getByRole('button', { name: 'New action item' }).click()
    await signedIn.getByLabel('Action item text').last().fill('Follow up on pricing')
    await signedIn.waitForTimeout(900)

    await signedIn.goto('/actions')
    // Tests share one database, so locate this item by value rather than
    // assuming it is the first row.
    const row = signedIn
      .getByTestId('action-item-row')
      .filter({ has: signedIn.locator('input[value="Follow up on pricing"]') })
    await expect(row).toHaveCount(1)

    // The source line only appears on hover, matching Fellow.
    await row.hover()
    const link = row.getByRole('button', { name: 'Backlink source' })
    await expect(link).toBeVisible()
    await link.click()
    await expect(signedIn).toHaveURL(url)
  })

  test('groups items into Overdue / Today / Upcoming / Inbox', async ({ signedIn }) => {
    await createMeeting(signedIn, 'Grouping test')
    await signedIn.getByRole('button', { name: 'New action item' }).click()
    await signedIn.getByLabel('Action item text').last().fill('Due today item')
    await signedIn.waitForTimeout(900)

    const row = signedIn.getByTestId('action-item-row').first()
    await row.hover()
    await row.getByRole('button', { name: 'More actions' }).click()
    await signedIn.getByRole('menuitem', { name: 'Due today' }).click()
    await signedIn.waitForTimeout(600)

    await signedIn.goto('/actions')
    await expect(signedIn.getByRole('heading', { name: 'Today' })).toBeVisible()
  })
})

test.describe('calendar week view', () => {
  test('toggles between Today and Week', async ({ signedIn }) => {
    await signedIn.goto('/calendar')
    // Today is the default.
    await expect(signedIn.getByRole('tab', { name: 'today' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await signedIn.getByRole('tab', { name: 'week' }).click()
    await expect(signedIn.getByRole('tab', { name: 'week' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  test('renders a 7-column grid with weekday headers', async ({ signedIn }) => {
    await signedIn.goto('/calendar')
    await signedIn.getByRole('tab', { name: 'week' }).click()
    for (const day of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) {
      await expect(signedIn.getByText(day, { exact: true })).toBeVisible()
    }
  })

  test('shows a meeting in the week grid and opens it', async ({ signedIn }) => {
    const url = await createMeeting(signedIn, 'Week grid meeting')
    await signedIn.goto('/calendar')
    await signedIn.getByRole('tab', { name: 'week' }).click()

    const chip = signedIn.getByTestId('week-event').filter({ hasText: 'Week grid meeting' })
    await expect(chip).toHaveCount(1)
    await chip.click()
    await expect(signedIn).toHaveURL(url)
  })
})

test.describe('per-user isolation', () => {
  test('one user cannot see or open another user\'s meeting', async ({ page, browser }) => {
    // User A creates a meeting.
    await signInAs(page, PRIMARY_USER)
    const url = await createMeeting(page, 'Private 1:1 about compensation')

    // User B, in a clean context, must not see it anywhere.
    const otherContext = await browser.newContext({
      extraHTTPHeaders: { 'cf-access-jwt-assertion': mintUiToken(OTHER_USER) },
    })
    const otherPage = await otherContext.newPage()

    await otherPage.goto('/meetings')
    await expect(otherPage.getByText('Private 1:1 about compensation')).toHaveCount(0)

    // Even with the exact URL, which is the real attack: ids are guessable
    // from a shared link or a log.
    const response = await otherPage.goto(url)
    expect(response?.status()).toBe(404)
    await expect(otherPage.getByText('Private 1:1 about compensation')).toHaveCount(0)

    await otherContext.close()
  })

  test('action items are scoped per user', async ({ page, browser }) => {
    await signInAs(page, PRIMARY_USER)
    await createMeeting(page, 'Owner meeting')
    await page.getByRole('button', { name: 'New action item' }).click()
    await page.getByLabel('Action item text').last().fill('Owner only task')
    await page.waitForTimeout(900)

    const otherContext = await browser.newContext({
      extraHTTPHeaders: { 'cf-access-jwt-assertion': mintUiToken(OTHER_USER) },
    })
    const otherPage = await otherContext.newPage()
    await otherPage.goto('/actions')
    await expect(otherPage.getByText('Owner only task')).toHaveCount(0)
    await expect(otherPage.getByText('All clear')).toBeVisible()
    await otherContext.close()
  })
})

test.describe('settings', () => {
  test('explains that Google Calendar is not configured yet', async ({ signedIn }) => {
    await signedIn.goto('/settings')
    await expect(signedIn.getByRole('heading', { name: 'Google Calendar' })).toBeVisible()
    // Honest state: no credentials in this deployment yet.
    await expect(signedIn.getByText(/not set up in this deployment yet/i)).toBeVisible()
  })

  test('sync endpoint refuses when Google is not configured', async ({ signedIn }) => {
    const res = await signedIn.request.post('/api/calendar/sync', {
      headers: { 'cf-access-jwt-assertion': mintUiToken(PRIMARY_USER) },
    })
    expect(res.status()).toBe(503)
  })
})

test.describe('navigation', () => {
  test('the icon rail reaches every section', async ({ signedIn }) => {
    await signedIn.goto('/calendar')
    for (const [name, heading] of [
      ['Actions', 'Action items'],
      ['People', 'People'],
      ['Meetings', 'Meetings'],
    ] as const) {
      await signedIn.getByRole('link', { name: new RegExp(name) }).click()
      await expect(signedIn.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
    }
  })
})
