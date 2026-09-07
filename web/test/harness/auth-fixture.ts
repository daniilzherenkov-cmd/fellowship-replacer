/**
 * Playwright fixture that signs browser requests as a given user.
 *
 * Mints a real RS256 token with the shared test key and sends it as
 * Cf-Access-Jwt-Assertion, exactly as Cloudflare Access would. The app's
 * production verification path runs unchanged.
 */

import { test as base, type Page } from '@playwright/test'
import { createSign } from 'node:crypto'
import { privateKey, KID, TEST_AUD } from './keys'
import { TEST_ISSUER_URL } from './setup'

function b64u(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function mintUiToken(email: string, opts: { expiresIn?: number } = {}): string {
  const now = Math.floor(Date.now() / 1000)
  const header = b64u(Buffer.from(JSON.stringify({ alg: 'RS256', kid: KID, typ: 'JWT' })))
  const payload = b64u(
    Buffer.from(
      JSON.stringify({
        email,
        sub: `sub-${email}`,
        iss: TEST_ISSUER_URL,
        aud: TEST_AUD,
        iat: now,
        exp: now + (opts.expiresIn ?? 3600),
      }),
    ),
  )
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${payload}`)
  return `${header}.${payload}.${b64u(signer.sign(privateKey()))}`
}

export const PRIMARY_USER = 'danya@deliveryhero.com'
export const OTHER_USER = 'someone.else@deliveryhero.com'

/** Send every request from this page as `email`. */
export async function signInAs(page: Page, email: string): Promise<void> {
  await page.setExtraHTTPHeaders({ 'cf-access-jwt-assertion': mintUiToken(email) })
}

export const test = base.extend<{ signedIn: Page }>({
  signedIn: async ({ page }, use) => {
    await signInAs(page, PRIMARY_USER)
    await use(page)
  },
})

export { expect } from '@playwright/test'
