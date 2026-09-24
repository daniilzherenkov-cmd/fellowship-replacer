'use client'

/**
 * Two nudges to connect Google Calendar, for the state where the deployment
 * HAS OAuth credentials but this user has not authorised yet.
 *
 * Why both:
 *  - The modal fires once, because an empty calendar on first run looks broken
 *    rather than unconnected. Someone who has never seen the app cannot be
 *    expected to know Settings is where the meetings come from.
 *  - The inline card persists, because a one-time modal that has been
 *    dismissed leaves no way back other than Settings, which is exactly the
 *    navigate-away friction SyncButton exists to avoid.
 *
 * Renders NOTHING when already connected, or when the deployment has no
 * credentials. Following SyncButton: no dead controls.
 */

import { useEffect, useState } from 'react'

/** Per-browser, so the modal does not reappear on every visit. */
const DISMISS_KEY = 'fellow.connect-prompt.dismissed'

const CONNECT_HREF = '/api/auth/google/start'

export function ConnectPrompt({
  configured,
  connected,
}: {
  configured: boolean
  connected: boolean
}) {
  const show = configured && !connected
  const [modalOpen, setModalOpen] = useState(false)

  // localStorage is read in an effect, never during render: the server has no
  // such thing, and reading it during render desynchronises hydration.
  useEffect(() => {
    if (!show) return
    let dismissed = false
    try {
      dismissed = window.localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      // Private mode or blocked storage. Showing the modal once per visit is a
      // better failure than never showing it.
    }
    if (!dismissed) setModalOpen(true)
  }, [show])

  function dismiss() {
    setModalOpen(false)
    try {
      window.localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // Nothing to do: worst case it asks again next visit.
    }
  }

  if (!show) return null

  return (
    <>
      <ConnectCard />
      {modalOpen && <ConnectModal onDismiss={dismiss} />}
    </>
  )
}

/** The persistent call to action, living in the agenda column. */
function ConnectCard() {
  return (
    <div
      className="mx-2 mb-2 p-3"
      style={{
        border: '1px solid var(--color-hairline)',
        borderRadius: 'var(--radius-card)',
      }}
    >
      <p className="m-0 text-[length:var(--text-base)] font-semibold">Connect Google Calendar</p>
      <p
        className="mb-[10px] mt-[2px] text-[length:var(--text-sm)] leading-[1.45]"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        Your meetings and the people in them will appear here automatically.
      </p>
      <a
        href={CONNECT_HREF}
        className="inline-block px-3 py-[6px] text-[length:var(--text-sm)] font-medium text-white no-underline"
        style={{ borderRadius: 'var(--radius-row)', background: 'var(--color-accent)' }}
      >
        Connect
      </a>
    </div>
  )
}

/** First-run modal. Escape and backdrop both dismiss, as in any native sheet. */
function ConnectModal({ onDismiss }: { onDismiss: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDismiss])

  return (
    <div
      onClick={onDismiss}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgb(0 0 0 / 0.32)' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-prompt-title"
        // Clicks inside must not reach the backdrop's dismiss handler.
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[380px] p-5"
        style={{
          background: 'var(--color-canvas)',
          border: '1px solid var(--color-hairline)',
          borderRadius: 'var(--radius-card)',
          boxShadow: '0 12px 40px rgb(0 0 0 / 0.18)',
        }}
      >
        <h2 id="connect-prompt-title" className="m-0 text-[length:var(--text-2xl)] font-semibold">
          Connect your calendar
        </h2>
        <p
          className="mb-4 mt-2 text-[length:var(--text-base)] leading-[1.5]"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Fellow Hero reads your Google Calendar so your meetings, and the people in
          them, show up here without any typing. You can also skip this and create
          meetings by hand.
        </p>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onDismiss}
            className="cursor-pointer border-0 bg-transparent px-3 py-[7px] text-[length:var(--text-base)]"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Not now
          </button>
          <a
            href={CONNECT_HREF}
            className="px-3 py-[7px] text-[length:var(--text-base)] font-medium text-white no-underline"
            style={{ borderRadius: 'var(--radius-row)', background: 'var(--color-accent)' }}
          >
            Connect Google Calendar
          </a>
        </div>
      </div>
    </div>
  )
}
