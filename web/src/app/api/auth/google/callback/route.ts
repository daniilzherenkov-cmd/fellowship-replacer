/**
 * Step 2 of the OAuth handshake: Google redirects here with an authorization
 * code, which is exchanged for tokens.
 *
 * Security notes:
 *  - `state` is verified against a stored single-use row. This is the CSRF
 *    defence: without it an attacker could trick a signed-in user into
 *    attaching the ATTACKER's Google account to the user's Fellow 2 data.
 *  - The state row also carries the owner email, and the callback checks it
 *    matches the currently authenticated user. A code obtained in one session
 *    cannot be redeemed into another user's account.
 */

import { requireIdentity } from '@/lib/auth'
import { oauthConfig, exchangeCode } from '@/lib/google-oauth'
import { consumeOAuthState, saveConnection } from '@/lib/google-store'
import { safeEqual } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

function redirectToSettings(request: Request, params: Record<string, string>) {
  const url = new URL('/settings', new URL(request.url).origin)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return Response.redirect(url.toString(), 302)
}

export async function GET(request: Request) {
  let identity
  try {
    identity = await requireIdentity(request.headers)
  } catch {
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  // The user pressed Cancel on the consent screen.
  if (error) {
    return redirectToSettings(request, { google: 'denied', reason: error })
  }
  if (!code || !state) {
    return redirectToSettings(request, { google: 'error', reason: 'missing_code_or_state' })
  }

  const config = oauthConfig()
  if (!config) {
    return redirectToSettings(request, { google: 'error', reason: 'not_configured' })
  }

  const stored = await consumeOAuthState(state)
  if (!stored) {
    // Unknown, expired, or already-used state.
    return redirectToSettings(request, { google: 'error', reason: 'invalid_state' })
  }
  if (!safeEqual(stored.ownerEmail, identity.email)) {
    // The handshake was started by a different user than the one finishing it.
    return redirectToSettings(request, { google: 'error', reason: 'identity_mismatch' })
  }

  try {
    const tokens = await exchangeCode({ config, code, verifier: stored.verifier })

    if (!tokens.refreshToken) {
      // Google withholds the refresh token when the user has already granted
      // consent and prompt=consent was not honoured. Without it there is no
      // durable connection, so treat it as a failure rather than storing a
      // token that dies in an hour.
      return redirectToSettings(request, { google: 'error', reason: 'no_refresh_token' })
    }

    await saveConnection({
      ownerEmail: identity.email,
      refreshToken: tokens.refreshToken,
      googleEmail: identity.email,
      scope: tokens.scope,
    })

    return redirectToSettings(request, { google: 'connected' })
  } catch {
    // Never surface the raw error: it can contain the client secret or code.
    return redirectToSettings(request, { google: 'error', reason: 'exchange_failed' })
  }
}
