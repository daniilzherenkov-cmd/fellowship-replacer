import { headers } from 'next/headers'
import { requireIdentity } from '@/lib/auth'
import { googleConfigured } from '@/lib/google-oauth'
import { getConnection } from '@/lib/google-store'
import { CalendarConnection } from '@/components/settings/CalendarConnection'
import { IcsConnection } from '@/components/settings/IcsConnection'
import { ReminderSettings } from '@/components/settings/ReminderSettings'
import { getIcsConnection } from '@/lib/ics-store'

export const dynamic = 'force-dynamic'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string; reason?: string }>
}) {
  const identity = await requireIdentity(await headers())
  const params = await searchParams

  const configured = googleConfigured()
  const [connection, ics] = await Promise.all([
    configured ? getConnection(identity.email) : Promise.resolve(null),
    getIcsConnection(identity.email),
  ])

  return (
    <div className="mx-auto w-full" style={{ maxWidth: 'var(--note-max-width)', padding: 32 }}>
      <h1 className="mb-6 text-[length:var(--text-3xl)] font-semibold">Settings</h1>

      <CalendarConnection
        configured={configured}
        connected={!!connection}
        googleEmail={connection?.googleEmail ?? null}
        lastSyncAt={connection?.lastSyncAt ?? null}
        lastSyncError={connection?.lastSyncError ?? null}
        status={params.google ?? null}
        reason={params.reason ?? null}
      />

      <IcsConnection
        connected={ics.connected}
        maskedUrl={ics.maskedUrl}
        lastSyncAt={ics.lastSyncAt}
      />

      <div className="mt-6">
        <ReminderSettings vapidPublicKey={process.env.VAPID_PUBLIC_KEY ?? ''} />
      </div>

      <section className="mt-8">
        <h2 className="mb-1 text-[length:var(--text-xl)] font-semibold">Account</h2>
        <p className="text-[length:var(--text-base)]" style={{ color: 'var(--color-text-secondary)' }}>
          Signed in as {identity.email} via Delivery Hero single sign-on.
        </p>
      </section>
    </div>
  )
}
