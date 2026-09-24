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
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { jwks } from './jwt'

const here = dirname(fileURLToPath(import.meta.url))
export const TMP_DIR = join(here, '../.tmp')

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

const MYSQL_CONN = {
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  database: process.env.APP_ID ?? 'fellow_dev',
  user: `app_${process.env.APP_ID ?? 'fellow_dev'}`,
  password: process.env.DB_PASSWORD ?? 'fellowdev',
  multipleStatements: true,
}

export function resetDatabaseFile(): void {
  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true })
}

/**
 * Give the suite an empty database.
 *
 * MySQL is a long-lived service rather than a throwaway file, so it has to be
 * TRUNCATED between runs. Without this the same rows pile up and tests that
 * assert `toHaveCount(1)` start seeing 2, 3, 4 copies, which looks exactly
 * like a product bug and is not one.
 */
export async function applySchema(): Promise<void> {
  const { readFileSync } = await import('node:fs')
  const mysql = await import('mysql2/promise')
  const conn = await mysql.createConnection(MYSQL_CONN)
  try {
    await conn.query(readFileSync(join(here, '../../sql/schema.mysql.sql'), 'utf8'))

    const [rows] = await conn.query(
      'SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = ?',
      [MYSQL_CONN.database],
    )
    const names = (rows as { TABLE_NAME: string }[]).map((r) => r.TABLE_NAME)
    if (names.length) {
      await conn.query('SET FOREIGN_KEY_CHECKS = 0')
      for (const name of names) await conn.query(`TRUNCATE TABLE \`${name}\``)
      await conn.query('SET FOREIGN_KEY_CHECKS = 1')
    }
  } finally {
    await conn.end()
  }
}
