/**
 * Persistence and sync for the .ics calendar subscription.
 *
 * The secret feed URL is a bearer credential: anyone holding it can read the
 * entire calendar, it never expires, and it is not scoped to this app. So it is
 * encrypted at rest with the same AES-256-GCM helper used for Google refresh
 * tokens, and is NEVER returned to the browser - the settings screen only ever
 * sees a masked form.
 */

import { getDb } from './db'
import { encrypt, decrypt } from './crypto'
import { fetchIcsFeed, parseIcsFeed, maskIcsUrl, IcsFetchError } from './ics'
import { upsertCalendarMeetings } from './sync'

const now = () => new Date().toISOString()

export interface IcsConnection {
  connected: boolean
  /** Safe to render: the secret segment is redacted. */
  maskedUrl: string | null
  lastSyncAt: string | null
}

export async function getIcsConnection(ownerEmail: string): Promise<IcsConnection> {
  const db = await getDb()
  const rows = await db.query<{ ics_url_cipher: string | null; ics_last_sync_at: string | null }>(
    'SELECT ics_url_cipher, ics_last_sync_at FROM user_settings WHERE owner_email = ?',
    [ownerEmail],
  )
  const row = rows[0]
  if (!row?.ics_url_cipher) {
    return { connected: false, maskedUrl: null, lastSyncAt: null }
  }
  const url = decrypt(row.ics_url_cipher)
  return {
    connected: true,
    maskedUrl: url ? maskIcsUrl(url) : 'the saved address',
    lastSyncAt: row.ics_last_sync_at,
  }
}

export async function saveIcsUrl(ownerEmail: string, url: string): Promise<void> {
  const db = await getDb()
  const cipher = encrypt(url.trim())
  const ts = now()
  const existing = await db.query('SELECT owner_email FROM user_settings WHERE owner_email = ?', [
    ownerEmail,
  ])
  if (existing.length) {
    await db.exec(
      'UPDATE user_settings SET ics_url_cipher = ?, updated_at = ? WHERE owner_email = ?',
      [cipher, ts, ownerEmail],
    )
  } else {
    await db.exec(
      `INSERT INTO user_settings (owner_email, ics_url_cipher, ics_last_sync_at, created_at, updated_at)
       VALUES (?, ?, NULL, ?, ?)`,
      [ownerEmail, cipher, ts, ts],
    )
  }
}

export async function removeIcsUrl(ownerEmail: string): Promise<void> {
  const db = await getDb()
  await db.exec(
    'UPDATE user_settings SET ics_url_cipher = NULL, ics_last_sync_at = NULL, updated_at = ? WHERE owner_email = ?',
    [now(), ownerEmail],
  )
}

export interface IcsSyncResult {
  ok: boolean
  created?: number
  updated?: number
  peopleCreated?: number
  totalEvents?: number
  truncated?: boolean
  error?: string
}

/**
 * Fetch the feed and write it in.
 *
 * Window matches the Swift app's +/-3 months, which is what Milena was told the
 * app imports.
 */
export async function syncIcsCalendar(
  ownerEmail: string,
  overrideUrl?: string,
): Promise<IcsSyncResult> {
  let url = overrideUrl?.trim()

  if (!url) {
    const db = await getDb()
    const rows = await db.query<{ ics_url_cipher: string | null }>(
      'SELECT ics_url_cipher FROM user_settings WHERE owner_email = ?',
      [ownerEmail],
    )
    const cipher = rows[0]?.ics_url_cipher
    if (!cipher) return { ok: false, error: 'not_connected' }
    const decrypted = decrypt(cipher)
    if (!decrypted) {
      // Wrong key or a tampered row - treat as disconnected rather than crash.
      return { ok: false, error: 'decrypt_failed' }
    }
    url = decrypted
  }

  const from = new Date()
  from.setMonth(from.getMonth() - 3)
  const to = new Date()
  to.setMonth(to.getMonth() + 3)

  try {
    const body = await fetchIcsFeed(url)
    const parsed = await parseIcsFeed(body, { from, to, selfEmail: ownerEmail })
    const written = await upsertCalendarMeetings(ownerEmail, parsed.meetings)

    const db = await getDb()
    await db.exec(
      'UPDATE user_settings SET ics_last_sync_at = ?, updated_at = ? WHERE owner_email = ?',
      [now(), now(), ownerEmail],
    )

    return {
      ok: true,
      created: written.created,
      updated: written.updated,
      peopleCreated: written.peopleCreated,
      totalEvents: parsed.totalEvents,
      truncated: parsed.truncated,
    }
  } catch (err) {
    if (err instanceof IcsFetchError) return { ok: false, error: err.message }
    return { ok: false, error: 'Could not import that calendar.' }
  }
}
