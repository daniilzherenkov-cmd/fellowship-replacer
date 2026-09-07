/**
 * Step 1 of the OAuth handshake: redirect the user to Google's consent screen.
 *
 * Requires an authenticated caller. The Cloudflare Access identity is what
 * binds the resulting Google grant to a specific DH user - without it, anyone
 * reaching this app could attach their calendar to someone else's account.
 */

import { requireIdentity } from '@/lib/auth'
import { oauthConfig, buildAuthUrl, createPkce } from '@/lib/google-oauth'
import { saveOAuthState } from '@/lib/google-store'
import { randomToken } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  let identity
  try {
    identity = await requireIdentity(request.headers)
  } catch {
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const config = oauthConfig()
  if (!config) {
    // Not yet provisioned. A clear message beats a broken redirect - this is
    // the expected state until the Web OAuth client arrives (see docs/12).
    return Response.json(
      {
        error: 'google_not_configured',
        message:
          'Google Calendar is not set up in this deployment yet. ' +
          'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI must be set.',
      },
      { status: 503 },
    )
  }

  const state = randomToken(32)
  const { verifier, challenge } = createPkce()
  await saveOAuthState({ state, ownerEmail: identity.email, verifier })

  const url = buildAuthUrl({
    config,
    state,
    challenge,
    // Pre-select the DH account so the user is not asked to choose.
    loginHint: identity.email,
  })

  return Response.redirect(url, 302)
}
