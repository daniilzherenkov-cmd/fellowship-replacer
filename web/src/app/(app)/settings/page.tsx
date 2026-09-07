import { headers } from 'next/headers'
import { requireIdentity } from '@/lib/auth'
import { googleConfigured } from '@/lib/google-oauth'
import { getConnection } from '@/lib/google-store'
import { CalendarConnection } from '@/components/settings/CalendarConnection'

export const dynamic = 'force-dynamic'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string; reason?: string }>
}) {
  const identity = await requireIdentity(await headers())
  const params = await searchParams

  const configured = googleConfigured()
  const connection = configured ? await getConnection(identity.email) : null

  return (
    <div className="mx-auto w-full" style={{ maxWidth: 'var(--note-max-width)', padding: 32 }}>
      <h1 className="mb-6 text-[22px] font-semibold">Settings</h1>

      <CalendarConnection
        configured={configured}
        connected={!!connection}
        googleEmail={connection?.googleEmail ?? null}
        lastSyncAt={connection?.lastSyncAt ?? null}
        lastSyncError={connection?.lastSyncError ?? null}
        status={params.google ?? null}
        reason={params.reason ?? null}
      />

      <section className="mt-8">
        <h2 className="mb-1 text-[16px] font-semibold">Account</h2>
        <p className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
          Signed in as {identity.email} via Delivery Hero single sign-on.
        </p>
      </section>
    </div>
  )
}
