/**
 * Cloudflare Access identity verification.
 *
 * Protoship serves every *.dhapps.ai host behind one shared Cloudflare Access
 * policy that admits ANY Delivery Hero Okta account. There is no per-app
 * allow-list (`share_website` is a no-op). So the platform gives us
 * AUTHENTICATION but never AUTHORIZATION: we learn who the viewer is, and it is
 * entirely on us to refuse the ones who shouldn't see a given row.
 *
 * Because 1:1 notes are HR-adjacent, this module:
 *   1. verifies the SIGNED JWT (Cf-Access-Jwt-Assertion), not the plain
 *      Cf-Access-Authenticated-User-Email header, which is only
 *      perimeter-trusted and would be spoofable off-Access; and
 *   2. FAILS CLOSED. A missing or invalid assertion yields null, never a
 *      fallback identity.
 *
 * Do NOT add a `?? process.env.DEV_USER_EMAIL` style fallback. That exact
 * pattern is a documented full-admin backdoor in another DH app.
 */

import { createPublicKey, verify as cryptoVerify } from 'node:crypto'
import type { JsonWebKey } from 'node:crypto'

const JWT_HEADER = 'cf-access-jwt-assertion'

/** Team domain issuer for the shared dhapps.ai Access instance. */
const DEFAULT_ISSUER = 'https://dhappsai.cloudflareaccess.com'
const JWKS_CACHE_MS = 10 * 60 * 1000

export interface AccessIdentity {
  email: string
  /** Access subject id - stable per user, useful as a row owner key. */
  sub: string
}

interface Jwk {
  kid: string
  kty: string
  n: string
  e: string
  alg?: string
}

let jwksCache: { keys: Jwk[]; fetchedAt: number } | null = null
let warnedMissingAudience = false

/** Log once, not per request. */
function warnMissingAudienceOnce(): void {
  if (warnedMissingAudience) return
  warnedMissingAudience = true
  console.warn(
    JSON.stringify({
      level: 'warn',
      msg:
        'CF_ACCESS_AUD is not set. Access tokens issued for OTHER apps on this ' +
        'Cloudflare Access instance will be accepted. Set it to this app\'s ' +
        'Access application audience tag.',
    }),
  )
}

function issuer(): string {
  return process.env.CF_ACCESS_ISSUER?.replace(/\/$/, '') || DEFAULT_ISSUER
}

/** Base64url -> Buffer. */
function b64u(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

async function getJwks(): Promise<Jwk[]> {
  const now = Date.now()
  if (jwksCache && now - jwksCache.fetchedAt < JWKS_CACHE_MS) return jwksCache.keys

  const res = await fetch(`${issuer()}/cdn-cgi/access/certs`)
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`)
  const body = (await res.json()) as { keys?: Jwk[] }
  const keys = body.keys ?? []
  jwksCache = { keys, fetchedAt: now }
  return keys
}

/** Test seam: lets the e2e harness install a locally-minted JWKS. */
export function __setJwksForTests(keys: Jwk[] | null): void {
  jwksCache = keys ? { keys, fetchedAt: Date.now() } : null
}

function jwkToPem(jwk: Jwk) {
  return createPublicKey({ key: jwk as unknown as JsonWebKey, format: 'jwk' })
}

/**
 * Verify an Access JWT and return its identity, or null.
 *
 * Never throws on an untrusted token - a bad token is simply "not signed in".
 * Returning null must always mean 401 at the call site.
 */
export async function verifyAccessJwt(token: string): Promise<AccessIdentity | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [rawHeader, rawPayload, rawSignature] = parts

    const header = JSON.parse(b64u(rawHeader).toString('utf8')) as {
      alg?: string
      kid?: string
    }
    // Reject `alg: none` and any non-RS256 algorithm outright, rather than
    // trusting whatever the token asks for.
    if (header.alg !== 'RS256' || !header.kid) return null

    const jwk = (await getJwks()).find((k) => k.kid === header.kid)
    if (!jwk) return null

    const signed = Buffer.from(`${rawHeader}.${rawPayload}`, 'utf8')
    const ok = cryptoVerify('RSA-SHA256', signed, jwkToPem(jwk), b64u(rawSignature))
    if (!ok) return null

    const payload = JSON.parse(b64u(rawPayload).toString('utf8')) as {
      email?: string
      sub?: string
      exp?: number
      nbf?: number
      iss?: string
      aud?: string | string[]
    }

    const nowSec = Math.floor(Date.now() / 1000)
    if (typeof payload.exp !== 'number' || payload.exp <= nowSec) return null
    if (typeof payload.nbf === 'number' && payload.nbf > nowSec) return null
    if (payload.iss !== issuer()) return null

    // Audience binds the token to THIS application. Without it a valid token
    // for any other dhapps.ai app would be accepted here.
    const expectedAud = process.env.CF_ACCESS_AUD
    if (expectedAud) {
      const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud]
      if (!aud.includes(expectedAud)) return null
    } else if (process.env.NODE_ENV === 'production') {
      // Every app on this platform sits behind the SAME Access instance, so
      // without an audience check a token minted for someone else's app would
      // authenticate here. Signature/issuer/expiry still hold, but this is
      // weaker than intended - make it visible rather than silently degraded.
      warnMissingAudienceOnce()
    }

    if (!payload.email || !payload.sub) return null
    return { email: payload.email.toLowerCase(), sub: payload.sub }
  } catch {
    // Malformed token, unreachable JWKS, bad key - all mean "not authenticated".
    return null
  }
}

/** Extract and verify the caller's identity from request headers. */
export async function identityFrom(headers: Headers): Promise<AccessIdentity | null> {
  const token = headers.get(JWT_HEADER)
  if (!token) return null
  return verifyAccessJwt(token)
}

/**
 * Identity or throw. Use in every Server Action and route handler that touches
 * data - there is no unauthenticated read path in this app.
 */
export async function requireIdentity(headers: Headers): Promise<AccessIdentity> {
  const id = await identityFrom(headers)
  if (!id) {
    throw Object.assign(new Error('Not authenticated'), { status: 401 })
  }
  return id
}
