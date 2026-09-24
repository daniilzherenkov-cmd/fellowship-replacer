/**
 * Google OAuth 2.0 for a server-side web app.
 *
 * IMPORTANT - this needs a **Web application** OAuth client, NOT the iOS-type
 * client described in docs/07 and requested in the RFC. That one was for the
 * native Mac app: it keys on a bundle id with a reversed-client-id URL scheme
 * and has no client secret. A web app needs a client id + secret and a
 * registered HTTPS redirect URI. See docs/12 for the exact ask.
 *
 * Flow (authorization code + PKCE):
 *   1. /api/auth/google/start     -> redirect to Google's consent screen
 *   2. user consents in Google
 *   3. /api/auth/google/callback  -> exchange code for tokens
 *   4. refresh token is encrypted and stored; access tokens are short-lived
 *      and re-minted on demand, never persisted.
 *
 * PKCE is not strictly required for a confidential client, but it costs
 * nothing and closes code-interception if the secret is ever exposed.
 */

import { createHash } from 'node:crypto'
import { randomToken } from './crypto'

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke'

/**
 * Read AND write, deliberately.
 *
 * v1 only reads, so `calendar.readonly` would cover it today. We ask for
 * `calendar.events` anyway because the scope is fixed when the OAuth client is
 * created by the Cloud admins, and widening it later means going back through
 * that request: the cost of asking now is one line, the cost of asking later is
 * another round trip through a team that does not own this app.
 *
 * Fellow (the tool this replaces) creates events and Meet links, so a faithful
 * clone needs write eventually. `calendar.events` grants access to events only,
 * NOT to calendar settings, ACLs, or calendar creation - it is the narrowest
 * scope that covers both directions.
 *
 * Note this changes the consent screen: users will be told the app can "view and
 * edit events on all your calendars" rather than view-only. That is the honest
 * description of what we are asking for.
 */
/**
 * Every call to Google gets a deadline.
 *
 * WHY: none of them had one. A hung request left the server action awaiting
 * forever, and the create-event dialog sat on "Saving…" with no error and no
 * way out - the exact failure Danya hit. fetch has no default timeout, so an
 * unresponsive upstream becomes an unresponsive app.
 */
const GOOGLE_TIMEOUT_MS = 15_000

export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'

export interface OAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

/** Config from env, or null when not yet provisioned. */
export function oauthConfig(): OAuthConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) return null
  return { clientId, clientSecret, redirectUri }
}

/** Whether Google Calendar can be connected at all in this deployment. */
export function googleConfigured(): boolean {
  return oauthConfig() !== null
}

/**
 * The origin to send the browser back to after the handshake.
 *
 * WHY NOT `new URL(request.url).origin`: inside the pod that resolves to the
 * internal Kubernetes service address, e.g.
 * `http://dh-ets-ei-protoship-backend-...-dhfff:8080`. Redirecting there hands
 * the browser a hostname that does not resolve, so a SUCCESSFUL connect ended
 * on DNS_PROBE_FINISHED_NXDOMAIN with `?google=connected` in the bar.
 *
 * `GOOGLE_REDIRECT_URI` is public by definition, since Google just redirected
 * the browser to it, and it is already required for the handshake. Falls back
 * to the request origin so local dev and tests keep working.
 */
export function publicOrigin(requestUrl: string): string {
  const configured = process.env.GOOGLE_REDIRECT_URI
  if (configured) {
    try {
      return new URL(configured).origin
    } catch {
      // Malformed config should not break the redirect entirely.
    }
  }
  return new URL(requestUrl).origin
}

export interface PkcePair {
  verifier: string
  challenge: string
}

export function createPkce(): PkcePair {
  const verifier = randomToken(32)
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

/**
 * Build the consent URL.
 *
 * `access_type=offline` + `prompt=consent` is what actually returns a refresh
 * token. Google omits it on repeat authorisations unless prompted, which is a
 * classic silent failure: the first connect works, a reconnect yields no
 * refresh token, and sync dies when the access token expires an hour later.
 */
export function buildAuthUrl(params: {
  config: OAuthConfig
  state: string
  challenge: string
  loginHint?: string
}): string {
  const { config, state, challenge, loginHint } = params
  const url = new URL(AUTH_ENDPOINT)
  url.searchParams.set('client_id', config.clientId)
  url.searchParams.set('redirect_uri', config.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', CALENDAR_SCOPE)
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('include_granted_scopes', 'true')
  // Pre-fills the DH account, so the user is not asked which account to use.
  if (loginHint) url.searchParams.set('login_hint', loginHint)
  return url.toString()
}

export interface TokenResponse {
  accessToken: string
  refreshToken: string | null
  expiresAt: string
  scope: string
}

interface RawTokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  error?: string
  error_description?: string
}

function parseTokens(raw: RawTokenResponse): TokenResponse {
  if (raw.error) {
    throw new Error(`Google token error: ${raw.error} ${raw.error_description ?? ''}`.trim())
  }
  if (!raw.access_token) throw new Error('Google returned no access token')
  const expiresIn = raw.expires_in ?? 3600
  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token ?? null,
    // 60s of slack so a token is never used in its final moments.
    expiresAt: new Date(Date.now() + (expiresIn - 60) * 1000).toISOString(),
    scope: raw.scope ?? CALENDAR_SCOPE,
  }
}

/** Exchange an authorization code for tokens. */
export async function exchangeCode(params: {
  config: OAuthConfig
  code: string
  verifier: string
}): Promise<TokenResponse> {
  const { config, code, verifier } = params
  const res = await fetch(TOKEN_ENDPOINT, {
    signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  })
  return parseTokens((await res.json()) as RawTokenResponse)
}

/**
 * Mint a fresh access token from a stored refresh token.
 *
 * The response carries no new refresh token - the caller keeps the existing
 * one. If this returns invalid_grant the user revoked access or changed their
 * password, and the connection must be dropped rather than retried.
 */
export async function refreshAccessToken(params: {
  config: OAuthConfig
  refreshToken: string
}): Promise<TokenResponse> {
  const { config, refreshToken } = params
  const res = await fetch(TOKEN_ENDPOINT, {
    signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'refresh_token',
    }),
  })
  const parsed = parseTokens((await res.json()) as RawTokenResponse)
  return { ...parsed, refreshToken }
}

/** True when the error means the grant is permanently dead. */
export function isPermanentAuthFailure(err: unknown): boolean {
  return err instanceof Error && /invalid_grant|invalid_client/.test(err.message)
}

/** Revoke a token, so "Disconnect" actually severs access at Google. */
export async function revokeToken(token: string): Promise<boolean> {
  const res = await fetch(REVOKE_ENDPOINT, {
    signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
  })
  return res.ok
}
