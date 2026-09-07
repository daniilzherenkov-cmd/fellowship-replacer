'use client'

/**
 * Google Calendar via a secret .ics address - the no-OAuth path.
 *
 * The URL is a bearer credential: whoever holds it can read the entire
 * calendar, it never expires, and it is not scoped to this app. The copy below
 * says so plainly rather than burying it, and tells the user how to revoke it
 * (Google can reset the address, which invalidates the old one).
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { connectIcsAction, syncIcsAction, disconnectIcsAction } from '@/actions'

export function IcsConnection({
  connected,
  maskedUrl,
  lastSyncAt,
}: {
  connected: boolean
  maskedUrl: string | null
  lastSyncAt: string | null
}) {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function connect() {
    setBusy(true)
    setError(null)
    setMessage(null)
    const result = await connectIcsAction(url)
    setBusy(false)
    if (!result.ok) {
      setError(result.error ?? 'Could not import that calendar.')
      return
    }
    setUrl('')
    setMessage(
      `Imported ${result.created ?? 0} meeting${result.created === 1 ? '' : 's'}` +
        (result.totalEvents ? ` from ${result.totalEvents} calendar entries.` : '.'),
    )
    router.refresh()
  }

  async function sync() {
    setBusy(true)
    setError(null)
    setMessage(null)
    const result = await syncIcsAction()
    setBusy(false)
    if (!result.ok) setError(result.error ?? 'Sync failed.')
    else setMessage('Calendar refreshed.')
    router.refresh()
  }

  async function disconnect() {
    setBusy(true)
    await disconnectIcsAction()
    setBusy(false)
    setMessage('Calendar address removed. Meetings already imported are kept.')
    router.refresh()
  }

  return (
    <section
      className="mt-4 p-4"
      style={{ border: '1px solid var(--color-hairline)', borderRadius: 'var(--radius-card)' }}
    >
      <h2 className="m-0 text-[16px] font-semibold">Calendar address (no sign-in needed)</h2>
      <p className="mb-3 mt-[2px] text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
        Works today, without waiting for Google sign-in to be approved. Paste the private
        address of your calendar and Fellow 2 will keep your meetings up to date.
      </p>

      {connected ? (
        <div>
          <dl className="m-0 mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
            <dt style={{ color: 'var(--color-text-secondary)' }}>Address</dt>
            <dd className="m-0 break-all font-mono text-[12px]">{maskedUrl}</dd>
            <dt style={{ color: 'var(--color-text-secondary)' }}>Last refreshed</dt>
            <dd className="m-0">
              {lastSyncAt ? new Date(lastSyncAt).toLocaleString() : 'Never'}
            </dd>
          </dl>

          <p className="mb-3 text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
            Google updates this feed on its own schedule, often only every few hours, so very
            recent changes can take a while to appear.
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={sync}
              disabled={busy}
              className="cursor-pointer px-3 py-[6px] text-[13px] font-medium text-white"
              style={{
                borderRadius: 'var(--radius-row)',
                border: 0,
                background: 'var(--color-accent)',
                opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? 'Refreshing…' : 'Refresh now'}
            </button>
            <button
              type="button"
              onClick={disconnect}
              disabled={busy}
              className="cursor-pointer border-0 bg-transparent px-3 py-[6px] text-[13px]"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Remove address
            </button>
          </div>
        </div>
      ) : (
        <div>
          <ol
            className="mb-3 ml-4 mt-0 text-[13px]"
            // Tailwind's preflight strips list-style, so restore it explicitly.
            style={{ color: 'var(--color-text-secondary)', listStyle: 'decimal' }}
          >
            <li>
              Open Google Calendar → <strong>Settings</strong> → pick your calendar in the
              left sidebar.
            </li>
            <li>
              Scroll to <strong>Secret address in iCal format</strong> and copy it.
            </li>
            <li>Paste it below.</li>
          </ol>

          <label htmlFor="ics-url" className="sr-only">
            Secret calendar address
          </label>
          <input
            id="ics-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://calendar.google.com/calendar/ical/…/private-…/basic.ics"
            aria-label="Secret calendar address"
            className="mb-2 w-full px-3 py-[6px] text-[13px] outline-none"
            style={{
              borderRadius: 'var(--radius-row)',
              border: '1px solid var(--color-hairline)',
              background: 'var(--color-canvas)',
            }}
          />

          <button
            type="button"
            onClick={connect}
            disabled={busy || url.trim().length === 0}
            className="cursor-pointer px-3 py-[6px] text-[13px] font-medium text-white"
            style={{
              borderRadius: 'var(--radius-row)',
              border: 0,
              background: 'var(--color-accent)',
              opacity: busy || !url.trim() ? 0.5 : 1,
            }}
          >
            {busy ? 'Importing…' : 'Import calendar'}
          </button>
        </div>
      )}

      {message && (
        <p className="mt-3 text-[13px]" style={{ color: 'var(--color-now)' }}>
          {message}
        </p>
      )}
      {error && (
        <p className="mt-3 text-[13px]" style={{ color: 'var(--color-overdue)' }}>
          {error}
        </p>
      )}

      {/* Stated plainly rather than buried: this address is as sensitive as a
          password, and the user needs to know it is revocable. */}
      <p
        className="mt-3 px-3 py-2 text-[12px]"
        style={{
          borderRadius: 'var(--radius-row)',
          background: 'color-mix(in srgb, var(--color-due) 10%, transparent)',
        }}
      >
        <strong>Treat this address like a password.</strong> Anyone who has it can read your
        whole calendar, and it does not expire on its own. Fellow 2 stores it encrypted and
        never shows it again. If it is ever exposed, use{' '}
        <em>Reset private URLs</em> in Google Calendar settings to invalidate it.
      </p>
    </section>
  )
}
