/**
 * Database seam.
 *
 * MySQL everywhere: the Protoship per-app database in production, a local
 * MySQL in dev and tests. Credentials are derived from APP_ID, with
 * DB_PASSWORD injected from Vault at runtime in production.
 *
 * WHY THERE IS NO SQLITE ANY MORE: dev used to run better-sqlite3. The two
 * dialects disagree in ways that pass every test and then fail in the pod -
 * `meeting_id IS ?` is valid SQLite and a syntax error in MySQL, and it
 * shipped broken while 128 tests stayed green. better-sqlite3 is also a
 * NATIVE module, and keeping it out of the production image took two
 * outages and three separate workarounds to get right. Running the same
 * engine in both places removes the whole category.
 *
 * Local setup:
 *   brew services start mysql
 *   npm run db:setup      (creates the database, user and schema)
 *
 * Schema DDL is NOT run from here. Protoship applies it out-of-band via the
 * execute_sql MCP tool; app code must never CREATE TABLE against production.
 * `sql/schema.mysql.sql` is the source of truth and mirrors production.
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
 * Fail with a diagnosis rather than a symptom.
 *
 * DB_PASSWORD arrives from Vault via instrumentation.ts, not as a container env
 * var. When that loading is broken the raw failure is
 * `ER_ACCESS_DENIED_ERROR for app_<APP_ID>`, which reads like a permissions
 * problem in the database and sent a real debugging session down that path.
 * Naming the actual cause here saves that hunt next time.
 */
function assertDbConfigured(appId: string | undefined): asserts appId is string {
  const missing: string[] = []
  if (!appId) missing.push('APP_ID')
  if (!process.env.DB_HOST) missing.push('DB_HOST')
  if (!process.env.DB_PASSWORD) missing.push('DB_PASSWORD')
  if (missing.length === 0) return

  throw new Error(
    `Database is not configured - missing ${missing.join(', ')}. ` +
      'On Protoship, DB_PASSWORD is loaded from Vault at startup by ' +
      'instrumentation.ts; if it is absent, check the Vault lines in the pod ' +
      'log. DB_HOST and APP_ID are injected by the platform. For local dev, ' +
      'start MySQL (brew services start mysql) and run npm run db:setup.',
  )
}

async function makeMysql(): Promise<Db> {
  const mysql = await import('mysql2/promise')
  const appId = process.env.APP_ID
  assertDbConfigured(appId)

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
    instance = await makeMysql()
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
