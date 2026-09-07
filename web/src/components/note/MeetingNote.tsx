'use client'

/**
 * The meeting note. Port of MeetingNoteView.swift.
 *
 * The body is a FIXED three-block template and the order must not change - it
 * is muscle memory (docs/02 §4.2, and CLAUDE.md calls this out explicitly):
 *
 *   Talking Points (circle)  ->  Action Items (checkbox)  ->  Notepad (bullet)
 *
 * Centred at 760px max width with 32px padding, matching the Swift layout.
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TalkingPointRow } from './TalkingPointRow'
import { ActionItemRow } from './ActionItemRow'
import { AvatarStack } from '../ui/Avatar'
import type { MeetingDetail, Person } from '@/lib/queries'
import {
  addActionItemAction,
  addTalkingPointAction,
  deleteActionItemAction,
  deleteTalkingPointAction,
  updateActionItemAction,
  updateMeetingAction,
  updateTalkingPointAction,
} from '@/actions'

export function MeetingNote({
  meeting,
  people,
}: {
  meeting: MeetingDetail
  people: Person[]
}) {
  const router = useRouter()
  const [title, setTitle] = useState(meeting.title)
  const [notepad, setNotepad] = useState(meeting.notepad)
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle')
  const notepadTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => setTitle(meeting.title), [meeting.title])
  useEffect(() => setNotepad(meeting.notepad), [meeting.notepad])

  /** Autosave, no save button - docs/02 §8 asks for a subtle affordance only. */
  function saveNotepad(next: string) {
    setNotepad(next)
    setSaved('saving')
    if (notepadTimer.current) clearTimeout(notepadTimer.current)
    notepadTimer.current = setTimeout(async () => {
      await updateMeetingAction(meeting.id, { notepad: next })
      setSaved('saved')
      setTimeout(() => setSaved('idle'), 1500)
    }, 500)
  }

  function saveTitle(next: string) {
    setTitle(next)
    if (titleTimer.current) clearTimeout(titleTimer.current)
    titleTimer.current = setTimeout(() => {
      updateMeetingAction(meeting.id, { title: next }).then(() => router.refresh())
    }, 500)
  }

  const start = new Date(meeting.startAt)
  const dateLine = `${start.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })} · ${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`

  return (
    <div className="mx-auto w-full" style={{ maxWidth: 'var(--note-max-width)', padding: 32 }}>
      <div className="mb-1 flex items-center gap-2">
        <input
          value={title}
          onChange={(e) => saveTitle(e.target.value)}
          aria-label="Meeting title"
          // Width tracks the text so the 1:1 badge sits next to the title
          // rather than being pushed to the far edge by a full-width input.
          size={Math.max(title.length, 1)}
          className="min-w-0 max-w-full border-0 bg-transparent p-0 text-[22px] font-semibold outline-none"
        />
        {meeting.kind === 'oneOnOne' && (
          <span
            className="shrink-0 px-2 py-[2px] text-[11px] font-medium"
            style={{
              borderRadius: 'var(--radius-pill)',
              background: 'var(--color-accent-subtle)',
              color: 'var(--color-accent)',
            }}
          >
            1:1
          </span>
        )}
      </div>

      <div className="mb-6 flex items-center gap-3">
        <span className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
          {dateLine}
        </span>
        {meeting.attendees.length > 0 && <AvatarStack people={meeting.attendees} />}
        <span
          className="ml-auto text-[11px] transition-opacity"
          style={{
            color: 'var(--color-text-tertiary)',
            opacity: saved === 'idle' ? 0 : 1,
          }}
        >
          {saved === 'saving' ? 'Saving…' : 'Saved'}
        </span>
      </div>

      <Section title="Talking Points" subtitle="The things to talk about">
        {meeting.talkingPoints.map((point) => (
          <TalkingPointRow
            key={point.id}
            point={point}
            onChange={async (fields) => {
              await updateTalkingPointAction(point.id, fields)
              if (fields.isCovered !== undefined) router.refresh()
            }}
            onDelete={async () => {
              await deleteTalkingPointAction(point.id, meeting.id)
              router.refresh()
            }}
          />
        ))}
        <AddRow
          label="New talking point"
          onAdd={async () => {
            await addTalkingPointAction(meeting.id)
            router.refresh()
          }}
        />
      </Section>

      <Section
        title="Action Items"
        subtitle="What came out of this meeting? What are your next steps?"
      >
        {meeting.actionItems.map((item) => (
          <ActionItemRow
            key={item.id}
            item={item}
            people={people}
            onChange={async (fields) => {
              await updateActionItemAction(item.id, fields)
              if (fields.text === undefined) router.refresh()
            }}
            onDelete={async () => {
              await deleteActionItemAction(item.id, meeting.id)
              router.refresh()
            }}
          />
        ))}
        <AddRow
          label="New action item"
          onAdd={async () => {
            await addActionItemAction(meeting.id)
            router.refresh()
          }}
        />
      </Section>

      <Section title="Notepad" subtitle="Anything else to write down?">
        <textarea
          value={notepad}
          onChange={(e) => saveNotepad(e.target.value)}
          placeholder="Start typing…"
          aria-label="Notepad"
          className="w-full resize-y border-0 bg-transparent px-2 py-1 outline-none"
          style={{ minHeight: 120, lineHeight: 1.6 }}
        />
      </Section>
    </div>
  )
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-7">
      <h2 className="m-0 text-[16px] font-semibold">{title}</h2>
      <p className="mb-2 mt-[2px] text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
        {subtitle}
      </p>
      {children}
    </section>
  )
}

function AddRow({ label, onAdd }: { label: string; onAdd: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-2 py-[6px] text-left text-[14px]"
      style={{ color: 'var(--color-text-tertiary)' }}
    >
      <span style={{ width: 14, textAlign: 'center' }}>+</span>
      {label}
    </button>
  )
}
