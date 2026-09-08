import Link from 'next/link'
import { headers } from 'next/headers'
import { requireIdentity } from '@/lib/auth'
import { listPeople } from '@/lib/queries'
import { Avatar } from '@/components/ui/Avatar'

export const dynamic = 'force-dynamic'

export default async function PeoplePage() {
  const identity = await requireIdentity(await headers())
  const people = (await listPeople(identity.email)).filter((p) => !p.isMe)

  return (
    <div className="mx-auto w-full" style={{ maxWidth: 'var(--note-max-width)', padding: 32 }}>
      <h1 className="mb-1 text-[22px] font-semibold">People</h1>
      <p className="mb-6 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
        Everyone you meet with, and the history of your 1:1s.
      </p>

      {people.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-[15px] font-medium">No people yet</p>
          <p className="mt-1 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
            Connect your calendar in Settings, and the people you meet with appear here.
          </p>
        </div>
      ) : (
        <ul className="m-0 list-none p-0">
          {people.map((person) => (
            <li key={person.id}>
              <Link
                href={`/people/${person.id}`}
                className="flex items-center gap-3 px-2 py-2 no-underline"
                style={{ borderRadius: 'var(--radius-row)', color: 'inherit' }}
              >
                <Avatar name={person.name} colorHex={person.colorHex} size={30} />
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-medium">{person.name}</span>
                  {person.email && (
                    <span
                      className="block truncate text-[12px]"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {person.email}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
