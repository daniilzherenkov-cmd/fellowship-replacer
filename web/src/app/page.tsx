'use client'

/**
 * Root page.
 *
 * Renders a 200 rather than issuing a server-side redirect. The Kubernetes
 * readiness probe targets `/` and accepts only 2xx; it does not follow
 * redirects, so a 307 here would leave the pod permanently unready and stall
 * the rollout with no obvious cause.
 *
 * Navigation happens client-side instead, and it returns you to WHERE YOU
 * WERE rather than always to the calendar. Fellow reopens the last screen,
 * and reloading into an empty "select a meeting" pane after you had a note
 * open feels like the app forgot what you were doing.
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LAST_ROUTE_KEY, isRestorableRoute } from '@/lib/last-route'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    let target = '/calendar'
    try {
      const saved = localStorage.getItem(LAST_ROUTE_KEY)
      // Validated rather than trusted: this ends up in router.replace, and a
      // value from storage should never be able to send someone off-site.
      if (saved && isRestorableRoute(saved)) target = saved
    } catch {
      // Private mode or blocked storage: the calendar is a fine default.
    }
    router.replace(target)
  }, [router])

  return (
    <div style={{ padding: 32, fontSize: 'var(--text-md)' }}>
      <p>
        Opening Fellow Hero… <Link href="/calendar">Continue</Link>
      </p>
    </div>
  )
}
