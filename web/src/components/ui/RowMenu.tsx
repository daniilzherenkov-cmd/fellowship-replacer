'use client'

/**
 * The "⋯" row menu. Port of RowMenu in MeetingNoteView.swift:348.
 *
 * Only rendered while its row is hovered; the caller reserves the space so the
 * row does not shift. Shadow is applied here because docs/02 §3 restricts
 * shadows to popovers and menus.
 */

import { useEffect, useRef, useState } from 'react'

export interface RowMenuItem {
  label: string
  onSelect: () => void
  destructive?: boolean
}

export function RowMenu({ items }: { items: RowMenuItem[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="cursor-pointer border-0 bg-transparent p-0 leading-none"
        style={{ width: 16, color: 'var(--color-text-tertiary)' }}
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <circle cx="4.5" cy="10" r="1.4" />
          <circle cx="10" cy="10" r="1.4" />
          <circle cx="15.5" cy="10" r="1.4" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-44 overflow-hidden py-1"
          style={{
            background: 'var(--color-canvas)',
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--radius-card)',
            boxShadow: 'var(--shadow-popover)',
          }}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
              className="block w-full cursor-pointer border-0 bg-transparent px-3 py-[6px] text-left text-[13px] hover:bg-[var(--color-hover)]"
              style={{
                color: item.destructive
                  ? 'var(--color-overdue)'
                  : 'var(--color-text-primary)',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
