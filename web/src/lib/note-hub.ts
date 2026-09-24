/**
 * In-process pub/sub for shared notes.
 *
 * WHY IN MEMORY IS SAFE HERE: app.yaml pins this service to `min: 1, max: 1`,
 * so every subscriber is attached to the same process and no coordination is
 * needed. This is the same property that makes the reminder scheduler work.
 *
 * ⚠️ THE SINGLE REPLICA ASSUMPTION IS LOAD BEARING, and unlike the reminder
 * scheduler this one cannot be made safe by a database key: if `max` is ever
 * raised above 1, two people served by different replicas simply stop seeing
 * each other, silently. `assertSingleReplica()` exists so that failure is
 * loud rather than mysterious. Moving to several replicas means moving this
 * to Redis pub/sub or similar.
 *
 * WHY SSE AND NOT WEBSOCKETS: the container runs Next's stock standalone
 * server (`node /app/server.js`). A WebSocket upgrade needs a custom server
 * replacing it, which changes the Dockerfile CMD and the standalone output -
 * the exact area that has taken this app down twice. A Server-Sent Events
 * route handler needs none of that. Upstream writes go through an ordinary
 * server action, which is all a text field needs.
 */

import {
  MAX_SUBSCRIBERS_PER_CHANNEL,
  MAX_SUBSCRIBERS_PER_USER,
} from './limits'

export interface NoteEvent {
  type: 'content' | 'presence'
  externalId: string
  content?: string
  revision?: number
  updatedBy?: string
  /** Emails currently viewing, for the presence line. */
  viewers?: string[]
}

type Subscriber = {
  id: string
  email: string
  send: (event: NoteEvent) => void
}

/**
 * Held on globalThis for the same reason the metrics counters are: Next
 * bundles route handlers and server actions into separate module graphs, so
 * a module-level Map can exist TWICE. The SSE route subscribes in one graph
 * and the write action publishes from another, which would mean broadcasts
 * silently reaching nobody while every test that exercises one side alone
 * still passed.
 */
const CHANNELS_KEY = Symbol.for('fellow.note-hub.channels')
const hubGlobal = globalThis as unknown as Record<symbol, Map<string, Set<Subscriber>> | undefined>
hubGlobal[CHANNELS_KEY] ??= new Map<string, Set<Subscriber>>()
const channels = hubGlobal[CHANNELS_KEY]!

/** Open streams held by one person, across every channel. */
function subscriberCountFor(email: string): number {
  let n = 0
  for (const set of channels.values()) {
    for (const sub of set) if (sub.email === email) n += 1
  }
  return n
}

/**
 * Attach a subscriber, or refuse.
 *
 * Returns null when a cap is hit. Each open stream pins a server connection
 * for as long as the tab lives, and the pod has 200MB, so this is a real
 * resource rather than a theoretical one. A reconnect loop in one browser
 * should not be able to consume the channel.
 */
export function subscribe(
  externalId: string,
  subscriber: Subscriber,
): (() => void) | null {
  const set = channels.get(externalId) ?? new Set<Subscriber>()

  if (set.size >= MAX_SUBSCRIBERS_PER_CHANNEL) return null
  if (subscriberCountFor(subscriber.email) >= MAX_SUBSCRIBERS_PER_USER) return null

  set.add(subscriber)
  channels.set(externalId, set)
  broadcastPresence(externalId)

  return () => {
    const current = channels.get(externalId)
    if (!current) return
    current.delete(subscriber)
    if (current.size === 0) channels.delete(externalId)
    else broadcastPresence(externalId)
  }
}

/** Distinct viewers, so two tabs from one person count once. */
function viewersOf(externalId: string): string[] {
  const set = channels.get(externalId)
  if (!set) return []
  return [...new Set([...set].map((s) => s.email))]
}

function broadcastPresence(externalId: string): void {
  const viewers = viewersOf(externalId)
  publish(externalId, { type: 'presence', externalId, viewers })
}

/**
 * Send to everyone on a channel.
 *
 * A subscriber whose connection has already gone away must not stop the
 * others receiving: one dead client should never block a live one.
 */
export function publish(externalId: string, event: NoteEvent): void {
  const set = channels.get(externalId)
  if (!set) return
  for (const subscriber of set) {
    try {
      subscriber.send(event)
    } catch {
      set.delete(subscriber)
    }
  }
}

/** For diagnostics and tests. */
export function channelStats(): { channels: number; subscribers: number } {
  let subscribers = 0
  for (const set of channels.values()) subscribers += set.size
  return { channels: channels.size, subscribers }
}

/**
 * Shout if the single-replica assumption has quietly stopped holding.
 *
 * There is no reliable way to count replicas from inside one, so this checks
 * the hint the platform gives us and is deliberately noisy rather than
 * clever. Better a warning in the log than two people wondering why they
 * cannot see each other.
 */
export function assertSingleReplica(): void {
  const declared = process.env.EXPECTED_REPLICAS
  if (declared && declared !== '1') {
    console.error(
      '[note-hub] EXPECTED_REPLICAS is ' +
        declared +
        ' but shared-note channels are held IN MEMORY. Viewers on different ' +
        'replicas will not see each other. Move the hub to Redis pub/sub ' +
        'before scaling past one replica. See docs/16.',
    )
  }
}
