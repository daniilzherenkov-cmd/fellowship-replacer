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
 * Read-only is deliberate for v1. The write scope (calendar.events) triggers a
 * heavier Workspace-admin review, and nothing in v1 creates or edits events.
 * Widen only when the product actually needs it.
 */
export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'

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
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
  })
  return res.ok
}
