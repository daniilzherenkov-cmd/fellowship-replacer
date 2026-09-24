'use client'

/**
 * Load more of the archive when the reader scrolls to either end.
 *
 * A sentinel div sits above the first day and below the last. When one comes
 * into view the next slice is requested, so scrolling just works and the
 * links become a fallback for anyone who prefers to click (and for keyboard
 * users, who never trigger an intersection).
 *
 * THE HARD PART IS LOADING UPWARDS. Prepending older meetings grows the
 * document above the viewport, so the browser keeps the same scrollTop and
 * the content the reader was looking at jumps down the page. We record the
 * scroll height before navigating and restore the offset once the new rows
 * are in, which keeps their place fixed.
 */

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

/** The app shell's scroll container, not the window. */
function scrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null
  while (node) {
    const overflow = getComputedStyle(node).overflowY
    if (overflow === 'auto' || overflow === 'scroll') return node
    node = node.parentElement
  }
  return null
}

const ANCHOR_KEY = 'fellow.archive.anchor'

export function AutoLoadMore({
  href,
  direction,
  disabled = false,
}: {
  href: string
  direction: 'up' | 'down'
  /** Stop observing once there is nothing more to fetch. */
  disabled?: boolean
}) {
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)
  // One navigation at a time; an observer can fire repeatedly while the
  // sentinel stays on screen.
  const busy = useRef(false)

  // Restore the reading position after an upward load.
  useEffect(() => {
    if (direction !== 'up') return
    const raw = sessionStorage.getItem(ANCHOR_KEY)
    if (!raw) return
    sessionStorage.removeItem(ANCHOR_KEY)
    const previousHeight = Number(raw)
    const scroller = scrollParent(ref.current)
    if (!scroller || !Number.isFinite(previousHeight)) return
    const delta = scroller.scrollHeight - previousHeight
    if (delta > 0) scroller.scrollTop += delta
  }, [direction, href])

  useEffect(() => {
    const el = ref.current
    if (!el || disabled) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting) || busy.current) return
        busy.current = true
        if (direction === 'up') {
          const scroller = scrollParent(el)
          if (scroller) {
            try {
              sessionStorage.setItem(ANCHOR_KEY, String(scroller.scrollHeight))
            } catch {
              // Private mode: the list still loads, it just jumps.
            }
          }
        }
        router.replace(href, { scroll: false })
      },
      // Start fetching slightly before the edge so the next slice is usually
      // there by the time the reader arrives.
      { rootMargin: '300px' },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [href, direction, disabled, router])

  return <div ref={ref} aria-hidden="true" style={{ height: 1 }} />
}
