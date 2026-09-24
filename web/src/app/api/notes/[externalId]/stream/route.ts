/**
 * Server-Sent Events stream for one shared note.
 *
 * GET, long-lived, one per viewer. Writes go through a server action, not
 * this route: SSE is one-way by design and a text field does not need a
 * duplex channel.
 *
 * Authorization happens ONCE, here, before the stream opens. Everything
 * downstream trusts it, which is why it is a single call to the one rule in
 * queries.ts rather than an inline check.
 */

import { requireIdentity } from '@/lib/auth'
import { canAccessSharedNote, getSharedNote } from '@/lib/queries'
import { subscribe, type NoteEvent } from '@/lib/note-hub'
import { count } from '@/lib/metrics'

export const dynamic = 'force-dynamic'
// Node runtime: the hub holds state in this process, and the edge runtime
// would neither share it nor keep it.
export const runtime = 'nodejs'

/** Well under any proxy idle timeout, so the connection is not dropped. */
const HEARTBEAT_MS = 25_000

export async function GET(
  request: Request,
  { params }: { params: Promise<{ externalId: string }> },
) {
  let identity
  try {
    identity = await requireIdentity(request.headers)
  } catch {
    return new Response('Not authenticated', { status: 401 })
  }

  const { externalId: raw } = await params
  const externalId = decodeURIComponent(raw)

  // The single authorization rule. Failing closed here is the whole
  // security model for shared notes.
  const allowed = await canAccessSharedNote(externalId, identity.email)
  if (!allowed) return new Response('Not found', { status: 404 })

  const encoder = new TextEncoder()
  let unsubscribe: (() => void) | null = null
  let heartbeat: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: NoteEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      // Current state first, so a joiner is immediately in sync rather than
      // waiting for someone else to type.
      const existing = await getSharedNote(externalId)
      send({
        type: 'content',
        externalId,
        content: existing?.content ?? '',
        revision: existing?.revision ?? 0,
        updatedBy: existing?.updatedBy ?? '',
      })

      unsubscribe = subscribe(externalId, {
        id: crypto.randomUUID(),
        email: identity.email,
        send,
      })

      count('noteStreamOpens')

      if (!unsubscribe) {
        // A cap was hit. Say so in-band and close, rather than holding a
        // connection open that will never receive anything.
        send({ type: 'content', externalId, content: '', revision: -1 })
        controller.close()
        return
      }

      // Comment frames keep intermediaries from closing an idle connection.
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'))
        } catch {
          // Already closed; cancel() does the cleanup.
        }
      }, HEARTBEAT_MS)
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat)
      unsubscribe?.()
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      // Tells nginx-style proxies not to buffer, which would defeat SSE
      // entirely by holding events until the response ends.
      'x-accel-buffering': 'no',
    },
  })
}
