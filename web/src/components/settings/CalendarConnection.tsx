'use client'

/**
 * Google Calendar connection panel.
 *
 * Handles three states honestly rather than pretending the feature exists:
 *   not configured -> the deployment has no OAuth credentials yet (docs/12)
 *   not connected  -> credentials exist, this user has not authorised
 *   connected      -> show the account, last sync, and a Sync button
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { syncCalendarAction } from '@/actions'

export function CalendarConnection({
  configured,
  connected,
  googleEmail,
  lastSyncAt,
  lastSyncError,
  status,
  reason,
}: {
  configured: boolean
  connected: boolean
  googleEmail: string | null
  lastSyncAt: string | null
  lastSyncError: string | null
  status: string | null
  reason: string | null
}) {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function sync() {
    setSyncing(true)
    setMessage(null)
    const result = await syncCalendarAction()
    setSyncing(false)
    setMessage(result.ok ? 'Calendar synced.' : describeError(result.error))
    if (result.ok) router.refresh()
  }

  return (
    <section
      className="p-4"
      style={{
        border: '1px solid var(--color-hairline)',
        borderRadius: 'var(--radius-card)',
      }}
    >
      <h2 className="m-0 text-[16px] font-semibold">Google Calendar</h2>
      <p className="mb-3 mt-[2px] text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
        Fellow 2 reads your calendar so your meetings and the people in them appear
        automatically. Read-only: it never creates or changes events.
      </p>

      {status === 'connected' && <Banner tone="ok">Google Calendar connected.</Banner>}
      {status === 'denied' && (
        <Banner tone="warn">Connection cancelled. Nothing was changed.</Banner>
      )}
      {status === 'error' && <Banner tone="warn">{describeCallbackError(reason)}</Banner>}

      {!configured ? (
        <Banner tone="info">
          Google Calendar is not set up in this deployment yet. It needs a Google
          Workspace OAuth client, which is being requested - see{' '}
          <code>docs/12</code>. Everything else in Fellow 2 works without it: you can
          create meetings by hand from the Calendar tab.
        </Banner>
      ) : connected ? (
        <div>
          <dl className="m-0 mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
            <dt style={{ color: 'var(--color-text-secondary)' }}>Account</dt>
            <dd className="m-0">{googleEmail ?? 'Connected'}</dd>
            <dt style={{ color: 'var(--color-text-secondary)' }}>Last sync</dt>
            <dd className="m-0">
              {lastSyncAt ? new Date(lastSyncAt).toLocaleString() : 'Never'}
            </dd>
          </dl>

          {lastSyncError && <Banner tone="warn">Last sync failed: {lastSyncError}</Banner>}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={sync}
              disabled={syncing}
              className="cursor-pointer px-3 py-[6px] text-[13px] font-medium text-white"
              style={{
                borderRadius: 'var(--radius-row)',
                border: 0,
                background: 'var(--color-accent)',
                opacity: syncing ? 0.6 : 1,
              }}
            >
              {syncing ? 'Syncing…' : 'Sync now'}
            </button>
            <a
              href="/api/auth/google/start"
              className="px-3 py-[6px] text-[13px] no-underline"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Reconnect
            </a>
          </div>
          {message && (
            <p className="mt-2 text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
              {message}
            </p>
          )}
        </div>
      ) : (
        <a
          href="/api/auth/google/start"
          className="inline-block px-3 py-[6px] text-[13px] font-medium text-white no-underline"
          style={{ borderRadius: 'var(--radius-row)', background: 'var(--color-accent)' }}
        >
          Connect Google Calendar
        </a>
      )}
    </section>
  )
}

function Banner({
  tone,
  children,
}: {
  tone: 'ok' | 'warn' | 'info'
  children: React.ReactNode
}) {
  const color =
    tone === 'ok'
      ? 'var(--color-now)'
      : tone === 'warn'
        ? 'var(--color-due)'
        : 'var(--color-accent)'
  return (
    <p
      className="mb-3 px-3 py-2 text-[13px]"
      style={{
        borderRadius: 'var(--radius-row)',
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
        color: 'var(--color-text-primary)',
      }}
    >
      {children}
    </p>
  )
}

function describeError(error?: string): string {
  switch (error) {
    case 'not_connected':
      return 'Connect Google Calendar first.'
    case 'reconnect_required':
      return 'Your Google authorisation expired. Reconnect to continue.'
    case 'google_not_configured':
      return 'Google Calendar is not set up in this deployment yet.'
    default:
      return 'Sync failed. Try again in a moment.'
  }
}

function describeCallbackError(reason: string | null): string {
  switch (reason) {
    case 'no_refresh_token':
      return 'Google did not return a durable token. Try connecting again.'
    case 'invalid_state':
      return 'That sign-in link expired. Please start again.'
    case 'identity_mismatch':
      return 'The sign-in did not match your account. Please start again.'
    default:
      return 'Could not connect to Google Calendar. Please try again.'
  }
}
