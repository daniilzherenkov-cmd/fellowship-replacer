/**
 * Shared test keypair.
 *
 * The JWKS server and the test process are separate processes, so they must
 * agree on a key. Global setup generates one and writes it to test/.tmp; both
 * sides read it from there.
 *
 * Test-only, regenerated every run, never used in production - the real app
 * verifies against Cloudflare's JWKS at CF_ACCESS_ISSUER.
 */

import { generateKeyPairSync, createPrivateKey, createPublicKey } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const TMP_DIR = join(here, '../.tmp')
const KEY_PATH = join(TMP_DIR, 'test-key.pem')

export const KID = 'fellow2-test-key'
export const TEST_AUD = 'fellow2-test-aud'

/** Create the keypair if absent. Called once from global setup. */
export function ensureKey(): void {
  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true })
  if (existsSync(KEY_PATH)) return
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  writeFileSync(KEY_PATH, privateKey.export({ type: 'pkcs8', format: 'pem' }).toString())
}

export function privateKey() {
  ensureKey()
  return createPrivateKey(readFileSync(KEY_PATH, 'utf8'))
}

export function publicJwks() {
  const jwk = createPublicKey(privateKey()).export({ format: 'jwk' })
  return { keys: [{ ...jwk, kid: KID, alg: 'RS256', use: 'sig' }] }
}
