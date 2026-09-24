'use client'

/**
 * "Sync now" for the calendar header.
 *
 * Settings already has a sync button, but Settings is not where anyone is when
 * they notice a meeting missing - they are looking at the calendar. Making them
 * navigate away to fix what is in front of them is the kind of small friction
 * that makes a tool feel worse than the one it replaces.
 *
 * Deliberately quiet: an icon that does nothing visually until it has something
 * to say. It renders nothing at all when Google is not connected, so the
 * not-yet-configured deployment shows no dead control.
 */

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { syncCalendarAction } from '@/actions'
import { summarise, describeError } from './sync-messages'

type Outcome = { kind: 'ok'; created: number; updated: number } | { kind: 'error'; text: string }

export function SyncButton({ connected }: { connected: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [syncing, setSyncing] = useState(false)

  // No connection means nothing to sync. Settings is where you connect.
  if (!connected) return null

  async function sync() {
    setSyncing(true)
    setOutcome(null)
    try {
      const result = await syncCalendarAction()
      if (result.ok) {
        setOutcome({ kind: 'ok', created: result.created ?? 0, updated: result.updated ?? 0 })
        // Server Components hold the meeting list, so a refresh is what actually
        // puts new meetings on screen.
        startTransition(() => router.refresh())
      } else {
        setOutcome({ kind: 'error', text: describeError(result.error) })
      }
    } catch {
      setOutcome({ kind: 'error', text: 'Sync failed. Try again in a moment.' })
    } finally {
      setSyncing(false)
    }
  }

  // The original comment claimed the toast auto-dismissed on success. It did
  // not: there was no timer, so a success readout sat there until clicked and
  // an error looked identical to a stale success. Successes now clear
  // themselves; errors still stay until dismissed.
  useEffect(() => {
    if (outcome?.kind !== 'ok') return
    const t = setTimeout(() => setOutcome(null), 4000)
    return () => clearTimeout(t)
  }, [outcome])

  const busy = syncing || pending

  return (
    <div className="relative">
      <button
        type="button"
        onClick={sync}
        disabled={busy}
        title="Sync calendar"
        aria-label="Sync calendar"
        className="flex h-[22px] w-[22px] cursor-pointer items-center justify-center border-0 bg-transparent p-0"
        style={{
          borderRadius: 'var(--radius-row)',
          color: 'var(--color-text-secondary)',
          opacity: busy ? 0.5 : 1,
        }}
      >
        <RefreshIcon spinning={busy} />
      </button>

      {outcome && (
        <SyncToast outcome={outcome} onDismiss={() => setOutcome(null)} />
      )}
    </div>
  )
}

/**
 * Result readout. Auto-dismisses on success (the calendar itself is the real
 * feedback) but stays put on failure, so an error cannot be missed by looking
 * away for two seconds.
 */
function SyncToast({ outcome, onDismiss }: { outcome: Outcome; onDismiss: () => void }) {
  const isError = outcome.kind === 'error'

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={onDismiss}
      className="absolute right-0 top-[26px] z-20 cursor-pointer whitespace-nowrap px-[10px] py-[5px] text-[length:var(--text-sm)] font-medium"
      style={{
        borderRadius: 'var(--radius-row)',
        border: `1px solid ${isError ? 'var(--color-due)' : 'var(--color-accent)'}`,
        background: isError ? 'var(--color-canvas)' : 'var(--color-accent)',
        color: isError ? 'var(--color-due)' : '#fff',
        boxShadow: '0 4px 14px rgb(0 0 0 / 0.16)',
      }}
    >
      {isError ? outcome.text : summarise(outcome.created, outcome.updated)}
    </div>
  )
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={spinning ? { animation: 'fellow-spin 0.9s linear infinite' } : undefined}
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <polyline points="21 3 21 9 15 9" />
    </svg>
  )
}
