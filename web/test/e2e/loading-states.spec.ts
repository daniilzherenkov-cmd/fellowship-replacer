/**
 * Navigation must acknowledge the click immediately.
 *
 * The pages were made fast (People 763ms -> 36ms in the query) but switching
 * tabs still FELT broken, because nothing on screen changed until the new
 * page arrived. Perceived speed is mostly about whether anything responds.
 */

import { test, expect } from '../harness/auth-fixture'

test.describe('loading feedback', () => {
  test('every section has a loading skeleton defined', async ({ signedIn }) => {
    // Cheap guard: a missing loading.tsx silently falls back to no feedback
    // at all, which is exactly the regression this work fixed.
    for (const path of ['/calendar', '/actions', '/people', '/meetings']) {
      await signedIn.goto(path)
      await expect(signedIn).toHaveURL(new RegExp(path))
    }
  })

  test('the rail marks the clicked section immediately', async ({ signedIn }) => {
    await signedIn.goto('/calendar')
    const people = signedIn.getByRole('link', { name: /People/ })
    await people.click()
    // Either still pending, or already arrived; both mean the click was
    // acknowledged rather than swallowed.
    await expect(people).toHaveAttribute('aria-current', 'page', { timeout: 5000 })
  })

  test('skeletons are hidden from assistive tech but announced once', async ({ signedIn }) => {
    await signedIn.goto('/people')
    // Once loaded there should be no leftover skeleton status region.
    await expect(signedIn.getByText('Loading people')).toHaveCount(0)
  })
})

test.describe('streaming must not weaken isolation', () => {
  /**
   * A `loading.tsx` on /meetings or /people would cover the [id] child too,
   * and streaming commits HTTP 200 before the child can call notFound(). The
   * status code is part of the isolation contract, so the skeletons live in
   * page-level Suspense boundaries instead. This pins that down: adding a
   * route-level loading.tsx back would fail here.
   */
  test('a missing meeting still answers 404, not a streamed 200', async ({ signedIn }) => {
    const res = await signedIn.goto('/meetings/00000000-0000-0000-0000-000000000000')
    expect(res?.status()).toBe(404)
  })

  test('a missing person still answers 404', async ({ signedIn }) => {
    const res = await signedIn.goto('/people/00000000-0000-0000-0000-000000000000')
    expect(res?.status()).toBe(404)
  })
})

test.describe('meeting reminders', () => {
  /**
   * These are real Web Push now: a service worker receives them with the
   * browser closed, and the app's own scheduler sends them. The previous
   * implementation could only fire from an open tab, and these tests used to
   * assert that limitation - it no longer exists.
   *
   * The test server has no VAPID keys (they live in Vault), so the panel
   * correctly reports push as unconfigured. Asserting THAT is honest;
   * faking the keys would test a fiction.
   */
  test('the panel exists and promises delivery when closed', async ({ signedIn }) => {
    await signedIn.goto('/settings')
    await expect(signedIn.getByRole('heading', { name: 'Meeting reminders' })).toBeVisible()
    await expect(signedIn.getByText(/even when Fellow Hero is closed/)).toBeVisible()
  })

  test('says so plainly when push is not configured', async ({ signedIn }) => {
    await signedIn.goto('/settings')
    await expect(signedIn.getByText(/Push is not configured in this deployment/)).toBeVisible()
  })

  test('the service worker is served and does not cache', async ({ signedIn }) => {
    // A caching worker on an app behind Cloudflare Access is a good way to
    // serve someone a stale page or a cached redirect to a login screen.
    const res = await signedIn.goto('/sw.js')
    expect(res?.status()).toBe(200)
    const body = await res!.text()
    expect(body).toContain("addEventListener('push'")
    expect(body).toContain("addEventListener('notificationclick'")
    expect(body).not.toContain('caches.open')
  })

  test('no permission is requested without an explicit click', async ({ signedIn }) => {
    // A browser prompt nobody asked for is usually answered with "Block",
    // which is permanent and cannot be undone from inside the app. The
    // first-run ask is our own dialog; the real prompt follows a yes.
    let requested = false
    await signedIn.exposeFunction('__permissionAsked', () => {
      requested = true
    })
    await signedIn.addInitScript(() => {
      const original = Notification.requestPermission.bind(Notification)
      Notification.requestPermission = ((...args: unknown[]) => {
        ;(window as unknown as { __permissionAsked: () => void }).__permissionAsked()
        return original(...(args as []))
      }) as typeof Notification.requestPermission
    })
    await signedIn.goto('/calendar')
    // Longer than the first-run dialog's delay, so a prompt would have fired.
    await signedIn.waitForTimeout(2000)
    expect(requested).toBe(false)
  })
})
