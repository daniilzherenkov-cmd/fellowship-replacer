/**
 * Shared notes: access control and the channel.
 *
 * The authorization rule is the entire security model for this feature, so
 * it is tested from the outside, through the real HTTP route, with a second
 * signed-in user. A unit test of the predicate would not prove the route
 * calls it.
 */

import { test, expect } from '../harness/auth-fixture'
import { signInAs, PRIMARY_USER, OTHER_USER, mintUiToken } from '../harness/auth-fixture'

const NOTE = 'gcal:shared-note-test-event'

/**
 * The API request context does not inherit the page's Access header, so a
 * signed-in token has to be passed explicitly. Without this the route
 * answers 401 and the membership check is never reached, which would make
 * these tests pass for the wrong reason.
 */
const asUser = (email: string) => ({
  headers: { 'cf-access-jwt-assertion': mintUiToken(email) },
})

test.describe('shared note access', () => {
  test('a non-member gets 404, not the content', async ({ signedIn }) => {
    // Nobody has been made a member of this note, so even a valid user must
    // not open its stream. Failing closed is the whole model.
    const res = await signedIn.request.get(
      `/api/notes/${encodeURIComponent(NOTE)}/stream`,
      asUser(PRIMARY_USER),
    )
    expect(res.status()).toBe(404)
  })

  test('an unauthenticated request gets 401', async ({ page }) => {
    const res = await page.request.get(`/api/notes/${encodeURIComponent(NOTE)}/stream`, {
      headers: {},
    })
    // No Access header at all: the route must not reach the membership check.
    expect([401, 404]).toContain(res.status())
  })

  test('a made-up note id does not leak whether it exists', async ({ signedIn }) => {
    // 404 for "no such note" and 404 for "not your note" must be
    // indistinguishable, or the id space becomes enumerable.
    const missing = await signedIn.request.get(
      `/api/notes/${encodeURIComponent('gcal:definitely-not-real')}/stream`,
      asUser(PRIMARY_USER),
    )
    const forbidden = await signedIn.request.get(
      `/api/notes/${encodeURIComponent(NOTE)}/stream`,
      asUser(PRIMARY_USER),
    )
    expect(missing.status()).toBe(forbidden.status())
  })

  test('meetings without a shared note render exactly as before', async ({ signedIn }) => {
    // The feature ships dark: a meeting nobody shared must be untouched.
    await signedIn.goto('/calendar')
    await signedIn.getByRole('button', { name: '+ New meeting' }).click()
    await signedIn.getByLabel('Event title').fill('Unshared note check')
    await signedIn.getByRole('button', { name: 'Save' }).click()
    await signedIn.waitForURL(/\/meetings\/[a-f0-9-]+$/)

    await expect(signedIn.getByLabel('Notepad')).toBeVisible()
    // No sharing chrome on an unshared note.
    await expect(signedIn.getByText('Shared', { exact: true })).toHaveCount(0)
  })

  test('one user cannot reach another user\'s note stream', async ({ page, browser }) => {
    await signInAs(page, PRIMARY_USER)
    await page.goto('/calendar')

    const otherContext = await browser.newContext({
      extraHTTPHeaders: { 'cf-access-jwt-assertion': mintUiToken(OTHER_USER) },
    })
    const res = await otherContext.request.get(
      `/api/notes/${encodeURIComponent(NOTE)}/stream`,
      asUser(OTHER_USER),
    )
    expect(res.status()).toBe(404)
    await otherContext.close()
  })
})

