/**
 * Screenshots of the connect prompts, which are otherwise unreachable once you
 * are connected: both render ONLY when the deployment has OAuth credentials
 * and the current user has not authorised.
 *
 * Not part of the normal suite. The webServer this run needs has GOOGLE_*
 * set (so `googleConfigured()` is true) while the database has no
 * google_connection row, and that combination is not how the other tests run.
 *
 *   npm run screens:connect
 *
 * Output lands in test/.screens/.
 */

import { test, expect } from '../harness/auth-fixture'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const OUT = join(process.cwd(), 'test/.screens')

test.beforeAll(() => mkdirSync(OUT, { recursive: true }))

test.describe('connect prompts', () => {
  test('first-run modal', async ({ signedIn }) => {
    await signedIn.goto('/calendar')

    const dialog = signedIn.getByRole('dialog', { name: 'Connect your calendar' })
    await expect(dialog).toBeVisible()
    await signedIn.screenshot({ path: join(OUT, 'connect-modal.png'), fullPage: false })
  })

  test('agenda card, after the modal is dismissed', async ({ signedIn }) => {
    await signedIn.goto('/calendar')

    // Dismiss the modal so the persistent card is what remains, which is the
    // state a returning user sees.
    await signedIn.getByRole('button', { name: 'Not now' }).click()
    await expect(signedIn.getByRole('dialog')).toHaveCount(0)

    const card = signedIn.getByText('Connect Google Calendar', { exact: true }).first()
    await expect(card).toBeVisible()
    await signedIn.screenshot({ path: join(OUT, 'connect-card.png'), fullPage: false })
  })

  test('dark mode', async ({ signedIn }) => {
    await signedIn.emulateMedia({ colorScheme: 'dark' })
    await signedIn.goto('/calendar')
    await expect(signedIn.getByRole('dialog')).toBeVisible()
    await signedIn.screenshot({ path: join(OUT, 'connect-modal-dark.png') })
  })
})
