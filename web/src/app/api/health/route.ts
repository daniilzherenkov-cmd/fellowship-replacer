/**
 * Kubernetes readiness probe target, plus a diagnostic view.
 *
 * ALWAYS RETURNS 200, deliberately. GDP polls this to decide whether the pod
 * may receive traffic, and a database blip must not pull the whole app out of
 * rotation - the app still serves, and taking it offline would only turn a
 * degraded state into an outage.
 *
 * The body carries the detail instead. `?deep=1` additionally probes the
 * database, so a human can tell "the app is up but cannot reach MySQL" from
 * "the app is down" without reading pod logs. The default path stays cheap so
 * the probe itself never does a DB round-trip.
 *
 * No auth: it must be reachable by the kubelet, which sends no Access header.
 * It therefore reports only booleans and error codes - never credentials,
 * hostnames, or connection strings.
 */

import { getDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const deep = new URL(request.url).searchParams.get('deep') === '1'

  const config = {
    // Presence only. Never the values.
    appId: Boolean(process.env.APP_ID),
    dbHost: Boolean(process.env.DB_HOST),
    dbPassword: Boolean(process.env.DB_PASSWORD),
    cfAccessAud: Boolean(process.env.CF_ACCESS_AUD),
    googleOauth: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  }

  if (!deep) {
    return Response.json({ status: 'ok', at: new Date().toISOString(), config })
  }

  let database: { ok: boolean; code?: string; message?: string }
  try {
    const db = await getDb()
    await db.query('SELECT 1')
    database = { ok: true }
  } catch (err) {
    // getDb() wraps the real failure as `cause` behind a generic "Database not
    // available". Unwrap it: the cause carries the MySQL code (and the
    // assertDbConfigured message), which is the whole diagnostic value here.
    const outer = err as { code?: string; message?: string; cause?: unknown }
    const inner = (outer.cause ?? {}) as { code?: string; message?: string }
    database = {
      ok: false,
      code: inner.code ?? outer.code ?? 'UNKNOWN',
      // mysql2 masks the password in its own message.
      message: inner.message ?? outer.message ?? String(err),
    }
  }

  return Response.json({
    status: database.ok ? 'ok' : 'degraded',
    at: new Date().toISOString(),
    config,
    database,
  })
}
