'use client'

/**
 * Icon rail. Port of IconRailView in RootView.swift.
 *
 * 64px wide, buttons 56x50, 17px icon over a 10px label, active state is an
 * accent-subtle rounded rect with accent foreground. Keyboard: Cmd/Ctrl+1-4.
 */

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

const SECTIONS = [
  { href: '/calendar', label: 'Calendar', key: '1', icon: CalendarIcon },
  { href: '/actions', label: 'Actions', key: '2', icon: CheckSquareIcon },
  { href: '/people', label: 'People', key: '3', icon: PeopleIcon },
  { href: '/meetings', label: 'Meetings', key: '4', icon: FolderIcon },
] as const

export function IconRail() {
  const pathname = usePathname()
  const router = useRouter()
  // Which section was just clicked, so the rail responds on the press rather
  // than when the new page arrives. usePathname only updates AFTER the
  // navigation resolves, which on a ~600ms page meant the click looked
  // ignored for over half a second.
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const [, startNav] = useTransition()

  // Clear the pending mark once the URL has actually changed.
  useEffect(() => setPendingHref(null), [pathname])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.metaKey && !e.ctrlKey) return
      const section = SECTIONS.find((s) => s.key === e.key)
      if (!section) return
      e.preventDefault()
      setPendingHref(section.href)
      startNav(() => router.push(section.href))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router])

  return (
    <nav
      aria-label="Sections"
      className="flex shrink-0 flex-col items-center gap-1 py-3"
      style={{
        width: 'var(--rail-width)',
        background: 'var(--color-sidebar)',
        borderRight: '1px solid var(--color-hairline)',
      }}
    >
      {SECTIONS.map((section) => {
        // A meeting note opens from the calendar, so Calendar stays active
        // there - matching Fellow, where the note is part of the calendar flow.
        const isNote = /^\/meetings\/[^/]+$/.test(pathname)
        const active = isNote
          ? section.href === '/calendar'
          : pathname === section.href || pathname.startsWith(`${section.href}/`)
        const Icon = section.icon
        const pending = pendingHref === section.href && !active
        // Show the destination as selected the instant it is clicked.
        const lit = active || pending
        return (
          <Link
            key={section.href}
            href={section.href}
            onClick={() => setPendingHref(section.href)}
            aria-current={active ? 'page' : undefined}
            aria-busy={pending || undefined}
            title={`${section.label} (⌘${section.key})`}
            className="flex flex-col items-center justify-center gap-[3px] no-underline transition-colors duration-100"
            style={{
              width: 56,
              height: 50,
              borderRadius: 10,
              background: lit ? 'var(--color-accent-subtle)' : 'transparent',
              color: lit ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              opacity: pending ? 0.75 : 1,
            }}
          >
            <Icon />
            <span className="text-[length:var(--text-2xs)] leading-none">{section.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

/* SF Symbols equivalents, drawn inline so no icon library is needed. */

function CalendarIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2.5" y="4" width="15" height="13.5" rx="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 8h15" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6.5 2.5v3M13.5 2.5v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function CheckSquareIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2.5" y="2.5" width="15" height="15" rx="3" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="m6.5 10.2 2.4 2.4 4.6-4.9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function PeopleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="7.5" cy="6.5" r="2.8" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 16c0-2.6 2.2-4.3 5-4.3s5 1.7 5 4.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M13.5 4.2a2.8 2.8 0 0 1 0 5.4M14.5 12c2 .4 3 1.9 3 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M2.5 5.5A1.5 1.5 0 0 1 4 4h3.4l1.6 2H16a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 16 16H4a1.5 1.5 0 0 1-1.5-1.5v-9Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}
