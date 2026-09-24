import Link from 'next/link'
import { Suspense } from 'react'
import { headers } from 'next/headers'
import { requireIdentity } from '@/lib/auth'
import { listPeopleWithStats } from '@/lib/queries'
import { Avatar } from '@/components/ui/Avatar'
import { SkeletonRow, SkeletonLine } from '@/components/ui/Skeleton'

export const dynamic = 'force-dynamic'

/**
 * People, ranked by how much you actually meet them.
 *
 * This used to render `listPeople` alphabetically, which on a real calendar
 * is hundreds of one-off invitees: the page opened on "Abdalla Chair" and the
 * handful of people with regular 1:1s were nowhere near the top. Fellow's
 * People tab is about relationships, not an address book.
 */
/**
 * The heading renders immediately and the list streams in behind a Suspense
 * boundary.
 *
 * NOT a route-level `loading.tsx`: that would create a boundary covering
 * /people/[id] as well, and streaming commits HTTP 200 before the child can
 * call notFound() - which silently turned another user's person page from a
 * 404 into a 200. An in-page boundary gives the same feedback without
 * touching the child route.
 */
export default async function PeoplePage() {
  return (
    <div className="mx-auto w-full" style={{ maxWidth: 'var(--note-max-width)', padding: 32 }}>
      <h1 className="mb-1 text-[length:var(--text-3xl)] font-semibold">People</h1>
      <p className="mb-6 text-[length:var(--text-base)]" style={{ color: 'var(--color-text-secondary)' }}>
        Everyone you meet with, and the history of your 1:1s.
      </p>
      <Suspense fallback={<PeopleSkeleton />}>
        <PeopleList />
      </Suspense>
    </div>
  )
}

function PeopleSkeleton() {
  return (
    <div>
      <span role="status" aria-live="polite" className="sr-only">
        Loading people
      </span>
      <SkeletonLine width={90} height={15} />
      <div className="mt-2">
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    </div>
  )
}

async function PeopleList() {
  const identity = await requireIdentity(await headers())
  const people = await listPeopleWithStats(identity.email)

  const regulars = people.filter((p) => p.oneOnOneCount > 0)
  const others = people.filter((p) => p.oneOnOneCount === 0)

  return (
    <>

      {people.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-[length:var(--text-lg)] font-medium">No people yet</p>
          <p className="mt-1 text-[length:var(--text-base)]" style={{ color: 'var(--color-text-secondary)' }}>
            Connect your calendar in Settings, and the people you meet with appear here.
          </p>
        </div>
      ) : (
        <>
          {regulars.length > 0 && <PeopleSection title="Your 1:1s" people={regulars} />}
          {others.length > 0 && (
            <PeopleSection
              title="Everyone else"
              subtitle="People from group meetings, most recent first."
              people={others}
            />
          )}
        </>
      )}
    </>
  )
}

function PeopleSection({
  title,
  subtitle,
  people,
}: {
  title: string
  subtitle?: string
  people: Awaited<ReturnType<typeof listPeopleWithStats>>
}) {
  return (
    <section className="mb-8">
      <h2 className="m-0 text-[length:var(--text-lg)] font-semibold">{title}</h2>
      {subtitle && (
        <p
          className="mb-2 mt-[2px] text-[length:var(--text-sm)]"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {subtitle}
        </p>
      )}
      <ul className="m-0 mt-2 list-none p-0">
        {people.map((person) => (
          <li key={person.id}>
            <Link
              href={`/people/${person.id}`}
              className="flex items-center gap-3 px-2 py-2 no-underline"
              style={{ borderRadius: 'var(--radius-row)', color: 'inherit' }}
            >
              <Avatar name={person.name} colorHex={person.colorHex} size={30} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[length:var(--text-md)] font-medium">
                  {person.name}
                </span>
                {person.email && (
                  <span
                    className="block truncate text-[length:var(--text-sm)]"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {person.email}
                  </span>
                )}
              </span>
              <span
                className="shrink-0 text-right text-[length:var(--text-xs)]"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                {person.oneOnOneCount > 0 && (
                  <span className="block">
                    {person.oneOnOneCount} 1:1{person.oneOnOneCount === 1 ? '' : 's'}
                  </span>
                )}
                {person.lastMetAt && (
                  <span className="block">
                    {new Date(person.lastMetAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
