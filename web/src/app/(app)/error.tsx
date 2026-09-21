'use client'

/**
 * Error boundary for every page in the app shell.
 *
 * Without this, a thrown Server Component renders Next's bare "server error"
 * page: no indication of what broke, and the only clue is an opaque Cloudflare
 * ray id. That happened for real - a missing Vault-supplied DB password showed
 * up as a blank page and cost a debugging session.
 *
 * React gives the client a `digest` (a hash of the real error) and withholds
 * the message, which is correct: an error string can leak connection details,
 * SQL, or file paths to whoever is looking. So this shows the digest and says
 * where the real message lives, rather than trying to render it.
 */

import { useEffect } from 'react'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Surfaces in the browser console for local debugging. In production the
    // message is redacted by React, so the pod log remains the source of truth.
    console.error('Page failed to render', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-lg font-semibold text-[var(--text-primary)]">
        Something went wrong on this page
      </h1>

      <p className="max-w-md text-sm text-[var(--text-secondary)]">
        The page could not be loaded. This is usually a temporary problem, so it
        is worth trying again first.
      </p>

      {error.digest && (
        <p className="max-w-md text-xs text-[var(--text-secondary)]">
          Reference <code className="font-mono">{error.digest}</code>. Search the
          pod log for this value to find the underlying error.
        </p>
      )}

      <button
        onClick={reset}
        className="rounded-[10px] bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        Try again
      </button>
    </div>
  )
}
