import { headers } from 'next/headers'
import { identityFrom } from '@/lib/auth'
import { TopBar } from '@/components/shell/TopBar'
import { IconRail } from '@/components/shell/IconRail'

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
          <h1 className="mb-2 text-[17px] font-semibold">Not signed in</h1>
          <p className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
            Fellow 2 identifies you through Delivery Hero single sign-on. Open the app
            from its <code>dhapps.ai</code> address so that sign-in can complete.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar userEmail={identity.email} />
      <div className="flex min-h-0 flex-1">
        <IconRail />
        <main className="min-w-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
