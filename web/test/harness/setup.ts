/**
 * UI test harness.
 *
 * The app verifies a signed Cloudflare Access JWT and fails closed, so browser
 * tests need a real, verifiable token. Rather than stub the auth module (which
 * would leave the security-critical path untested in exactly the place it runs),
 * we:
 *   1. serve a JWKS from a local HTTP server,
 *   2. point CF_ACCESS_ISSUER at it,
 *   3. mint tokens with the matching private key,
 *   4. send them as a request header on every browser request.
 *
 * The production verification code then runs unmodified.
 */

import { createServer, type Server } from 'node:http'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { jwks } from './jwt'

const here = dirname(fileURLToPath(import.meta.url))
export const TMP_DIR = join(here, '../.tmp')
export const SQLITE_PATH = join(TMP_DIR, 'e2e.sqlite')

export const JWKS_PORT = 3199
export const TEST_ISSUER_URL = `http://127.0.0.1:${JWKS_PORT}`

let server: Server | null = null

/** Serve the test JWKS at the path Cloudflare uses. */
export function startJwksServer(): Promise<void> {
  return new Promise((resolve) => {
    server = createServer((req, res) => {
      if (req.url === '/cdn-cgi/access/certs') {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify(jwks()))
        return
      }
      res.writeHead(404)
      res.end()
    })
    server.listen(JWKS_PORT, '127.0.0.1', () => resolve())
  })
}

export function stopJwksServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!server) return resolve()
    server.close(() => resolve())
    server = null
  })
}

export function resetDatabaseFile(): void {
  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true })
  for (const suffix of ['', '-wal', '-shm']) {
    const path = `${SQLITE_PATH}${suffix}`
    if (existsSync(path)) rmSync(path)
  }
}

/** Apply schema.sql to the test database. */
export async function applySchema(): Promise<void> {
  const { default: Database } = await import('better-sqlite3')
  const { readFileSync } = await import('node:fs')
  const schema = readFileSync(join(here, '../../sql/schema.sql'), 'utf8')
  const db = new Database(SQLITE_PATH)
  db.pragma('journal_mode = WAL')
  db.exec(schema)
  db.close()
}
