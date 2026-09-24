import Link from 'next/link'
import { headers } from 'next/headers'
import { requireIdentity } from '@/lib/auth'
import { listMeetings, meetingDateBounds } from '@/lib/queries'
import { Suspense } from 'react'
import { ScrollToToday } from '@/components/meetings/ScrollToToday'
import { SkeletonLine, SkeletonRow } from '@/components/ui/Skeleton'
import { AutoLoadMore } from '@/components/meetings/AutoLoadMore'
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

/**
 * Weeks either side of today loaded per step.
 *
 * Three months was 1055 meetings, a 448KB response and nearly two seconds
 * before the page appeared. The archive is a scrolling list: almost nobody
 * reads all of it, so load a month and let the reader ask for more.
 */
const STEP_WEEKS = 2

/**
 * Shell first, list streamed.
 *
 * NOT a route-level `loading.tsx`: that boundary would cover /meetings/[id]
 * too, and streaming commits HTTP 200 before the child can call notFound(),
 * which turned another user's meeting from a 404 into a 200. Caught by the
 * per-user isolation test, which is exactly what it is there for.
 */
export default async function MeetingsArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ back?: string; fwd?: string }>
}) {
  return (
    <div className="mx-auto w-full" style={{ maxWidth: 'var(--note-max-width)', padding: 32 }}>
      <h1 className="mb-1 text-[length:var(--text-3xl)] font-semibold">Meetings</h1>
      <Suspense fallback={<ArchiveSkeleton />}>
        <Archive searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

function ArchiveSkeleton() {
  return (
    <div>
      <span role="status" aria-live="polite" className="sr-only">
        Loading meetings
      </span>
      <SkeletonLine width={240} height={13} className="mt-3" />
      {Array.from({ length: 3 }, (_, group) => (
        <div key={group} className="mt-7">
          <SkeletonLine width={120} height={14} className="mb-2" />
          {Array.from({ length: 3 }, (_, i) => (
            <SkeletonRow key={i} avatar={false} />
          ))}
        </div>
      ))}
    </div>
  )
}

async function Archive({
  searchParams,
}: {
  searchParams: Promise<{ back?: string; fwd?: string }>
}) {
  const identity = await requireIdentity(await headers())
  const sp = await searchParams

  // How many steps have been expanded in each direction. Clamped: these are
  // URL parameters, so a hand-edited ?back=9999 must not ask for everything.
  const clampSteps = (raw: string | undefined) => {
    const n = Number.parseInt(raw ?? '1', 10)
    return Number.isFinite(n) ? Math.min(Math.max(n, 1), 26) : 1
  }
  const backSteps = clampSteps(sp.back)
  const fwdSteps = clampSteps(sp.fwd)

  const from = new Date()
  from.setDate(from.getDate() - backSteps * STEP_WEEKS * 7)
  from.setHours(0, 0, 0, 0)
  const to = new Date()
  to.setDate(to.getDate() + fwdSteps * STEP_WEEKS * 7)
  to.setHours(23, 59, 59, 999)

  const meetings = await listMeetings(identity.email, {
    from: from.toISOString(),
    to: to.toISOString(),
  })

  // Where the data actually ends. Without this the sentinels would keep
  // firing forever against empty months, re-fetching nothing.
  const bounds = await meetingDateBounds(identity.email)
  const atHistoryLimit = !bounds.earliest || new Date(bounds.earliest) >= from
  const atFutureLimit = !bounds.latest || new Date(bounds.latest) <= to

  // Grouped by calendar day, ascending - the Swift archive did the same, then
  // auto-scrolled to today on appear.
  const groups = new Map<string, typeof meetings>()
  for (const meeting of meetings) {
    const key = new Date(meeting.startAt).toDateString()
    groups.set(key, [...(groups.get(key) ?? []), meeting])
  }

  return (
    <>
      <p
        className="mb-6 text-[length:var(--text-base)]"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} to{' '}
        {to.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}. Load more at
        either end.
      </p>
      <ScrollToToday />

      {/* Scrolling to the top loads older meetings; the link is the keyboard
          and no-JS path to the same thing. */}
      <AutoLoadMore
        href={`/meetings?back=${backSteps + 1}&fwd=${fwdSteps}`}
        direction="up"
        disabled={atHistoryLimit}
      />
      <div className="mb-4">
        {atHistoryLimit ? (
          <span
            className="text-[length:var(--text-sm)]"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            Start of the imported history.
          </span>
        ) : (
          <Link
            href={`/meetings?back=${backSteps + 1}&fwd=${fwdSteps}`}
            className="text-[length:var(--text-sm)] no-underline"
            style={{ color: 'var(--color-accent)' }}
            scroll={false}
          >
            ↑ Load {STEP_WEEKS} more weeks of history
          </Link>
        )}
      </div>

      {groups.size === 0 ? (
        <div className="py-16 text-center">
          <p className="text-[length:var(--text-lg)] font-medium">No meetings yet</p>
          <p className="mt-1 text-[length:var(--text-base)]" style={{ color: 'var(--color-text-secondary)' }}>
            Connect your calendar in Settings, or create one from the Calendar tab.
          </p>
        </div>
      ) : (
        [...groups.entries()].map(([key, dayMeetings]) => {
          const label = dayLabel(new Date(key))
          return (
            <section key={key} id={label.isToday ? 'today' : undefined} className="mb-6">
              <h2
                className="mb-1 px-2 text-[length:var(--text-base)] font-semibold"
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
                        <span className="block truncate text-[length:var(--text-md)]">{meeting.title}</span>
                        <span className="text-[length:var(--text-sm)]" style={{ color: 'var(--color-text-secondary)' }}>
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

      {groups.size > 0 && (
        <div className="mt-2 pb-8">
          {atFutureLimit ? (
            <span
              className="text-[length:var(--text-sm)]"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              End of the imported range.
            </span>
          ) : (
            <Link
              href={`/meetings?back=${backSteps}&fwd=${fwdSteps + 1}`}
              className="text-[length:var(--text-sm)] no-underline"
              style={{ color: 'var(--color-accent)' }}
              scroll={false}
            >
              ↓ Load {STEP_WEEKS} more weeks ahead
            </Link>
          )}
          <AutoLoadMore
            href={`/meetings?back=${backSteps}&fwd=${fwdSteps + 1}`}
            direction="down"
            disabled={atFutureLimit}
          />
        </div>
      )}
    </>
  )
}
