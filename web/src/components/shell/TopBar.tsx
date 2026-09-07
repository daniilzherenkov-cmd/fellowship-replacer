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
          className="inline-flex items-center justify-center text-[11px] font-bold text-white"
          style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--color-accent)' }}
        >
          DH
        </span>
        <span className="text-[13px] font-medium">Fellow 2</span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        {userEmail && (
          <span className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
            {userEmail}
          </span>
        )}
        <button
          type="button"
          onClick={cycleTheme}
          title={`Theme: ${theme} (click to change)`}
          aria-label={`Theme: ${theme}`}
          className="cursor-pointer border-0 bg-transparent p-1 text-[13px]"
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
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="10" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.4" />
            <path
              d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4M15.3 15.3l-1.4-1.4M6.1 6.1 4.7 4.7"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </a>
      </div>
    </header>
  )
}
