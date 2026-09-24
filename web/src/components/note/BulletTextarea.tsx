'use client'

/**
 * A textarea that behaves like a bullet list.
 *
 * Enter continues the list, an empty bullet steps out, Tab indents. See
 * bullets.ts for why this is a textarea rather than a rich-text editor.
 */

import { useRef } from 'react'
import { onEnter, onTab, seedBullet, BULLET } from './bullets'

export function BulletTextarea({
  value,
  onChange,
  placeholder,
  label,
  minHeight = 120,
}: {
  value: string
  onChange: (next: string) => void
  placeholder: string
  label: string
  minHeight?: number
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  /** Apply an edit and restore the caret, which React would otherwise reset. */
  function apply(result: { value: string; caret: number } | null): boolean {
    if (!result) return false
    onChange(result.value)
    requestAnimationFrame(() => {
      const el = ref.current
      if (el) el.setSelectionRange(result.caret, result.caret)
    })
    return true
  }

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => {
        const next = e.target.value
        // Start the first bullet when the user actually types, NOT on focus:
        // seeding on focus writes a stray "• " for anyone who clicks the
        // notepad and leaves without typing anything.
        if (value.trim() === '' && next.trim() !== '' && !next.startsWith(BULLET)) {
          const seeded = seedBullet('') + next
          onChange(seeded)
          requestAnimationFrame(() => {
            const el = ref.current
            if (el) el.setSelectionRange(seeded.length, seeded.length)
          })
          return
        }
        onChange(next)
      }}
      onKeyDown={(e) => {
        const el = e.currentTarget
        const caret = el.selectionStart ?? 0
        // Only handle a plain caret; a selection means the user is replacing
        // text and the browser's own behaviour is the right one.
        if (el.selectionStart !== el.selectionEnd) return

        if (e.key === 'Enter' && !e.shiftKey) {
          if (apply(onEnter(el.value, caret))) e.preventDefault()
        } else if (e.key === 'Tab') {
          if (apply(onTab(el.value, caret, e.shiftKey))) e.preventDefault()
        }
      }}
      placeholder={placeholder}
      aria-label={label}
      className="w-full resize-y border-0 bg-transparent px-2 py-1 outline-none"
      style={{ minHeight, lineHeight: 1.6 }}
    />
  )
}
