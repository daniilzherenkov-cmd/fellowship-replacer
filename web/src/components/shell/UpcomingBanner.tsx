'use client'

/**
 * "Your next meeting starts in N minutes", app-wide.
 *
 * Lives in the shell rather than on the calendar page because the moment it
 * matters is precisely when you are NOT looking at your calendar: heads-down
 * in a note, or working through the action list.
 *
 * Deliberately an in-app bar, not a Web Notification. A browser notification
 * needs a permission prompt, only fires while a tab is open anyway, and
 * anything that survives the app being closed needs a service worker plus
 * push infrastructure. The bar delivers most of the value with none of that.
 * A real notification can be layered on later as an opt-in in Settings.
 *
 * Dismissal is per meeting, so dismissing the 10:00 warning does not also
 * silence the 11:00 one.
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

export interface UpcomingMeeting {
  id: string
  title: string
  startAt: string
}

/** How far ahead to warn. Fellow nudges at roughly five minutes. */
const LEAD_MS = 5 * 60_000

export function UpcomingBanner({ meetings }: { meetings: UpcomingMeeting[] }) {
  // A minute tick is enough: the copy is rounded to whole minutes.
  const [now, setNow] = useState(() => Date.now())
  const [dismissed, setDismissed] = useState<string[]>([])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  const next = useMemo(() => {
    return (
      meetings
        .map((m) => ({ ...m, start: new Date(m.startAt).getTime() }))
        // Still upcoming, or started within the last minute so it does not
        // vanish the instant the clock ticks over.
        .filter((m) => m.start > now - 60_000 && m.start - now <= LEAD_MS)
        .filter((m) => !dismissed.includes(m.id))
        .sort((a, b) => a.start - b.start)[0] ?? null
    )
  }, [meetings, now, dismissed])

  if (!next) return null

  const minutes = Math.max(0, Math.round((next.start - now) / 60_000))
  const when = minutes === 0 ? 'now' : `in ${minutes} min`

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 px-4 py-[7px] text-[length:var(--text-base)]"
      style={{
        background: 'var(--color-accent)',
        color: '#fff',
      }}
    >
      <span aria-hidden="true">🕑</span>
      <span className="min-w-0 flex-1 truncate">
        <strong className="font-semibold">{next.title}</strong> starts {when}
      </span>
      <Link
        href={`/meetings/${next.id}`}
        className="shrink-0 px-2 py-[2px] text-[length:var(--text-sm)] font-medium no-underline"
        style={{
          borderRadius: 'var(--radius-row)',
          background: 'rgb(255 255 255 / 0.2)',
          color: '#fff',
        }}
      >
        Open note
      </Link>
      <button
        type="button"
        onClick={() => setDismissed((d) => [...d, next.id])}
        aria-label="Dismiss"
        className="shrink-0 cursor-pointer border-0 bg-transparent px-1 text-[length:var(--text-lg)] leading-none"
        style={{ color: '#fff', opacity: 0.85 }}
      >
        ×
      </button>
    </div>
  )
}
