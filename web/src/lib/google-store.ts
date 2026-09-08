/**
 * Persistence for the Google Calendar connection.
 *
 * Every function takes ownerEmail and scopes on it. There is no "get any
 * connection" helper on purpose: on Protoship the app is reachable by every DH
 * account, so an unscoped query is a data leak waiting to happen.
 */

import { getDb } from './db'
import { encrypt, decrypt } from './crypto'
import {
  oauthConfig,
  refreshAccessToken,
  revokeToken,
  isPermanentAuthFailure,
} from './google-oauth'

export interface GoogleConnection {
  ownerEmail: string
  googleEmail: string | null
  scope: string | null
  syncToken: string | null
  lastSyncAt: string | null
  lastSyncError: string | null
}

interface ConnectionRow {
  owner_email: string
  refresh_token_cipher: string
  google_email: string | null
  scope: string | null
  sync_token: string | null
  last_sync_at: string | null
  last_sync_error: string | null
}

const now = () => new Date().toISOString()

/** Connection metadata. Never returns the refresh token. */
export async function getConnection(ownerEmail: string): Promise<GoogleConnection | null> {
  const db = await getDb()
  const rows = await db.query<ConnectionRow>(
    'SELECT * FROM google_connection WHERE owner_email = ?',
    [ownerEmail],
  )
  const row = rows[0]
  if (!row) return null
  return {
    ownerEmail: row.owner_email,
    googleEmail: row.google_email,
    scope: row.scope,
    syncToken: row.sync_token,
    lastSyncAt: row.last_sync_at,
    lastSyncError: row.last_sync_error,
  }
}

export async function saveConnection(params: {
  ownerEmail: string
  refreshToken: string
  googleEmail?: string | null
  scope?: string | null
}): Promise<void> {
  const db = await getDb()
  const cipher = encrypt(params.refreshToken)
  const ts = now()

  // No ON DUPLICATE KEY / UPSERT: the syntax differs between MySQL and SQLite,
  // and lib/db.ts deliberately keeps to their common subset.
  const existing = await db.query('SELECT owner_email FROM google_connection WHERE owner_email = ?', [
    params.ownerEmail,
  ])
  if (existing.length) {
    await db.exec(
      `UPDATE google_connection
          SET refresh_token_cipher = ?, google_email = ?, scope = ?,
              sync_token = NULL, last_sync_error = NULL, updated_at = ?
        WHERE owner_email = ?`,
      [cipher, params.googleEmail ?? null, params.scope ?? null, ts, params.ownerEmail],
    )
  } else {
    await db.exec(
      `INSERT INTO google_connection
         (owner_email, refresh_token_cipher, google_email, scope, sync_token,
          last_sync_at, last_sync_error, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, ?)`,
      [params.ownerEmail, cipher, params.googleEmail ?? null, params.scope ?? null, ts, ts],
    )
  }
}

export async function updateSyncState(params: {
  ownerEmail: string
  syncToken?: string | null
  error?: string | null
}): Promise<void> {
  const db = await getDb()
  await db.exec(
    `UPDATE google_connection
        SET sync_token = ?, last_sync_at = ?, last_sync_error = ?, updated_at = ?
      WHERE owner_email = ?`,
    [
      params.syncToken ?? null,
      now(),
      params.error ?? null,
      now(),
      params.ownerEmail,
    ],
  )
}

/**
 * Disconnect. Revokes at Google first so access actually ends - deleting only
 * the local row would leave a live grant the user believes they removed.
 */
export async function disconnect(ownerEmail: string): Promise<void> {
  const db = await getDb()
  const rows = await db.query<ConnectionRow>(
    'SELECT refresh_token_cipher FROM google_connection WHERE owner_email = ?',
    [ownerEmail],
  )
  const cipher = rows[0]?.refresh_token_cipher
  if (cipher) {
    const token = decrypt(cipher)
    // Best effort: if revocation fails we still drop the local row, otherwise
    // the user is stuck "connected" with no way out.
    if (token) await revokeToken(token).catch(() => false)
  }
  await db.exec('DELETE FROM google_connection WHERE owner_email = ?', [ownerEmail])
}

/**
 * A usable access token, minted from the stored refresh token.
 *
 * Returns null when not connected, or when the grant is permanently dead (user
 * revoked access or changed password) - in which case the connection is
 * dropped so the UI can prompt to reconnect instead of failing forever.
 */
export async function getAccessToken(ownerEmail: string): Promise<string | null> {
  const config = oauthConfig()
  if (!config) return null

  const db = await getDb()
  const rows = await db.query<ConnectionRow>(
    'SELECT refresh_token_cipher FROM google_connection WHERE owner_email = ?',
    [ownerEmail],
  )
  const cipher = rows[0]?.refresh_token_cipher
  if (!cipher) return null

  const refreshToken = decrypt(cipher)
  if (!refreshToken) {
    // Undecryptable: wrong key, or a tampered row. Treat as not connected.
    await updateSyncState({
      ownerEmail,
      error: 'Stored credential could not be decrypted. Please reconnect.',
    })
    return null
  }

  try {
    const tokens = await refreshAccessToken({ config, refreshToken })
    return tokens.accessToken
  } catch (err) {
    if (isPermanentAuthFailure(err)) {
      await db.exec('DELETE FROM google_connection WHERE owner_email = ?', [ownerEmail])
      return null
    }
    throw err
  }
}

/* ------------------------------------------------------------------ *
 * OAuth handshake state (CSRF + PKCE), single-use and short-lived.
 * ------------------------------------------------------------------ */

const STATE_TTL_MS = 10 * 60 * 1000

export async function saveOAuthState(params: {
  state: string
  ownerEmail: string
  verifier: string
}): Promise<void> {
  const db = await getDb()
  const ts = now()
  // Sweep expired rows on write; the table stays tiny and needs no cron.
  await db.exec('DELETE FROM oauth_state WHERE expires_at < ?', [ts])
  await db.exec(
    `INSERT INTO oauth_state (state, owner_email, verifier, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [
      params.state,
      params.ownerEmail,
      params.verifier,
      ts,
      new Date(Date.now() + STATE_TTL_MS).toISOString(),
    ],
  )
}

/** Consume a state token. Single-use: deleted whether or not it was valid. */
export async function consumeOAuthState(
  state: string,
): Promise<{ ownerEmail: string; verifier: string } | null> {
  const db = await getDb()
  const rows = await db.query<{
    owner_email: string
    verifier: string
    expires_at: string
  }>('SELECT owner_email, verifier, expires_at FROM oauth_state WHERE state = ?', [state])

  await db.exec('DELETE FROM oauth_state WHERE state = ?', [state])

  const row = rows[0]
  if (!row) return null
  if (row.expires_at < now()) return null
  return { ownerEmail: row.owner_email, verifier: row.verifier }
}
