import Link from 'next/link'
import { headers } from 'next/headers'
import { requireIdentity } from '@/lib/auth'
import { listMeetings } from '@/lib/queries'
import { AvatarStack } from '@/components/ui/Avatar'

export const dynamic = 'force-dynamic'

/** Day header labels, matching DayHeader in MeetingsArchiveView.swift. */
function dayLabel(date: Date, now = new Date()): { text: string; isToday: boolean } {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOf(date) - startOf(now)) / 86_400_000)
  const short = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (days === 0) return { text: `Today · ${short}`, isToday: true }
  if (days === 1) return { text: `Tomorrow · ${short}`, isToday: false }
  if (days === -1) return { text: `Yesterday · ${short}`, isToday: false }
  return {
    text: date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    }),
    isToday: false,
  }
}

export default async function MeetingsArchivePage() {
  const identity = await requireIdentity(await headers())
  const meetings = await listMeetings(identity.email, { limit: 500 })

  // Grouped by calendar day, ascending - the Swift archive did the same, then
  // auto-scrolled to today on appear.
  const groups = new Map<string, typeof meetings>()
  for (const meeting of meetings) {
    const key = new Date(meeting.startAt).toDateString()
    groups.set(key, [...(groups.get(key) ?? []), meeting])
  }

  return (
    <div className="mx-auto w-full" style={{ maxWidth: 'var(--note-max-width)', padding: 32 }}>
      <h1 className="mb-6 text-[22px] font-semibold">Meetings</h1>

      {groups.size === 0 ? (
        <div className="py-16 text-center">
          <p className="text-[15px] font-medium">No meetings yet</p>
          <p className="mt-1 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
            Connect your calendar in Settings, or create one from the Calendar tab.
          </p>
        </div>
      ) : (
        [...groups.entries()].map(([key, dayMeetings]) => {
          const label = dayLabel(new Date(key))
          return (
            <section key={key} id={label.isToday ? 'today' : undefined} className="mb-6">
              <h2
                className="mb-1 px-2 text-[13px] font-semibold"
                style={{ color: label.isToday ? 'var(--color-accent)' : undefined }}
              >
                {label.text}
              </h2>
              <ul className="m-0 list-none p-0">
                {dayMeetings.map((meeting) => (
                  <li key={meeting.id}>
                    <Link
                      href={`/meetings/${meeting.id}`}
                      className="flex items-center gap-3 px-2 py-2 no-underline"
                      style={{ borderRadius: 'var(--radius-row)', color: 'inherit' }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          flexShrink: 0,
                          background:
                            meeting.kind === 'oneOnOne'
                              ? 'var(--color-accent)'
                              : 'var(--color-text-tertiary)',
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px]">{meeting.title}</span>
                        <span className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
                          {new Date(meeting.startAt).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                      </span>
                      {meeting.attendees.length > 0 && (
                        <AvatarStack people={meeting.attendees} size={20} max={3} />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )
        })
      )}
    </div>
  )
}
