import { headers } from 'next/headers'
import { identityFrom } from '@/lib/auth'
import { TopBar } from '@/components/shell/TopBar'
import { IconRail } from '@/components/shell/IconRail'
import { UpcomingBanner } from '@/components/shell/UpcomingBanner'
import { FirstRunPush } from '@/components/shell/FirstRunPush'
import { listMeetings } from '@/lib/queries'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const identity = await identityFrom(await headers())

  // Not authenticated. In production Cloudflare Access means this is
  // unreachable, but it must fail closed rather than render someone's data
  // when the header is missing for any reason.
  if (!identity) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div style={{ maxWidth: 420 }}>
          <h1 className="mb-2 text-[length:var(--text-2xl)] font-semibold">Not signed in</h1>
          <p className="text-[length:var(--text-base)]" style={{ color: 'var(--color-text-secondary)' }}>
            Fellow Hero identifies you through Delivery Hero single sign-on. Open the app
            from its <code>dhapps.ai</code> address so that sign-in can complete.
          </p>
        </div>
      </div>
    )
  }

  // Just today's meetings, for the upcoming-meeting bar. Narrow window so the
  // shell stays cheap on every page. Fails soft: the bar is a nicety and must
  // never be the reason a page 500s.
  let today: { id: string; title: string; startAt: string }[] = []
  try {
    const from = new Date()
    const to = new Date()
    to.setHours(23, 59, 59, 999)
    today = (
      await listMeetings(identity.email, {
        from: from.toISOString(),
        to: to.toISOString(),
      })
    ).map((m) => ({ id: m.id, title: m.title, startAt: m.startAt }))
  } catch {
    today = []
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar userEmail={identity.email} />
      <UpcomingBanner meetings={today} />
      {/* Asks about reminders once, on a first visit, through our own dialog
          before the browser's permission prompt. */}
      <FirstRunPush vapidPublicKey={process.env.VAPID_PUBLIC_KEY ?? ''} />
      <div className="flex min-h-0 flex-1">
        <IconRail />
        <main className="min-w-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
