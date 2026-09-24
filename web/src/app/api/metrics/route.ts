/**
 * A live snapshot of how the single replica is doing.
 *
 * Open it in a browser: https://fellow2.dhapps.ai/api/metrics
 *
 * Requires a signed-in identity, same as everything else. It exposes only
 * process statistics and cumulative counters, never user data, but there is
 * no reason to hand the shape of your traffic to an unauthenticated caller.
 *
 * For history rather than a snapshot, the app also emits a `metrics` line to
 * stdout every minute, which lands in Grafana Loki under
 * `dh_component="fellow76bf"`. Every number there is a top-level field, so
 * it can be graphed directly.
 */

import { requireIdentity } from '@/lib/auth'
import { snapshot } from '@/lib/metrics'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    await requireIdentity(request.headers)
  } catch {
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }

  return Response.json(snapshot(), {
    headers: { 'cache-control': 'no-store' },
  })
}
