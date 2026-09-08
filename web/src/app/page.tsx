'use client'

/**
 * Root page.
 *
 * Renders a 200 rather than issuing a server-side redirect. The Kubernetes
 * readiness probe is configured against `/`, and probes accept only 2xx - they
 * do not follow redirects. A 307 here would leave the pod permanently unready
 * and stall the rollout with no obvious cause.
 *
 * The navigation to /calendar happens client-side instead, so users still land
 * where they expect.
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/calendar')
  }, [router])

  return (
    <div style={{ padding: 32, fontSize: 14 }}>
      <p>
        Opening your calendar… <Link href="/calendar">Continue</Link>
      </p>
    </div>
  )
}
