/**
 * Trigger a calendar sync for the authenticated user.
 *
 * POST, not GET: it writes. A GET would be prefetchable by the browser and
 * retried by proxies.
 */

import { requireIdentity } from '@/lib/auth'
import { syncCalendar } from '@/lib/sync'
import { getConnection } from '@/lib/google-store'
import { googleConfigured } from '@/lib/google-oauth'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let identity
  try {
    identity = await requireIdentity(request.headers)
  } catch {
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }

  if (!googleConfigured()) {
    return Response.json({ error: 'google_not_configured' }, { status: 503 })
  }

  const result = await syncCalendar(identity.email)

  if (result.error === 'not_connected' || result.error === 'reconnect_required') {
    return Response.json({ error: result.error }, { status: 409 })
  }
  if (result.error) {
    return Response.json({ error: result.error }, { status: 502 })
  }

  return Response.json({
    ok: true,
    created: result.created,
    updated: result.updated,
    peopleCreated: result.peopleCreated,
    didFullResync: result.didFullResync,
  })
}

/** Connection status, for rendering the settings screen. */
export async function GET(request: Request) {
  let identity
  try {
    identity = await requireIdentity(request.headers)
  } catch {
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const configured = googleConfigured()
  const connection = configured ? await getConnection(identity.email) : null

  return Response.json({
    configured,
    connected: !!connection,
    googleEmail: connection?.googleEmail ?? null,
    lastSyncAt: connection?.lastSyncAt ?? null,
    lastSyncError: connection?.lastSyncError ?? null,
  })
}
