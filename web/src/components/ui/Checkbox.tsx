'use client'

/**
 * Fellow-style action-item checkbox. Port of ActionCheckbox in
 * DesignSystem.swift.
 *
 * Three fidelity rules Danya has called out before, all load-bearing:
 *  1. Hover is scoped to the BOX ITSELF, not the surrounding row. Hovering the
 *     row must not tint the checkbox.
 *  2. On hover the box fills at accent/18% with an accent border and shows NO
 *     checkmark glyph. The glyph appears only once actually done.
 *  3. 18x18, 5px radius, 1.5px stroke, 0.12s ease-in-out.
 */

import { useState } from 'react'

export function Checkbox({
  checked,
  onToggle,
  label,
}: {
  checked: boolean
  onToggle: () => void
  label?: string
}) {
  const [hover, setHover] = useState(false)

  const background = checked
    ? 'var(--color-accent)'
    : hover
      ? 'color-mix(in srgb, var(--color-accent) 18%, transparent)'
      : 'transparent'

  const borderColor = checked || hover
    ? 'var(--color-accent)'
    : 'var(--color-text-tertiary)'

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="inline-flex shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0"
      style={{ width: 18, height: 18 }}
    >
      <span
        className="inline-flex items-center justify-center transition-[background-color,border-color] duration-[120ms] ease-in-out"
        style={{
          width: 18,
          height: 18,
          borderRadius: 'var(--radius-checkbox)',
          border: `1.5px solid ${borderColor}`,
          background,
        }}
      >
        {checked && (
          <svg
            width="11"
            height="11"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2.5 6.2 4.8 8.5 9.5 3.8"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    </button>
  )
}