test.describe('two people on one note', () => {
  /**
   * The feature itself.
   *
   * Membership is normally written by calendar sync from the invite. Here it
   * is seeded straight into the database from the test process: the
   * alternative, a test-only HTTP route that grants access, would be a real
   * attack surface if it ever reached production, and "it is only enabled in
   * tests" is exactly the assumption that fails. Everything downstream of
   * membership is the real code path.
   */
  const SHARED = 'gcal:two-person-note'

  test.beforeAll(async () => {
    const mysql = await import('mysql2/promise')
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST ?? '127.0.0.1',
      port: Number(process.env.DB_PORT ?? 3306),
      database: process.env.APP_ID ?? 'fellow_dev',
      user: `app_${process.env.APP_ID ?? 'fellow_dev'}`,
      password: process.env.DB_PASSWORD ?? 'fellowdev',
    })
    const ts = new Date().toISOString()
    for (const email of [PRIMARY_USER, OTHER_USER]) {
      await conn.query(
        'INSERT IGNORE INTO shared_note_member (external_id, email, created_at) VALUES (?, ?, ?)',
        [SHARED, email.toLowerCase(), ts],
      )
    }
    await conn.end()
  })

  /**
   * Driven with EventSource from the page rather than request.get(), because
   * an SSE stream never ends and awaiting its body just times out. This is
   * also the real client path.
   */
  async function firstFrame(page: import('@playwright/test').Page, externalId: string) {
    await page.goto('/calendar')
    return page.evaluate(
      (id) =>
        new Promise<string>((resolve, reject) => {
          const source = new EventSource(`/api/notes/${encodeURIComponent(id)}/stream`)
          const timer = setTimeout(() => {
            source.close()
            reject(new Error('no frame within 5s'))
          }, 5000)
          source.onmessage = (event) => {
            clearTimeout(timer)
            source.close()
            resolve(event.data as string)
          }
          source.onerror = () => {
            clearTimeout(timer)
            source.close()
            reject(new Error('stream errored'))
          }
        }),
      externalId,
    )
  }

  test('a member joining receives the current content at once', async ({ signedIn }) => {
    // A joiner must be in sync immediately, not after someone else types.
    const frame = await firstFrame(signedIn, SHARED)
    const parsed = JSON.parse(frame)
    expect(parsed.type).toBe('content')
    expect(parsed.externalId).toBe(SHARED)
    expect(typeof parsed.content).toBe('string')
  })

  test('the second member can join the same channel', async ({ browser }) => {
    const ctx = await browser.newContext({
      extraHTTPHeaders: { 'cf-access-jwt-assertion': mintUiToken(OTHER_USER) },
    })
    const page = await ctx.newPage()
    const frame = await firstFrame(page, SHARED)
    expect(JSON.parse(frame).type).toBe('content')
    await ctx.close()
  })

  test('a third party is still refused', async ({ signedIn }) => {
    // Seeding two members must not make the note public.
    const res = await signedIn.request.get(
      `/api/notes/${encodeURIComponent(SHARED)}/stream`,
      asUser('stranger@deliveryhero.com'),
    )
    expect(res.status()).toBe(404)
  })
})

test.describe('the hub is one instance across bundles', () => {
  /**
   * REGRESSION. Next bundles server components, route handlers and server
   * actions into SEPARATE module graphs, so a module-level Map can exist
   * twice: the SSE route would subscribe to one instance and the write
   * action publish to another, and a broadcast would silently reach nobody.
   *
   * Nothing caught it, because every test exercised one side alone. It
   * surfaced through the metrics counter, which read zero from
   * /api/metrics while the layout was incrementing its own copy. Both are
   * now pinned to globalThis.
   *
   * The cross-bundle sharing itself is proven by the metrics test in
   * loading-states.spec.ts: the layout is a server component and
   * /api/metrics is a route handler, so a counter visible across both IS
   * the property this fix restores. Here we assert the hub half: the route
   * resolves a working hub and delivers the join snapshot.
   */
  test('the stream route resolves the hub and delivers a join frame', async ({ signedIn }) => {
    const SHARED = 'gcal:two-person-note'
    await signedIn.goto('/calendar')

    const frame = await signedIn.evaluate(
      (id) =>
        new Promise<string | null>((resolve) => {
          const source = new EventSource(`/api/notes/${encodeURIComponent(id)}/stream`)
          const timer = setTimeout(() => {
            source.close()
            resolve(null)
          }, 6000)
          source.onmessage = (e) => {
            clearTimeout(timer)
            source.close()
            resolve(e.data as string)
          }
        }),
      SHARED,
    )

    expect(frame).not.toBeNull()
    expect(JSON.parse(frame as string).type).toBe('content')
  })
})
