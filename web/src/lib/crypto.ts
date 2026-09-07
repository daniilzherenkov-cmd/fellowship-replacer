/**
 * Envelope encryption for stored credentials.
 *
 * Two things get encrypted at rest: Google refresh tokens (long-lived - they
 * grant calendar access until explicitly revoked) and secret .ics URLs (bearer
 * credentials - the URL alone reads the whole calendar).
 *
 * Why bother, when the database is already per-app isolated? Because on
 * Protoship the blast radius of any read is the whole of Delivery Hero, and a
 * leaked refresh token is worse than leaked notes: it grants ongoing access to
 * a live Google account. Defence in depth is cheap here.
 *
 * AES-256-GCM: authenticated, so tampering is detected rather than silently
 * decrypting to garbage.
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
  timingSafeEqual,
} from 'node:crypto'

const ALGO = 'aes-256-gcm'
const IV_BYTES = 12
const TAG_BYTES = 16
const VERSION = 'v1'

/**
 * Derive the key from FELLOW_ENCRYPTION_KEY (set via Protoship `add_secret`,
 * injected from Vault at runtime).
 *
 * Fails loudly when unset rather than silently falling back to a constant. A
 * default key would mean "encrypted" data that anyone with the source can read.
 */
function key(): Buffer {
  const secret = process.env.FELLOW_ENCRYPTION_KEY
  if (!secret || secret.length < 32) {
    throw new Error(
      'FELLOW_ENCRYPTION_KEY is missing or too short (need >= 32 chars). ' +
        'Set it with the Protoship add_secret tool.',
    )
  }
  // SHA-256 to a fixed 32 bytes regardless of the passphrase length.
  return createHash('sha256').update(secret).digest()
}

/** True when encryption is configured. Lets callers degrade gracefully. */
export function encryptionAvailable(): boolean {
  const secret = process.env.FELLOW_ENCRYPTION_KEY
  return !!secret && secret.length >= 32
}

/** Encrypt to "v1:<iv>:<tag>:<ciphertext>", all base64url. */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGO, key(), iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ct.toString('base64url')].join(
    ':',
  )
}

/**
 * Decrypt. Returns null on any failure - wrong key, tampering, malformed input
 * - so a corrupted row degrades to "not connected" rather than crashing a page.
 */
export function decrypt(payload: string): string | null {
  try {
    const [version, ivB64, tagB64, ctB64] = payload.split(':')
    if (version !== VERSION || !ivB64 || !tagB64 || !ctB64) return null

    const iv = Buffer.from(ivB64, 'base64url')
    const tag = Buffer.from(tagB64, 'base64url')
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) return null

    const decipher = createDecipheriv(ALGO, key(), iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([
      decipher.update(Buffer.from(ctB64, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    return null
  }
}

/** Constant-time string compare, for OAuth state and similar tokens. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/** URL-safe random token, for OAuth state and PKCE verifiers. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}
