/**
 * Credential encryption and OAuth handshake tests.
 *
 * Refresh tokens are long-lived: one leaked token grants ongoing access to a
 * live Google account until explicitly revoked. These tests cover the storage
 * and the handshake's CSRF defence.
 */

import { test, expect } from '@playwright/test'
import { encrypt, decrypt, safeEqual, randomToken, encryptionAvailable } from '../../src/lib/crypto'
import {
  buildAuthUrl,
  createPkce,
  CALENDAR_SCOPE,
  isPermanentAuthFailure,
  oauthConfig,
} from '../../src/lib/google-oauth'
import { createHash } from 'node:crypto'

test.beforeAll(() => {
  process.env.FELLOW_ENCRYPTION_KEY = 'test-key-that-is-long-enough-to-pass-the-check'
})

test.describe('credential encryption', () => {
  test('round-trips a refresh token', () => {
    const secret = '1//0abcdefghijklmnop-refresh-token'
    const decrypted = decrypt(encrypt(secret))
    expect(decrypted).toBe(secret)
  })

  test('produces different ciphertext each time (random IV)', () => {
    const a = encrypt('same input')
    const b = encrypt('same input')
    expect(a).not.toBe(b)
    expect(decrypt(a)).toBe(decrypt(b))
  })

  test('never leaks the plaintext into the stored value', () => {
    const secret = 'super-secret-refresh-token'
    expect(encrypt(secret)).not.toContain(secret)
  })

  test('detects tampering rather than decrypting to garbage', () => {
    const payload = encrypt('original value')
    const parts = payload.split(':')
    // Flip a byte in the ciphertext.
    const ct = Buffer.from(parts[3], 'base64url')
    ct[0] ^= 0xff
    parts[3] = ct.toString('base64url')
    expect(decrypt(parts.join(':'))).toBeNull()
  })

  test('returns null on malformed input instead of throwing', () => {
    expect(decrypt('')).toBeNull()
    expect(decrypt('not-encrypted')).toBeNull()
    expect(decrypt('v1:a:b')).toBeNull()
    expect(decrypt('v2:a:b:c')).toBeNull()
  })

  test('refuses to encrypt without a configured key', () => {
    const saved = process.env.FELLOW_ENCRYPTION_KEY
    delete process.env.FELLOW_ENCRYPTION_KEY
    expect(encryptionAvailable()).toBe(false)
    // Must throw, never silently fall back to a default key.
    expect(() => encrypt('x')).toThrow(/FELLOW_ENCRYPTION_KEY/)
    process.env.FELLOW_ENCRYPTION_KEY = saved
  })

  test('rejects a too-short key', () => {
    const saved = process.env.FELLOW_ENCRYPTION_KEY
    process.env.FELLOW_ENCRYPTION_KEY = 'short'
    expect(encryptionAvailable()).toBe(false)
    expect(() => encrypt('x')).toThrow()
    process.env.FELLOW_ENCRYPTION_KEY = saved
  })

  test('cannot decrypt with a different key', () => {
    const payload = encrypt('secret')
    process.env.FELLOW_ENCRYPTION_KEY = 'a-completely-different-key-of-sufficient-length'
    expect(decrypt(payload)).toBeNull()
    process.env.FELLOW_ENCRYPTION_KEY = 'test-key-that-is-long-enough-to-pass-the-check'
  })
})

test.describe('safeEqual', () => {
  test('matches identical strings and rejects others', () => {
    expect(safeEqual('abc', 'abc')).toBe(true)
    expect(safeEqual('abc', 'abd')).toBe(false)
    expect(safeEqual('abc', 'abcd')).toBe(false)
    expect(safeEqual('', '')).toBe(true)
  })
})

test.describe('PKCE', () => {
  test('challenge is the S256 hash of the verifier', () => {
    const { verifier, challenge } = createPkce()
    expect(challenge).toBe(createHash('sha256').update(verifier).digest('base64url'))
  })

  test('each pair is unique', () => {
    expect(createPkce().verifier).not.toBe(createPkce().verifier)
  })
})

test.describe('consent URL', () => {
  const config = {
    clientId: 'test-client.apps.googleusercontent.com',
    clientSecret: 'test-secret',
    redirectUri: 'https://fellow2.dhapps.ai/api/auth/google/callback',
  }

  test('requests offline access so a refresh token is returned', () => {
    const url = new URL(
      buildAuthUrl({ config, state: 'st', challenge: 'ch' }),
    )
    // Without BOTH of these, Google withholds the refresh token on a repeat
    // authorisation and sync silently dies an hour later.
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('prompt')).toBe('consent')
  })

  test('requests read-only calendar scope only', () => {
    const url = new URL(buildAuthUrl({ config, state: 'st', challenge: 'ch' }))
    expect(url.searchParams.get('scope')).toBe(CALENDAR_SCOPE)
    expect(url.searchParams.get('scope')).toContain('readonly')
  })

  test('carries state and the PKCE challenge', () => {
    const url = new URL(buildAuthUrl({ config, state: 'my-state', challenge: 'my-challenge' }))
    expect(url.searchParams.get('state')).toBe('my-state')
    expect(url.searchParams.get('code_challenge')).toBe('my-challenge')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
  })

  test('never puts the client secret in the URL', () => {
    const url = buildAuthUrl({ config, state: 'st', challenge: 'ch' })
    expect(url).not.toContain(config.clientSecret)
  })

  test('passes a login hint when given', () => {
    const url = new URL(
      buildAuthUrl({ config, state: 'st', challenge: 'ch', loginHint: 'a@deliveryhero.com' }),
    )
    expect(url.searchParams.get('login_hint')).toBe('a@deliveryhero.com')
  })
})

test.describe('configuration gating', () => {
  test('reports unconfigured when env vars are absent', () => {
    const saved = { ...process.env }
    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_CLIENT_SECRET
    delete process.env.GOOGLE_REDIRECT_URI
    expect(oauthConfig()).toBeNull()
    Object.assign(process.env, saved)
  })

  test('requires all three values, not just some', () => {
    const saved = { ...process.env }
    process.env.GOOGLE_CLIENT_ID = 'id'
    delete process.env.GOOGLE_CLIENT_SECRET
    process.env.GOOGLE_REDIRECT_URI = 'https://x/cb'
    expect(oauthConfig()).toBeNull()
    Object.assign(process.env, saved)
  })
})

test.describe('permanent auth failure detection', () => {
  test('recognises a revoked grant', () => {
    expect(isPermanentAuthFailure(new Error('Google token error: invalid_grant'))).toBe(true)
    expect(isPermanentAuthFailure(new Error('Google token error: invalid_client'))).toBe(true)
  })

  test('does not treat transient errors as permanent', () => {
    expect(isPermanentAuthFailure(new Error('fetch failed'))).toBe(false)
    expect(isPermanentAuthFailure(new Error('Calendar API 503'))).toBe(false)
  })
})

test.describe('randomToken', () => {
  test('is url-safe and unique', () => {
    const t = randomToken()
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(randomToken()).not.toBe(t)
  })
})
