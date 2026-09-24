'use client'

/**
 * Subscribe to a shared note and publish local edits.
 *
 * Last-write-wins, so the rules that matter are about not fighting yourself:
 *
 *  - Ignore the echo of your own write, matched by revision. Without this
 *    the caret jumps to the end of the textarea every time you save.
 *  - Do not apply a remote update while you are actively typing. Otherwise
 *    a colleague's save mid-sentence replaces the words under your cursor.
 *    The local edit wins and will be published a moment later, which is
 *    exactly what last-write-wins means.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { writeSharedNoteAction } from '@/actions'

/** Debounce before publishing, so a broadcast is not sent per keystroke. */
const PUBLISH_MS = 400
/** A remote update is ignored if you typed within this long. */
const TYPING_GUARD_MS = 1500

export interface SharedNoteState {
  content: string
  viewers: string[]
  connected: boolean
  setContent: (next: string) => void
}

export function useSharedNote(
  externalId: string | null,
  initial: string,
  selfEmail: string,
): SharedNoteState {
  const [content, setLocal] = useState(initial)
  const [viewers, setViewers] = useState<string[]>([])
  const [connected, setConnected] = useState(false)

  const lastTypedAt = useRef(0)
  const publishTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Revisions this client produced, so its own echoes can be ignored.
  const ownRevisions = useRef(new Set<number>())

  useEffect(() => {
    if (!externalId) return
    const source = new EventSource(`/api/notes/${encodeURIComponent(externalId)}/stream`)

    source.onopen = () => setConnected(true)
    source.onerror = () => setConnected(false)
    source.onmessage = (message) => {
      let event: {
        type: string
        content?: string
        revision?: number
        viewers?: string[]
      }
      try {
        event = JSON.parse(message.data)
      } catch {
        return
      }

      if (event.type === 'presence') {
        setViewers((event.viewers ?? []).filter((v) => v !== selfEmail))
        return
      }

      if (event.type !== 'content' || event.content === undefined) return
      // Our own write coming back.
      if (event.revision !== undefined && ownRevisions.current.has(event.revision)) return
      // Mid-sentence: keep what is under the cursor.
      if (Date.now() - lastTypedAt.current < TYPING_GUARD_MS) return

      setLocal(event.content)
    }

    return () => {
      source.close()
      setConnected(false)
    }
  }, [externalId, selfEmail])

  const setContent = useCallback(
    (next: string) => {
      setLocal(next)
      lastTypedAt.current = Date.now()
      if (!externalId) return

      if (publishTimer.current) clearTimeout(publishTimer.current)
      publishTimer.current = setTimeout(async () => {
        const result = await writeSharedNoteAction(externalId, next)
        if (result.ok && result.revision !== undefined) {
          ownRevisions.current.add(result.revision)
          // Keep the set from growing all session.
          if (ownRevisions.current.size > 50) {
            ownRevisions.current = new Set([...ownRevisions.current].slice(-20))
          }
        }
      }, PUBLISH_MS)
    },
    [externalId],
  )

  return { content, viewers, connected, setContent }
}
