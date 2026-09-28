'use client'

/**
 * Bring today into view when the archive opens, and keep a way back to it.
 *
 * The list is chronological across the whole window, so without the initial
 * scroll it opens weeks in the past and today is hundreds of rows down. The
 * Swift archive auto-scrolled to today on appear; the web port never did.
 *
 * Landing mid-list with the page title scrolled away read as disorienting
 * (UX review, 2026-09), so two cues go with it: day headers are sticky, and a
 * "Today" pill appears whenever today's section is off screen, pointing the
 * way it lies. The archive always renders a Today section, even on a day
 * with no meetings, so the anchor is never missing.
 *
 * Instant rather than smooth on load: a long animated scroll reads as a bug.
 * The pill scrolls smoothly, because there the user asked for the movement.
 */

import { useEffect, useState } from 'react'

export function ScrollToToday({ anchorId = 'today' }: { anchorId?: string }) {
  // null while today is visible (or absent); otherwise which way it lies.
  const [direction, setDirection] = useState<'up' | 'down' | null>(null)

  useEffect(() => {
    const el = document.getElementById(anchorId)
    if (!el) return
    el.scrollIntoView({ block: 'start', behavior: 'auto' })

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setDirection(null)
      else setDirection(entry.boundingClientRect.top < 0 ? 'up' : 'down')
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [anchorId])

  if (!direction) return null

  return (
    <button
      type="button"
      onClick={() =>
        document.getElementById(anchorId)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
      }
      className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2 cursor-pointer px-3 py-[6px] text-[length:var(--text-sm)] font-medium text-white"
      style={{
        border: 0,
        borderRadius: 'var(--radius-pill)',
        background: 'var(--color-accent-solid)',
        boxShadow: '0 6px 20px rgb(0 0 0 / 0.18)',
      }}
    >
      {direction === 'up' ? '↑' : '↓'} Today
    </button>
  )
}
