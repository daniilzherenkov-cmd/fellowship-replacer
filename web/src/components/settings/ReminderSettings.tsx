'use client'

/**
 * Opt in to meeting reminders, delivered by Web Push.
 *
 * These arrive with the browser CLOSED: a service worker receives the push
 * and the app's own scheduler sends it (see lib/push.ts). That is possible
 * because the platform pins this app to a single always-on replica, so a
 * timer started at boot is a real scheduler.
 */

import { useState } from 'react'
import { usePushSubscription } from '../shell/usePushSubscription'
import { sendTestPushAction } from '@/actions'

export function ReminderSettings({ vapidPublicKey }: { vapidPublicKey: string }) {
  const { state, busy, subscribe, unsubscribe } = usePushSubscription(vapidPublicKey)
  const [note, setNote] = useState<string | null>(null)

  async function enable() {
    setNote(null)
    const ok = await subscribe()
    if (!ok) return
    // Prove it immediately; an opt-in that shows nothing feels broken.
    const result = await sendTestPushAction()
    setNote(
      result.ok
        ? 'Sent a test notification to this device.'
        : 'Subscribed, but the test notification could not be sent.',
    )
  }

  return (
    <section
      className="p-4"
      style={{ border: '1px solid var(--color-hairline)', borderRadius: 'var(--radius-card)' }}
    >
      <h2 className="m-0 text-[length:var(--text-xl)] font-semibold">Meeting reminders</h2>
      <p
        className="mb-3 mt-[2px] text-[length:var(--text-base)]"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        A notification five minutes before each meeting. These arrive even when Fellow
        Hero is closed.
      </p>

      {!vapidPublicKey ? (
        <Banner>
          Push is not configured in this deployment yet. The <code>VAPID_PUBLIC_KEY</code>{' '}
          and <code>VAPID_PRIVATE_KEY</code> secrets need to be set.
        </Banner>
      ) : state === 'unsupported' ? (
        <Banner>This browser does not support push notifications.</Banner>
      ) : state === 'denied' ? (
        <Banner>
          Notifications are blocked for this site. Allow them in your browser’s site
          settings, then reload this page.
        </Banner>
      ) : state === 'subscribed' ? (
        <div className="flex items-center gap-3">
          <span
            className="text-[length:var(--text-base)] font-medium"
            style={{ color: 'var(--color-now)' }}
          >
            Reminders are on for this device
          </span>
          <button
            type="button"
            onClick={unsubscribe}
            disabled={busy}
            className="cursor-pointer border-0 bg-transparent px-2 py-[6px] text-[length:var(--text-base)]"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Turn off
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={enable}
          disabled={busy}
          className="cursor-pointer px-3 py-[6px] text-[length:var(--text-base)] font-medium text-white"
          style={{
            borderRadius: 'var(--radius-row)',
            border: 0,
            background: 'var(--color-accent)',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? 'Enabling…' : 'Turn on reminders'}
        </button>
      )}

      {note && (
        <p
          className="mt-3 text-[length:var(--text-sm)]"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {note}
        </p>
      )}

      <p
        className="mt-3 text-[length:var(--text-sm)]"
        style={{ color: 'var(--color-text-tertiary)' }}
      >
        Reminders are per device, because a push subscription belongs to one browser.
        Turn them on wherever you want them.
      </p>
    </section>
  )
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="m-0 p-3 text-[length:var(--text-sm)]"
      style={{
        borderRadius: 'var(--radius-row)',
        background: 'var(--color-sidebar)',
        color: 'var(--color-text-secondary)',
      }}
    >
      {children}
    </p>
  )
}
