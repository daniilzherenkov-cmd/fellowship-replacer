'use client'

/**
 * Ask about reminders on a first visit.
 *
 * Danya asked for this to happen automatically rather than only from
 * Settings. It is deliberately a SOFT ask: our own dialog first, and the
 * browser's permission prompt only after the person says yes.
 *
 * Why not call requestPermission() straight away. A browser prompt nobody
 * asked for is usually answered with "Block", and "Block" is permanent -
 * the app can never ask again, and the only fix is buried in browser
 * settings. Asking in our own UI first means a "not now" costs nothing and
 * can be offered again later, while a "yes" reaches the real prompt already
 * intending to accept.
 */

import { useEffect, useState } from 'react'
import { usePushSubscription } from './usePushSubscription'
import { pushSupported } from '@/lib/push-client'

const ASKED_KEY = 'fellow.push.asked'

export function FirstRunPush({ vapidPublicKey }: { vapidPublicKey: string }) {
  const { state, busy, subscribe } = usePushSubscription(vapidPublicKey)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!vapidPublicKey || !pushSupported()) return
    // Only ever once, and never when the decision is already made.
    if (Notification.permission !== 'default') return
    try {
      if (localStorage.getItem(ASKED_KEY)) return
    } catch {
      return
    }
    // A beat after load, so it does not fight the page appearing.
    const t = setTimeout(() => setShow(true), 1200)
    return () => clearTimeout(t)
  }, [vapidPublicKey])

  function remember() {
    try {
      localStorage.setItem(ASKED_KEY, '1')
    } catch {
      // Without storage it may ask again next visit; acceptable.
    }
  }

  function dismiss() {
    remember()
    setShow(false)
  }

  async function accept() {
    remember()
    await subscribe()
    setShow(false)
  }

  if (!show || state === 'subscribed' || state === 'denied' || state === 'unsupported') {
    return null
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="push-ask-title"
      className="fixed z-40 p-4"
      style={{
        right: 20,
        bottom: 20,
        width: 330,
        background: 'var(--color-canvas)',
        border: '1px solid var(--color-hairline)',
        borderRadius: 'var(--radius-card)',
        boxShadow: '0 12px 36px rgb(0 0 0 / 0.18)',
      }}
    >
      <p id="push-ask-title" className="m-0 text-[length:var(--text-base)] font-semibold">
        Get a nudge before meetings?
      </p>
      <p
        className="mb-3 mt-1 text-[length:var(--text-sm)] leading-[1.45]"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        A notification five minutes before each meeting, even when Fellow Hero is closed.
        You can change this any time in Settings.
      </p>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={dismiss}
          className="cursor-pointer border-0 bg-transparent px-2 py-[6px] text-[length:var(--text-sm)]"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Not now
        </button>
        <button
          type="button"
          onClick={accept}
          disabled={busy}
          className="cursor-pointer px-3 py-[6px] text-[length:var(--text-sm)] font-medium text-white"
          style={{
            borderRadius: 'var(--radius-row)',
            border: 0,
            background: 'var(--color-accent)',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? 'Enabling…' : 'Yes, remind me'}
        </button>
      </div>
    </div>
  )
}
