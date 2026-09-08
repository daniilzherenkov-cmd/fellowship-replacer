/**
 * Auth verification tests.
 *
 * These are the most important tests in the suite. On Protoship, any Delivery
 * Hero Okta account can reach this app; per-user row scoping keyed off a
 * verified identity is the only barrier protecting HR-adjacent 1:1 notes.
 *
 * Every negative case here is a real attack shape, not a formality:
 *   - no token            -> the unauthenticated caller
 *   - alg:none            -> the classic JWT bypass
 *   - forged signature    -> attacker mints their own token
 *   - expired             -> replayed old token
 *   - wrong issuer / aud  -> a valid token for a DIFFERENT dhapps.ai app
 *
 * That last one matters most on this platform: every app sits behind the same
 * Access instance, so a token issued for someone else's app is easy to obtain.
 */

import { test, expect } from '@playwright/test'
import {
  mintJwt,
  mintForgedJwt,
  mintAlgNoneJwt,
  jwks,
  TEST_ISSUER,
  TEST_AUD,
} from '../harness/jwt'
import { verifyAccessJwt, __setJwksForTests } from '../../src/lib/auth'

test.beforeAll(() => {
  process.env.CF_ACCESS_ISSUER = TEST_ISSUER
  process.env.CF_ACCESS_AUD = TEST_AUD
  __setJwksForTests(jwks().keys as never)
})

test.describe('Access JWT verification', () => {
  test('accepts a well-formed token and returns the identity', async () => {
    const token = mintJwt({ email: 'Milena.Lazarevska@deliveryhero.com' })
    const id = await verifyAccessJwt(token)
    expect(id).not.toBeNull()
    // Email must be normalised, or per-user scoping breaks on case alone.
    expect(id?.email).toBe('milena.lazarevska@deliveryhero.com')
  })

  test('rejects a token signed by a different key', async () => {
    const id = await verifyAccessJwt(mintForgedJwt('attacker@deliveryhero.com'))
    expect(id).toBeNull()
  })

  test('rejects alg:none', async () => {
    const id = await verifyAccessJwt(mintAlgNoneJwt('attacker@deliveryhero.com'))
    expect(id).toBeNull()
  })

  test('rejects an expired token', async () => {
    const id = await verifyAccessJwt(
      mintJwt({ email: 'someone@deliveryhero.com', expiresIn: -60 }),
    )
    expect(id).toBeNull()
  })

  test('rejects a token from another issuer', async () => {
    const id = await verifyAccessJwt(
      mintJwt({ email: 'someone@deliveryhero.com', issuer: 'https://evil.example' }),
    )
    expect(id).toBeNull()
  })

  test('rejects a valid token minted for a different dhapps.ai app', async () => {
    const id = await verifyAccessJwt(
      mintJwt({ email: 'someone@deliveryhero.com', audience: 'some-other-app' }),
    )
    expect(id).toBeNull()
  })

  test('rejects garbage and empty input', async () => {
    expect(await verifyAccessJwt('')).toBeNull()
    expect(await verifyAccessJwt('not-a-jwt')).toBeNull()
    expect(await verifyAccessJwt('a.b')).toBeNull()
  })

  test('fails closed when no JWKS is reachable', async () => {
    __setJwksForTests(null)
    process.env.CF_ACCESS_ISSUER = 'http://127.0.0.1:1' // nothing listening
    const id = await verifyAccessJwt(mintJwt({ email: 'someone@deliveryhero.com' }))
    expect(id).toBeNull()
    // restore for later tests
    process.env.CF_ACCESS_ISSUER = TEST_ISSUER
    __setJwksForTests(jwks().keys as never)
  })
})
