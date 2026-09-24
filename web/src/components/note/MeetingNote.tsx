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

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TalkingPointRow } from './TalkingPointRow'
import { ActionItemRow } from './ActionItemRow'
import { AvatarStack } from '../ui/Avatar'
import { RowMenu } from '../ui/RowMenu'
import { timeLeftLabel } from './time-left'
import { CarriedForward } from './CarriedForward'
import { useRowDrag, moveItem } from './useRowDrag'
import { BulletTextarea } from './BulletTextarea'
import { SharedNotepad } from './SharedNotepad'
import type { ActionItem, MeetingDetail, Person } from '@/lib/queries'
import {
  addActionItemAction,
  addTalkingPointAction,
  deleteActionItemAction,
  deleteTalkingPointAction,
  updateActionItemAction,
  updateMeetingAction,
  deleteMeetingAction,
  updateMeetingTimeAction,
  reorderTalkingPointsAction,
  reorderActionItemsAction,
  updateTalkingPointAction,
} from '@/actions'

/**
 * Restrict `@` to people who use the app themselves. Off until multi-user
 * makes the registered set larger than one. See docs/15 A2.
 */
const FILTER_TO_REGISTERED = false

export function MeetingNote({
  meeting,
  sharedExternalId = null,
  selfEmail = '',
  carried = null,
  people,
}: {
  meeting: MeetingDetail
  /** Set when this meeting has a shared note the caller may join. */
  sharedExternalId?: string | null
  selfEmail?: string
  carried?: { items: ActionItem[]; fromMeetingId: string; fromTitle: string } | null
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

  const [privateNotes, setPrivateNotes] = useState(meeting.privateNotes)
  const privateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => setPrivateNotes(meeting.privateNotes), [meeting.privateNotes])

  /** Same autosave shape as the notepad, on its own debounce. */
  function savePrivateNotes(next: string) {
    setPrivateNotes(next)
    setSaved('saving')
    if (privateTimer.current) clearTimeout(privateTimer.current)
    privateTimer.current = setTimeout(async () => {
      await updateMeetingAction(meeting.id, { privateNotes: next })
      setSaved('saved')
      setTimeout(() => setSaved('idle'), 1500)
    }, 500)
  }

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

  /**
   * Who `@` offers. Fellow scopes this to the meeting's own attendees who
   * hold an account, NOT the whole directory: a retro was offering everyone
   * Danya had ever met, alphabetically.
   *
   * `isRegistered` means "has connected a calendar to this app" (see
   * queries.ts). Today that is effectively just the owner, so hard-filtering
   * on it would leave the picker with one name. Instead attendees are scoped
   * and the registered ones sort first; flip FILTER_TO_REGISTERED once enough
   * people use the app for that to be the better default.
   */
  // A minute tick drives the "50m left" chip; the copy is whole minutes.
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])
  const timeLeft = timeLeftLabel(meeting.startAt, meeting.endAt, nowMs)

  const [editingTime, setEditingTime] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  async function removeMeeting() {
    // Deleting a meeting takes its notes with it, so it is worth one prompt.
    const ok = window.confirm(
      `Delete "${meeting.title || 'this meeting'}"? Its talking points and action items go too.`,
    )
    if (!ok) return
    const result = await deleteMeetingAction(meeting.id)
    if (!result.ok) {
      setNotice('Could not delete this meeting.')
      return
    }
    if (result.googleError && result.googleError !== 'not_connected') {
      // Gone here, still on the calendar: say so rather than imply both.
      setNotice('Deleted here, but removing it from Google Calendar failed.')
      return
    }
    router.push('/calendar')
  }

  // Optimistic order. The server is the source of truth, but waiting for a
  // round trip before the row moves makes dragging feel broken.
  const [pointOrder, setPointOrder] = useState<string[] | null>(null)
  const [itemOrder, setItemOrder] = useState<string[] | null>(null)

  const orderedPoints = useMemo(() => {
    if (!pointOrder) return meeting.talkingPoints
    const byId = new Map(meeting.talkingPoints.map((p) => [p.id, p]))
    const out = pointOrder.map((id) => byId.get(id)).filter((p) => p !== undefined)
    // Anything added since the drag still has to appear.
    for (const p of meeting.talkingPoints) if (!pointOrder.includes(p.id)) out.push(p)
    return out
  }, [meeting.talkingPoints, pointOrder])

  const orderedItems = useMemo(() => {
    if (!itemOrder) return meeting.actionItems
    const byId = new Map(meeting.actionItems.map((i) => [i.id, i]))
    const out = itemOrder.map((id) => byId.get(id)).filter((i) => i !== undefined)
    for (const i of meeting.actionItems) if (!itemOrder.includes(i.id)) out.push(i)
    return out
  }, [meeting.actionItems, itemOrder])

  const pointDrag = useRowDrag((from, to) => {
    const ids = moveItem(orderedPoints.map((p) => p.id), from, to)
    setPointOrder(ids)
    void reorderTalkingPointsAction(meeting.id, ids).then(() => router.refresh())
  })

  const itemDrag = useRowDrag((from, to) => {
    const ids = moveItem(orderedItems.map((i) => i.id), from, to)
    setItemOrder(ids)
    void reorderActionItemsAction(meeting.id, ids).then(() => router.refresh())
  })

  const mentionable = useMemo(() => {
    const attendees = meeting.attendees
    const list = FILTER_TO_REGISTERED ? attendees.filter((p) => p.isRegistered) : attendees
    return [...list].sort(
      (a, b) => Number(b.isRegistered) - Number(a.isRegistered) || a.name.localeCompare(b.name),
    )
  }, [meeting.attendees])

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
          className="min-w-0 max-w-full border-0 bg-transparent p-0 text-[length:var(--text-3xl)] font-semibold outline-none"
        />
        {meeting.kind === 'oneOnOne' && (
          <span
            className="shrink-0 px-2 py-[2px] text-[length:var(--text-xs)] font-medium"
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
        <span className="text-[length:var(--text-base)]" style={{ color: 'var(--color-text-secondary)' }}>
          {dateLine}
        </span>

        {timeLeft && (
          <span
            className="shrink-0 px-2 py-[2px] text-[length:var(--text-xs)] font-medium"
            style={{
              borderRadius: 'var(--radius-pill)',
              background: 'var(--color-accent-subtle)',
              color: 'var(--color-accent)',
            }}
          >
            {timeLeft}
          </span>
        )}

        {/* Fellow puts a green Meet badge next to the date. The URL has always
            been parsed off the calendar event; it just had nowhere to live. */}
        {meeting.conferenceUrl && (
          <a
            href={meeting.conferenceUrl}
            target="_blank"
            rel="noreferrer"
            className="flex shrink-0 items-center gap-[5px] px-2 py-[3px] text-[length:var(--text-sm)] font-medium no-underline"
            style={{
              borderRadius: 'var(--radius-row)',
              border: '1px solid var(--color-hairline)',
              color: 'var(--color-text-primary)',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: 'var(--color-now)',
                display: 'inline-block',
              }}
            />
            Google Meet
          </a>
        )}

        {meeting.location && !meeting.conferenceUrl && (
          <span
            className="shrink-0 truncate text-[length:var(--text-sm)]"
            style={{ color: 'var(--color-text-secondary)', maxWidth: 240 }}
            title={meeting.location}
          >
            {meeting.location}
          </span>
        )}

        {meeting.attendees.length > 0 && <AvatarStack people={meeting.attendees} />}

        <span className="ml-1">
          <RowMenu
            items={[
              { label: editingTime ? 'Done editing time' : 'Edit time', onSelect: () => setEditingTime((v) => !v) },
              { label: 'Delete meeting', onSelect: removeMeeting, destructive: true },
            ]}
          />
        </span>
        <span
          className="ml-auto text-[length:var(--text-xs)] transition-opacity"
          style={{
            color: 'var(--color-text-tertiary)',
            opacity: saved === 'idle' ? 0 : 1,
          }}
        >
          {saved === 'saving' ? 'Saving…' : 'Saved'}
        </span>
      </div>

      {editingTime && (
        <TimeEditor
          startAt={meeting.startAt}
          endAt={meeting.endAt}
          onSave={async (startAt, endAt) => {
            await updateMeetingTimeAction(meeting.id, startAt, endAt)
            setEditingTime(false)
            router.refresh()
          }}
          onCancel={() => setEditingTime(false)}
        />
      )}

      {notice && (
        <p className="mb-4 text-[length:var(--text-sm)]" style={{ color: 'var(--color-due)' }}>
          {notice}
        </p>
      )}

      {carried && (
        <CarriedForward
          meetingId={meeting.id}
          items={carried.items}
          fromMeetingId={carried.fromMeetingId}
          fromTitle={carried.fromTitle}
        />
      )}

      <Section title="Talking Points" subtitle="The things to talk about">
        {orderedPoints.map((point, index) => (
          <div
            key={point.id}
            {...pointDrag.handlers(index)}
            style={{
              opacity: pointDrag.draggingIndex === index ? 0.4 : 1,
              borderTop:
                pointDrag.overIndex === index && pointDrag.draggingIndex !== index
                  ? '2px solid var(--color-accent)'
                  : '2px solid transparent',
            }}
          >
          <TalkingPointRow
            people={mentionable}
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
          </div>
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
        {orderedItems.map((item, index) => (
          <div
            key={item.id}
            {...itemDrag.handlers(index)}
            style={{
              opacity: itemDrag.draggingIndex === index ? 0.4 : 1,
              borderTop:
                itemDrag.overIndex === index && itemDrag.draggingIndex !== index
                  ? '2px solid var(--color-accent)'
                  : '2px solid transparent',
            }}
          >
          <ActionItemRow
            item={item}
            people={people}
            mentionable={mentionable}
            onChange={async (fields) => {
              await updateActionItemAction(item.id, fields)
              // Refresh when ANYTHING other than text changed. Text alone is
              // skipped so a debounced save cannot clobber what is still
              // being typed, but assignment used to be caught by that guard
              // too: picking someone from @ sent {text, assigneeId} together,
              // so the avatar did not appear until an unrelated refresh.
              const { text: _text, ...rest } = fields
              if (Object.keys(rest).length > 0) router.refresh()
            }}
            onDelete={async () => {
              await deleteActionItemAction(item.id, meeting.id)
              router.refresh()
            }}
          />
          </div>
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
        {sharedExternalId ? (
          <SharedNotepad
            externalId={sharedExternalId}
            initial={notepad}
            selfEmail={selfEmail}
            // Mirror into the owner's own row too, so the note survives
            // sharing being turned off or the channel being unavailable.
            onLocalChange={saveNotepad}
          />
        ) : (
          <BulletTextarea
            value={notepad}
            onChange={saveNotepad}
            placeholder="Start typing…"
            label="Notepad"
          />
        )}
      </Section>

      {/* Fellow gives the manager a private panel on a 1:1: coaching notes
          the report never sees. Shown only on 1:1s, where it belongs. */}
      {meeting.kind === 'oneOnOne' && (
        <Section
          title="Private notes"
          subtitle="Only you can see this. Not shared with the other person."
        >
          <BulletTextarea
            value={privateNotes}
            onChange={savePrivateNotes}
            placeholder="Coaching notes, things to remember…"
            label="Private notes"
            minHeight={90}
          />
        </Section>
      )}
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
      <h2 className="m-0 text-[length:var(--text-xl)] font-semibold">{title}</h2>
      <p className="mb-2 mt-[2px] text-[length:var(--text-base)]" style={{ color: 'var(--color-text-secondary)' }}>
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
      className="flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-2 py-[6px] text-left text-[length:var(--text-md)]"
      style={{ color: 'var(--color-text-tertiary)' }}
    >
      <span style={{ width: 14, textAlign: 'center' }}>+</span>
      {label}
    </button>
  )
}

/**
 * Inline start/end editor.
 *
 * A meeting created at the wrong time used to be unfixable: the title was
 * editable and nothing else was.
 */
function TimeEditor({
  startAt,
  endAt,
  onSave,
  onCancel,
}: {
  startAt: string
  endAt: string
  onSave: (startAt: string, endAt: string) => void
  onCancel: () => void
}) {
  const toLocal = (iso: string) => {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  const [start, setStart] = useState(() => toLocal(startAt))
  const [end, setEnd] = useState(() => toLocal(endAt))
  const invalid = new Date(end) <= new Date(start)

  return (
    <div
      className="mb-6 flex flex-wrap items-end gap-2 p-3"
      style={{ borderRadius: 'var(--radius-card)', border: '1px solid var(--color-hairline)' }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-[length:var(--text-sm)]" style={{ color: 'var(--color-text-secondary)' }}>
          Starts
        </span>
        <input
          type="datetime-local"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          aria-label="Meeting start"
          className="px-2 py-[6px] text-[length:var(--text-sm)] outline-none"
          style={{ borderRadius: 'var(--radius-row)', border: '1px solid var(--color-hairline)' }}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[length:var(--text-sm)]" style={{ color: 'var(--color-text-secondary)' }}>
          Ends
        </span>
        <input
          type="datetime-local"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          aria-label="Meeting end"
          className="px-2 py-[6px] text-[length:var(--text-sm)] outline-none"
          style={{ borderRadius: 'var(--radius-row)', border: '1px solid var(--color-hairline)' }}
        />
      </label>
      <button
        type="button"
        disabled={invalid}
        onClick={() => onSave(start, end)}
        className="cursor-pointer px-3 py-[7px] text-[length:var(--text-sm)] font-medium text-white"
        style={{
          borderRadius: 'var(--radius-row)',
          border: 0,
          background: 'var(--color-accent)',
          opacity: invalid ? 0.5 : 1,
        }}
      >
        Save
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="cursor-pointer border-0 bg-transparent px-2 py-[7px] text-[length:var(--text-sm)]"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        Cancel
      </button>
      {invalid && (
        <span className="text-[length:var(--text-sm)]" style={{ color: 'var(--color-due)' }}>
          The end must be after the start.
        </span>
      )}
    </div>
  )
}
