'use client'

/**
 * Global search, in the top bar on every screen.
 *
 * Fellow has this field on every page and it was the single largest gap
 * (docs/14 §3). It reaches meetings, talking points, action items and people,
 * because "where did we discuss X" is answered by whichever of those mentions
 * X, not by a type the user has to pick first.
 *
 * ⌘K or ⌘F focuses it, matching both Fellow and the ⌘F in docs/04.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { searchAction } from '@/actions'
import type { SearchHit, SearchKind } from '@/lib/queries'

const KIND_LABEL: Record<SearchKind, string> = {
  meeting: 'Meetings',
  talkingPoint: 'Talking points',
  actionItem: 'Action items',
  person: 'People',
}

const KIND_ORDER: SearchKind[] = ['meeting', 'actionItem', 'talkingPoint', 'person']

export function GlobalSearch() {
  const router = useRouter()
  const [term, setTerm] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  // Guards against an older, slower response overwriting a newer one.
  const seq = useRef(0)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'f')) {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Close when clicking outside.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const run = useCallback(async (value: string) => {
    const mine = ++seq.current
    if (value.trim().length < 2) {
      setHits([])
      return
    }
    try {
      const { hits: found } = await searchAction(value)
      if (seq.current === mine) {
        setHits(found)
        setActive(0)
      }
    } catch {
      if (seq.current === mine) setHits([])
    }
  }, [])

  // Debounced: typing "standup" should not fire seven queries.
  useEffect(() => {
    const t = setTimeout(() => void run(term), 180)
    return () => clearTimeout(t)
  }, [term, run])

  const ordered = KIND_ORDER.flatMap((kind) => hits.filter((h) => h.kind === kind))

  function go(hit: SearchHit) {
    setOpen(false)
    setTerm('')
    setHits([])
    router.push(hit.href)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!ordered.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % ordered.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i - 1 + ordered.length) % ordered.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      go(ordered[active])
    }
  }

  let cursor = -1

  return (
    <div ref={boxRef} className="relative" style={{ width: 280 }}>
      <input
        ref={inputRef}
        value={term}
        onChange={(e) => {
          setTerm(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search…"
        aria-label="Search"
        role="combobox"
        aria-expanded={open && ordered.length > 0}
        aria-controls="global-search-results"
        className="w-full px-3 py-[5px] text-[length:var(--text-sm)] outline-none"
        style={{
          borderRadius: 'var(--radius-row)',
          border: '1px solid var(--color-hairline)',
          background: 'var(--color-sidebar)',
        }}
      />

      {open && term.trim().length >= 2 && (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute right-0 top-[32px] z-40 max-h-[420px] overflow-auto p-1"
          style={{
            width: 420,
            borderRadius: 'var(--radius-card)',
            border: '1px solid var(--color-hairline)',
            background: 'var(--color-canvas)',
            boxShadow: '0 12px 32px rgb(0 0 0 / 0.16)',
          }}
        >
          {ordered.length === 0 ? (
            <p
              className="m-0 px-2 py-3 text-[length:var(--text-sm)]"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Nothing matches “{term}”.
            </p>
          ) : (
            KIND_ORDER.map((kind) => {
              const group = hits.filter((h) => h.kind === kind)
              if (!group.length) return null
              return (
                <div key={kind} className="mb-1">
                  <p
                    className="m-0 px-2 pb-[2px] pt-2 text-[length:var(--text-2xs)] font-semibold uppercase"
                    style={{ color: 'var(--color-text-tertiary)', letterSpacing: '0.04em' }}
                  >
                    {KIND_LABEL[kind]}
                  </p>
                  {group.map((hit) => {
                    cursor += 1
                    const isActive = cursor === active
                    return (
                      <button
                        key={`${hit.kind}-${hit.id}`}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          go(hit)
                        }}
                        className="flex w-full cursor-pointer items-baseline gap-2 border-0 px-2 py-[6px] text-left"
                        style={{
                          borderRadius: 'var(--radius-row)',
                          background: isActive ? 'var(--color-hover)' : 'transparent',
                        }}
                      >
                        <span className="min-w-0 flex-1 truncate text-[length:var(--text-base)]">
                          {hit.title || 'Untitled'}
                        </span>
                        {hit.subtitle && (
                          <span
                            className="shrink-0 truncate text-[length:var(--text-xs)]"
                            style={{ color: 'var(--color-text-secondary)', maxWidth: 150 }}
                          >
                            {hit.subtitle}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
