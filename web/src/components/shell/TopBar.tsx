'use client'

/**
 * Top bar. Port of TopBar in RootView.swift: 48px tall, a 24x24 accent "DH"
 * square, the workspace name, and controls on the right.
 *
 * Differs from Swift in one deliberate way: theme follows the OS by default
 * (prefers-color-scheme) instead of starting light, with an explicit override
 * persisted in localStorage. A web app that ignores the OS theme feels wrong.
 */

import { useEffect, useState } from 'react'
import { GlobalSearch } from './GlobalSearch'

type Theme = 'light' | 'dark' | 'system'

export function TopBar({ userEmail }: { userEmail: string | null }) {
  const [theme, setTheme] = useState<Theme>('system')

  useEffect(() => {
    const stored = (localStorage.getItem('fellow2-theme') as Theme | null) ?? 'system'
    setTheme(stored)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches)
      root.classList.toggle('dark', dark)
    }
    apply()
    // Keep following the OS while in system mode.
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])

  function cycleTheme() {
    const next: Theme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
    setTheme(next)
    try {
      localStorage.setItem('fellow2-theme', next)
    } catch {
      // Private browsing can throw on write; the in-memory theme still applies.
    }
  }

  return (
    <header
      className="flex shrink-0 items-center gap-3 px-4"
      style={{
        height: 'var(--topbar-height)',
        background: 'var(--color-window)',
        borderBottom: '1px solid var(--color-hairline)',
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center justify-center text-[length:var(--text-xs)] font-bold text-white"
          style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--color-accent)' }}
        >
          DH
        </span>
        <span className="text-[length:var(--text-base)] font-medium">Fellow Hero</span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <GlobalSearch />
        {userEmail && (
          <span className="text-[length:var(--text-sm)]" style={{ color: 'var(--color-text-secondary)' }}>
            {userEmail}
          </span>
        )}
        <button
          type="button"
          onClick={cycleTheme}
          title={`Theme: ${theme} (click to change)`}
          aria-label={`Theme: ${theme}`}
          className="cursor-pointer border-0 bg-transparent p-1 text-[length:var(--text-base)]"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '🌗'}
        </button>
        <a
          href="/settings"
          title="Settings"
          aria-label="Settings"
          className="p-1 no-underline"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {/* A proper toothed cog. The previous icon was a circle with
              radiating spokes, which reads as a sun, and sat next to an
              actual sun in the theme toggle. */}
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M19.4 13a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </a>
      </div>
    </header>
  )
}
