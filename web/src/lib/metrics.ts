/**
 * In-process metrics, emitted to stdout and exposed at /api/metrics.
 *
 * WHY THIS EXISTS: the app runs one always-on replica with a 200MB limit,
 * and measurement showed RSS climbing from ~103MB idle towards and past that
 * under sustained load. Before a group of testers arrives it is worth being
 * able to answer "how busy is it and how close to the ceiling" without
 * guessing, which is exactly the mistake that made this necessary.
 *
 * Counters are cumulative since boot. A dashboard derives rates by
 * differencing consecutive samples, which is the normal shape and avoids
 * this process having to keep a window.
 *
 * In memory, so the numbers reset on deploy. That is fine: Loki keeps the
 * history, and this is a prototype's pulse rather than an SLA.
 */

import { logInfo } from './logger'

interface Counters {
  pageRenders: number
  noteStreamOpens: number
  noteWrites: number
  pushSent: number
  pushFailed: number
  syncRuns: number
}

/**
 * Held on globalThis, NOT as a module-level constant.
 *
 * Next bundles server components, route handlers and server actions into
 * separate module graphs, so the same import can resolve to different
 * instances. A plain module-level object gave the layout one set of
 * counters and /api/metrics another, and the endpoint always read zero.
 */
const GLOBAL_KEY = Symbol.for('fellow.metrics')

interface MetricsGlobal {
  counters: Counters
  bootedAt: number
}

const g = globalThis as unknown as Record<symbol, MetricsGlobal | undefined>

g[GLOBAL_KEY] ??= {
  counters: {
    pageRenders: 0,
    noteStreamOpens: 0,
    noteWrites: 0,
    pushSent: 0,
    pushFailed: 0,
    syncRuns: 0,
  },
  bootedAt: Date.now(),
}

const counters = g[GLOBAL_KEY]!.counters
const bootedAt = g[GLOBAL_KEY]!.bootedAt

export function count(metric: keyof Counters, by = 1): void {
  counters[metric] += by
}

export interface MetricsSnapshot {
  uptimeSeconds: number
  memory: {
    rssMb: number
    heapUsedMb: number
    heapTotalMb: number
    /** The container's cgroup limit, for context alongside rss. */
    limitMb: number
    /** How close to the ceiling, 0 to 1. The number that actually matters. */
    rssFraction: number
  }
  counters: Counters
  /** Cumulative counts divided by uptime. A crude but useful average rate. */
  ratesPerMinute: Record<keyof Counters, number>
  channels: { open: number; subscribers: number }
}

/** The container limit, so the snapshot is self-describing rather than a bare number. */
const MEMORY_LIMIT_MB = Number(process.env.MEMORY_LIMIT_MB ?? 200)

export function snapshot(): MetricsSnapshot {
  const mem = process.memoryUsage()
  const uptimeSeconds = Math.max(1, Math.round((Date.now() - bootedAt) / 1000))
  const minutes = uptimeSeconds / 60

  const rssMb = Math.round(mem.rss / 1024 / 1024)
  const rates = {} as Record<keyof Counters, number>
  for (const [k, v] of Object.entries(counters) as [keyof Counters, number][]) {
    rates[k] = Number((v / minutes).toFixed(2))
  }

  // Imported lazily: the hub imports limits, and a cycle here would be a
  // silly way to break the metrics endpoint.
  let channels = { open: 0, subscribers: 0 }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const hub = require('./note-hub') as { channelStats: () => { channels: number; subscribers: number } }
    const stats = hub.channelStats()
    channels = { open: stats.channels, subscribers: stats.subscribers }
  } catch {
    // Metrics must never be the thing that breaks.
  }

  return {
    uptimeSeconds,
    memory: {
      rssMb,
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
      limitMb: MEMORY_LIMIT_MB,
      rssFraction: Number((rssMb / MEMORY_LIMIT_MB).toFixed(2)),
    },
    counters: { ...counters },
    ratesPerMinute: rates,
    channels,
  }
}

let timer: ReturnType<typeof setInterval> | null = null

/**
 * Emit a sample to stdout every minute, so Loki has a time series without
 * anyone having to poll the app.
 *
 * Every number is a top-level field, because a value interpolated into a
 * message string cannot be graphed.
 */
export function startMetricsReporter(intervalMs = 60_000): void {
  if (timer) return
  timer = setInterval(() => {
    const s = snapshot()
    logInfo('metrics', {
      uptime_s: s.uptimeSeconds,
      rss_mb: s.memory.rssMb,
      heap_used_mb: s.memory.heapUsedMb,
      rss_fraction: s.memory.rssFraction,
      page_renders: s.counters.pageRenders,
      note_stream_opens: s.counters.noteStreamOpens,
      note_writes: s.counters.noteWrites,
      push_sent: s.counters.pushSent,
      push_failed: s.counters.pushFailed,
      sync_runs: s.counters.syncRuns,
      channels_open: s.channels.open,
      channel_subscribers: s.channels.subscribers,
    })

    // Shout when close to the ceiling. The failure mode is a SIGKILL with no
    // JS error, so a warning beforehand is the only notice anyone gets.
    if (s.memory.rssFraction >= 0.85) {
      logWarnNearLimit(s.memory.rssMb, s.memory.limitMb)
    }
  }, intervalMs)
  timer.unref?.()
}

function logWarnNearLimit(rssMb: number, limitMb: number): void {
  logInfo('memory_pressure', {
    level: 'warn',
    rss_mb: rssMb,
    limit_mb: limitMb,
    msg_detail:
      'RSS is within 15% of the container limit. An OOM here is a silent SIGKILL, ' +
      'not a JS error. Consider raising memory in app.yaml.',
  })
}
