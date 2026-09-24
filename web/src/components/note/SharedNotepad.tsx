'use client'

/**
 * The notepad, when the meeting has a shared note.
 *
 * SCOPE: the notepad only, for now. It is one text field, which makes
 * last-write-wins honest and the pipeline easy to reason about. Talking
 * points and action items are row-based with their own CRUD, so sharing
 * them is a separate and larger change; this proves the membership rule,
 * the channel and the conflict behaviour first.
 *
 * Private notes are deliberately NOT here. They stay on `meeting`,
 * owner-scoped, and never enter a channel.
 */

import { BulletTextarea } from './BulletTextarea'
import { useSharedNote } from './useSharedNote'

export function SharedNotepad({
  externalId,
  initial,
  selfEmail,
  onLocalChange,
}: {
  externalId: string
  initial: string
  selfEmail: string
  /** Keeps the owner's own copy in step, so nothing is lost if sharing is later turned off. */
  onLocalChange: (next: string) => void
}) {
  const { content, viewers, connected, setContent } = useSharedNote(
    externalId,
    initial,
    selfEmail,
  )

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <span
          className="text-[length:var(--text-xs)]"
          style={{ color: connected ? 'var(--color-now)' : 'var(--color-text-tertiary)' }}
        >
          {connected ? 'Shared' : 'Connecting…'}
        </span>
        {viewers.length > 0 && (
          <span
            className="truncate text-[length:var(--text-xs)]"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {/* Presence prevents most collisions socially, which is cheaper
                than preventing them technically. */}
            {viewers.length === 1
              ? `${shortName(viewers[0])} is here`
              : `${viewers.length} others here`}
          </span>
        )}
      </div>

      <BulletTextarea
        value={content}
        onChange={(next) => {
          setContent(next)
          onLocalChange(next)
        }}
        placeholder="Start typing…"
        label="Notepad"
      />
    </div>
  )
}

/** "dana.smith@deliveryhero.com" reads better as "dana.smith". */
function shortName(email: string): string {
  return email.split('@')[0] ?? email
}
