'use client'

/**
 * Keeps the calendar fresh without anyone pressing anything.
 *
 * WHY NOT GOOGLE PUSH: `events.watch` needs a public HTTPS endpoint Google can
 * POST to. Every *.dhapps.ai URL sits behind Cloudflare Access and answers 302
 * to Okta, so Google could never deliver a notification. Until an
 * Access-exempt callback path is agreed with the platform owners, polling is
 * the only option that actually works here.
 *
 * Two triggers, both cheap because the sync uses Google's incremental
 * syncToken and sends almost nothing when nothing changed:
 *
 *  - ON LOAD, but only when the last sync is older than STALE_AFTER_MS.
 *    Without the throttle every navigation to /calendar would hit Google.
 *  - EVERY INTERVAL_MS while the tab is open, skipped entirely while the tab
 *    is hidden so a forgotten background tab does not poll all night.
 *
 * Renders nothing.
 */

import { useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { syncCalendarAction } from '@/actions'

const STALE_AFTER_MS = 2 * 60_000
const INTERVAL_MS = 5 * 60_000

export function AutoSync({
  connected,
  lastSyncAt,
}: {
  connected: boolean
  /** ISO timestamp of the last successful sync, or null if never. */
  lastSyncAt: string | null
}) {
  const router = useRouter()
  // Guards against two syncs overlapping: a slow request plus a firing
  // interval would otherwise run the same upserts twice.
  const inFlight = useRef(false)

  const runSync = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    try {
      const result = await syncCalendarAction()
      // Only repaint when something actually changed. An unconditional
      // refresh every 5 minutes would discard scroll position and any
      // half-typed note for no reason.
      if (result.ok && ((result.created ?? 0) > 0 || (result.updated ?? 0) > 0)) {
        router.refresh()
      }
    } catch {
      // Silent by design: this is background upkeep the user did not ask for,
      // so it must never interrupt them. The manual button reports errors.
    } finally {
      inFlight.current = false
    }
  }, [router])

  useEffect(() => {
    if (!connected) return

    const age = lastSyncAt ? Date.now() - new Date(lastSyncAt).getTime() : Infinity
    if (age > STALE_AFTER_MS) void runSync()

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void runSync()
    }, INTERVAL_MS)

    // Coming back to a tab left open overnight should catch up at once rather
    // than waiting out the rest of the interval.
    function onVisible() {
      if (document.visibilityState === 'visible') void runSync()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [connected, lastSyncAt, runSync])

  return null
}
