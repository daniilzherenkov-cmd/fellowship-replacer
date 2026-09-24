'use client'

/**
 * Record the current screen so `/` can return you to it.
 *
 * Mounted once in the app shell rather than per page, so every route is
 * covered without each one remembering to opt in.
 */

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { rememberRoute } from '@/lib/last-route'

export function RememberRoute() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const query = searchParams.toString()
    rememberRoute(query ? `${pathname}?${query}` : pathname)
  }, [pathname, searchParams])

  return null
}
