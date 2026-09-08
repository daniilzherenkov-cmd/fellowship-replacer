/**
 * Database seam.
 *
 * Production: the Protoship per-app MySQL (mysql2 pool, credentials derived
 * from APP_ID + DB_PASSWORD injected from Vault at runtime).
 * Local/tests: SQLite, because this machine has neither Docker nor a local
 * MySQL and the platform provides no local emulation.
 *
 * Every query in the app goes through `query()` / `exec()` so the two backends
 * stay swappable. Keep SQL to the common subset of MySQL 8 and SQLite:
 *   - `?` placeholders (both support them)
 *   - no MySQL-only functions (no JSON_TABLE, no ON DUPLICATE KEY UPDATE)
 *   - ISO-8601 TEXT for datetimes, so ordering is lexicographic in both
 *
 * Schema DDL is NOT run from here. Protoship applies it out-of-band via the
 * execute_sql MCP tool; app code must never CREATE TABLE against production.
 * `sql/schema.sql` is the source of truth, and the test harness applies it to
 * its throwaway SQLite file.
 */

export type Row = Record<string, unknown>
export type Param = string | number | boolean | null

export interface Db {
  query<T = Row>(sql: string, params?: Param[]): Promise<T[]>
  exec(sql: string, params?: Param[]): Promise<void>
  close(): Promise<void>
}

let instance: Db | null = null

/**
 * True when running against SQLite (tests, local dev without MySQL).
 *
 * Requires an EXPLICIT opt-in via FELLOW_DB_DRIVER. It used to fall back to
 * SQLite whenever DB_HOST was unset, which is dangerous in a container: a
 * missing DB_HOST would silently start an in-memory database that looks healthy
 * and quietly loses every write, instead of failing loudly. better-sqlite3 is
 * also excluded from the production bundle (see next.config.ts), so attempting
 * it there would throw at import anyway.
 */
function useSqlite(): boolean {
  return process.env.FELLOW_DB_DRIVER === 'sqlite'
}

async function makeSqlite(): Promise<Db> {
  const { default: Database } = await import('better-sqlite3')
  const { mkdirSync } = await import('node:fs')
  const { dirname, isAbsolute, resolve } = await import('node:path')

  const configured = process.env.FELLOW_SQLITE_PATH || ':memory:'
  // A relative path is resolved against process.cwd(), which for a Next
  // standalone build is .next/standalone - not the project root. Resolve it
  // explicitly and create the directory, otherwise the first query fails with
  // an opaque "directory does not exist".
  const file =
    configured === ':memory:' || isAbsolute(configured)
      ? configured
      : resolve(process.cwd(), configured)
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true })

  const db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // SQLite is the local/test backend only, and there is no migration runner on
  // this path, so apply the schema if the file is empty. Production MySQL DDL
  // is applied out-of-band via the execute_sql MCP tool and never from here.
  const hasTables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='meeting'")
    .get()
  if (!hasTables && process.env.FELLOW_SQLITE_AUTO_SCHEMA !== '0') {
    const { readFileSync, existsSync } = await import('node:fs')
    const { join } = await import('node:path')
    // Try both layouts: repo root in dev, and the traced copy in standalone.
    for (const candidate of [
      join(process.cwd(), 'sql/schema.sql'),
      join(process.cwd(), '../../sql/schema.sql'),
    ]) {
      if (existsSync(candidate)) {
        db.exec(readFileSync(candidate, 'utf8'))
        break
      }
    }
  }

  return {
    async query<T = Row>(sql: string, params: Param[] = []): Promise<T[]> {
      return db.prepare(sql).all(...params) as T[]
    },
    async exec(sql: string, params: Param[] = []): Promise<void> {
      if (params.length) db.prepare(sql).run(...params)
      else db.exec(sql)
    },
    async close(): Promise<void> {
      db.close()
    },
  }
}

async function makeMysql(): Promise<Db> {
  const mysql = await import('mysql2/promise')
  const appId = process.env.APP_ID
  if (!appId) throw new Error('APP_ID is not set - cannot derive database name')

  // Protoship derives both the schema name and the user from APP_ID; only the
  // password is supplied (from Vault, remapped out of db-credentials).
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    database: appId,
    user: `app_${appId}`,
    password: process.env.DB_PASSWORD || '',
    connectionLimit: 10,
    queueLimit: 50,
    connectTimeout: 10_000,
  })

  return {
    async query<T = Row>(sql: string, params: Param[] = []): Promise<T[]> {
      const [rows] = await pool.query(sql, params)
      return rows as T[]
    },
    async exec(sql: string, params: Param[] = []): Promise<void> {
      await pool.query(sql, params)
    },
    async close(): Promise<void> {
      await pool.end()
    },
  }
}

/**
 * Get the shared connection. Mirrors the platform helper's `requireDb()`
 * contract: throws a 503-shaped error rather than returning a half-ready pool,
 * because the DB connects best-effort at boot.
 */
export async function getDb(): Promise<Db> {
  if (instance) return instance
  try {
    instance = useSqlite() ? await makeSqlite() : await makeMysql()
    return instance
  } catch (cause) {
    throw Object.assign(new Error('Database not available'), { status: 503, cause })
  }
}

/** Test seam - drop the cached connection between suites. */
export async function __resetDb(): Promise<void> {
  if (instance) await instance.close()
  instance = null
}
