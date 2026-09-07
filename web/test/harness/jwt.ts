/**
 * Test JWT minting.
 *
 * The auth path is the highest-risk code in this app: on Protoship it is the
 * ONLY thing between one manager's 1:1 notes and every other DH employee. So
 * the tests must exercise the real verification code, not a stub.
 *
 * We generate a throwaway RSA keypair, publish it as a JWKS the app fetches
 * from a local origin, and sign assertions with it. Everything the production
 * path does - RS256, kid lookup, exp/nbf, iss, aud - runs unchanged.
 */

import { generateKeyPairSync, createSign, type KeyObject } from 'node:crypto'

export const TEST_ISSUER = 'https://test-access.local'
export const TEST_AUD = 'fellow2-test-aud'
const KID = 'test-key-1'

let keys: { privateKey: KeyObject; publicKey: KeyObject } | null = null

function keypair() {
  if (!keys) {
    keys = generateKeyPairSync('rsa', { modulusLength: 2048 })
  }
  return keys
}

function b64u(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** The JWKS document the app should fetch. */
export function jwks() {
  // generateKeyPairSync already yields KeyObjects, so export directly.
  const jwk = keypair().publicKey.export({ format: 'jwk' })
  return { keys: [{ ...jwk, kid: KID, alg: 'RS256', use: 'sig' }] }
}

export interface MintOptions {
  email: string
  sub?: string
  /** Seconds from now. Negative mints an already-expired token. */
  expiresIn?: number
  issuer?: string
  audience?: string
  /** Sign with a different key, to simulate a forged token. */
  wrongKey?: boolean
  algorithm?: string
}

/** Mint an Access-style JWT. */
export function mintJwt(opts: MintOptions): string {
  const {
    email,
    sub = `sub-${email}`,
    expiresIn = 3600,
    issuer = TEST_ISSUER,
    audience = TEST_AUD,
    wrongKey = false,
    algorithm = 'RS256',
  } = opts

  const now = Math.floor(Date.now() / 1000)
  const header = b64u(Buffer.from(JSON.stringify({ alg: algorithm, kid: KID, typ: 'JWT' })))
  const payload = b64u(
    Buffer.from(
      JSON.stringify({ email, sub, iss: issuer, aud: audience, iat: now, exp: now + expiresIn }),
    ),
  )

  const signingKey = wrongKey
    ? generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey
    : keypair().privateKey

  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${payload}`)
  const signature = b64u(signer.sign(signingKey))

  return `${header}.${payload}.${signature}`
}

/** A token whose signature is structurally valid but signed by another key. */
export function mintForgedJwt(email: string): string {
  return mintJwt({ email, wrongKey: true })
}

/** A token with `alg: none` and an empty signature - the classic JWT bypass. */
export function mintAlgNoneJwt(email: string): string {
  const now = Math.floor(Date.now() / 1000)
  const header = b64u(Buffer.from(JSON.stringify({ alg: 'none', kid: KID, typ: 'JWT' })))
  const payload = b64u(
    Buffer.from(
      JSON.stringify({
        email,
        sub: `sub-${email}`,
        iss: TEST_ISSUER,
        aud: TEST_AUD,
        iat: now,
        exp: now + 3600,
      }),
    ),
  )
  return `${header}.${payload}.`
}
