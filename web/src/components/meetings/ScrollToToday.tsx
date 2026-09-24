'use client'

/**
 * Bring today into view when the archive opens.
 *
 * The list is chronological across the whole window, so without this it opens
 * three months in the past and today is hundreds of rows down. The Swift
 * archive auto-scrolled to today on appear; the web port never did.
 *
 * Instant rather than smooth: a long animated scroll on load reads as a bug.
 * Silent when the anchor is absent, which happens on a day with no meetings.
 */

import { useEffect } from 'react'

export function ScrollToToday({ anchorId = 'today' }: { anchorId?: string }) {
  useEffect(() => {
    const el = document.getElementById(anchorId)
    if (!el) return
    el.scrollIntoView({ block: 'start', behavior: 'auto' })
  }, [anchorId])

  return null
}
