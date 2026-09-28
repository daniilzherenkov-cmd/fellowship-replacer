'use client'

/**
 * Google Calendar connection panel.
 *
 * Handles three states honestly rather than pretending the feature exists:
 *   not configured -> the deployment has no OAuth credentials yet (docs/12)
 *   not connected  -> credentials exist, this user has not authorised
 *   connected      -> show the account, last sync, and a Sync button
 *
 * Arriving from the OAuth callback with `syncing=1` starts the first import
 * here, with a progress state, instead of the callback doing it while the
 * browser waits on a redirect (that ended in a gateway timeout).
 */

import { useEffect, useRef, useState } from 'react'
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
  autoSync = false,
}: {
  configured: boolean
  connected: boolean
  googleEmail: string | null
  lastSyncAt: string | null
  lastSyncError: string | null
  status: string | null
  reason: string | null
  /** Run the first import on mount. Set by the OAuth callback redirect. */
  autoSync?: boolean
}) {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [firstImport, setFirstImport] = useState(autoSync && connected)
  const [message, setMessage] = useState<string | null>(null)

  async function sync() {
    setSyncing(true)
    setMessage(null)
    let result: Awaited<ReturnType<typeof syncCalendarAction>>
    try {
      result = await syncCalendarAction()
    } catch {
      // The request itself failed, usually a gateway timeout on a long first
      // import. The server keeps going regardless, so wait for it to land
      // rather than report a failure that may not be one.
      const landed = await waitForSync(lastSyncAt)
      result = landed ? { ok: true } : { ok: false }
    }
    setSyncing(false)
    setFirstImport(false)
    setMessage(result.ok ? 'Calendar synced.' : describeError(result.error))
    if (result.ok) router.refresh()
  }

  const started = useRef(false)
  useEffect(() => {
    if (!firstImport || started.current) return
    started.current = true
    // Drop the query flag first, so a reload does not start a second import.
    router.replace('/settings?google=connected')
    void sync()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section
      className="p-4"
      style={{
        border: '1px solid var(--color-hairline)',
        borderRadius: 'var(--radius-card)',
      }}
    >
      <h2 className="m-0 text-[length:var(--text-xl)] font-semibold">Google Calendar</h2>
      <p className="mb-3 mt-[2px] text-[length:var(--text-base)]" style={{ color: 'var(--color-text-secondary)' }}>
        Your meetings and the people in them appear automatically.
      </p>

      {firstImport ? (
        <Banner tone="info">
          <span role="status" className="inline-flex items-center gap-2">
            <Spinner />
            Connected. Importing your meetings, this can take up to a minute…
          </span>
        </Banner>
      ) : (
        status === 'connected' && <Banner tone="ok">Google Calendar connected.</Banner>
      )}
      {status === 'denied' && (
        <Banner tone="warn">Connection cancelled. Nothing was changed.</Banner>
      )}
      {status === 'error' && <Banner tone="warn">{describeCallbackError(reason)}</Banner>}

      {!configured ? (
        <Banner tone="info">
          Google Calendar is not set up in this deployment yet. It needs a Google
          Workspace OAuth client, which is being requested - see{' '}
          <code>docs/12</code>. Everything else in Fellow Hero works without it: you can
          create meetings by hand from the Calendar tab.
        </Banner>
      ) : connected ? (
        <div>
          <dl className="m-0 mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[length:var(--text-base)]">
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
              className="cursor-pointer px-3 py-[6px] text-[length:var(--text-base)] font-medium text-white"
              style={{
                borderRadius: 'var(--radius-row)',
                border: 0,
                background: 'var(--color-accent-solid)',
                opacity: syncing ? 0.6 : 1,
              }}
            >
              {syncing ? 'Syncing…' : 'Sync now'}
            </button>
            <a
              href="/api/auth/google/start"
              className="px-3 py-[6px] text-[length:var(--text-base)] no-underline"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Reconnect
            </a>
          </div>
          {message && (
            <div className="mt-3">
              <Banner tone={message.startsWith('Calendar synced') ? 'ok' : 'warn'}>
                {message}
              </Banner>
            </div>
          )}
        </div>
      ) : (
        <a
          href="/api/auth/google/start"
          className="inline-block px-3 py-[6px] text-[length:var(--text-base)] font-medium text-white no-underline"
          style={{ borderRadius: 'var(--radius-row)', background: 'var(--color-accent-solid)' }}
        >
          Connect Google Calendar
        </a>
      )}
    </section>
  )
}

/**
 * Poll the status endpoint until last sync moves past `before`.
 * Two minutes is well past the longest first import seen so far (assumed,
 * not measured on the largest calendars).
 */
async function waitForSync(before: string | null): Promise<boolean> {
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 4000))
    try {
      const res = await fetch('/api/calendar/sync', { cache: 'no-store' })
      if (!res.ok) continue
      const body = (await res.json()) as { lastSyncAt: string | null; lastSyncError: string | null }
      if (body.lastSyncAt && body.lastSyncAt !== before) return !body.lastSyncError
    } catch {
      // Keep waiting; one failed poll says nothing.
    }
  }
  return false
}

function Spinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className="animate-spin">
      <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.6" />
      <path d="M7 1.5a5.5 5.5 0 0 1 5.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
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
      className="mb-3 px-3 py-2 text-[length:var(--text-base)]"
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
