/**
 * Playwright global setup.
 *
 * Order matters: the key must exist before the JWKS server starts, and the
 * JWKS server must be up before the app verifies its first token.
 *
 * The JWKS server is spawned detached so it outlives this hook - globalSetup
 * returns immediately, but the endpoint is needed for the whole run.
 */

import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeFileSync } from 'node:fs'
import { ensureKey } from './keys'
import { resetDatabaseFile, applySchema, TMP_DIR, JWKS_PORT } from './setup'

const here = dirname(fileURLToPath(import.meta.url))

async function waitForJwks(timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${JWKS_PORT}/cdn-cgi/access/certs`)
      if (res.ok) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('Test JWKS server did not start in time')
}

export default async function globalSetup() {
  ensureKey()
  resetDatabaseFile()
  await applySchema()

  const child = spawn(process.execPath, [join(here, 'jwks-server.mjs')], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, FELLOW_JWKS_PORT: String(JWKS_PORT) },
  })
  child.unref()
  writeFileSync(join(TMP_DIR, 'jwks.pid'), String(child.pid))

  await waitForJwks()
}
