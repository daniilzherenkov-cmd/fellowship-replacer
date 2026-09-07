import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { requireIdentity } from '@/lib/auth'
import { getPersonStream } from '@/lib/queries'
import { Avatar } from '@/components/ui/Avatar'
import { DueDatePill } from '@/components/ui/DueDatePill'

export const dynamic = 'force-dynamic'

/**
 * Per-person 1:1 stream - must-have #1, and docs/02 calls it "the key
 * differentiator". History is derived from attendance, the same way
 * PersonStreamView.swift did it.
 */
export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const identity = await requireIdentity(await headers())
  const stream = await getPersonStream(identity.email, id)
  if (!stream) notFound()

  const { person, meetings, openItems } = stream

  return (
    <div className="mx-auto w-full" style={{ maxWidth: 'var(--note-max-width)', padding: 32 }}>
      <div className="mb-6 flex items-center gap-4">
        <Avatar name={person.name} colorHex={person.colorHex} size={56} />
        <div>
          <h1 className="m-0 text-[22px] font-semibold">{person.name}</h1>
          {person.email && (
            <p className="m-0 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
              {person.email}
            </p>
          )}
          {openItems.length > 0 && (
            <p className="m-0 mt-1 text-[13px] font-medium" style={{ color: 'var(--color-accent)' }}>
              {openItems.length} open to-do{openItems.length === 1 ? '' : 's'}
            </p>
          )}
        </div>
      </div>

      {openItems.length > 0 && (
        <section
          className="mb-7 p-3"
          style={{
            borderRadius: 'var(--radius-card)',
            background: 'var(--color-accent-subtle)',
          }}
        >
          <h2 className="m-0 mb-2 text-[13px] font-semibold">Carried forward</h2>
          <ul className="m-0 list-none p-0">
            {openItems.map((item) => (
              <li key={item.id} className="flex items-center gap-2 py-[3px] text-[13px]">
                <span aria-hidden="true" style={{ color: 'var(--color-text-tertiary)' }}>
                  ☐
                </span>
                <span className="min-w-0 flex-1 truncate">{item.text || 'Untitled'}</span>
                {item.dueDate && <DueDatePill date={new Date(item.dueDate)} />}
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 className="mb-2 text-[16px] font-semibold">History</h2>
      {meetings.length === 0 ? (
        <p className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
          No meetings with {person.name} yet.
        </p>
      ) : (
        <ul className="m-0 list-none p-0">
          {meetings.map((meeting) => (
            <li key={meeting.id}>
              <Link
                href={`/meetings/${meeting.id}`}
                className="flex items-baseline gap-3 px-2 py-2 no-underline"
                style={{ borderRadius: 'var(--radius-row)', color: 'inherit' }}
              >
                <span className="min-w-0 flex-1 truncate text-[14px]">{meeting.title}</span>
                <span className="shrink-0 text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
                  {new Date(meeting.startAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
