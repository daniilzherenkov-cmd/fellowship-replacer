/**
 * The claim/release contract for push reminders, against a real database.
 *
 * This is the piece that decides whether a reminder is delivered exactly
 * once, lost forever, or sent twice. All three are silent failures in
 * production, so the rules are pinned down here rather than reasoned about.
 */

import { test, expect } from '@playwright/test'
import mysql from 'mysql2/promise'

const conn = () =>
  mysql.createConnection({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    database: process.env.APP_ID ?? 'fellow_dev',
    user: `app_${process.env.APP_ID ?? 'fellow_dev'}`,
    password: process.env.DB_PASSWORD ?? 'fellowdev',
  })

const MEETING = 'claim-test-meeting'
const OWNER = 'claim-test@deliveryhero.com'

test.beforeEach(async () => {
  const db = await conn()
  await db.query('DELETE FROM reminder_sent WHERE meeting_id = ?', [MEETING])
  await db.end()
})

test.afterAll(async () => {
  const db = await conn()
  await db.query('DELETE FROM reminder_sent WHERE meeting_id = ?', [MEETING])
  await db.end()
})

/** Mirrors claimReminder: the primary key is what makes this safe. */
async function claim(db: mysql.Connection): Promise<boolean> {
  try {
    await db.query(
      'INSERT INTO reminder_sent (meeting_id, owner_email, sent_at) VALUES (?, ?, ?)',
      [MEETING, OWNER, new Date().toISOString()],
    )
    return true
  } catch {
    return false
  }
}

test.describe('reminder claim', () => {
  test('a second claim for the same reminder is refused', async () => {
    // This is what prevents a duplicate notification if the app ever runs
    // more than one replica, or during the overlap of a rolling deploy.
    const db = await conn()
    expect(await claim(db)).toBe(true)
    expect(await claim(db)).toBe(false)
    await db.end()
  })

  test('releasing lets the next tick try again', async () => {
    // Without release, one transient FCM failure marks the reminder sent
    // forever and the notification is lost silently.
    const db = await conn()
    expect(await claim(db)).toBe(true)
    await db.query('DELETE FROM reminder_sent WHERE meeting_id = ? AND owner_email = ?', [
      MEETING,
      OWNER,
    ])
    expect(await claim(db)).toBe(true)
    await db.end()
  })

  test('two owners of the same meeting are claimed independently', async () => {
    // A meeting both people attend is two rows, one per owner. Neither
    // should block the other's reminder.
    const db = await conn()
    expect(await claim(db)).toBe(true)
    await db.query(
      'INSERT INTO reminder_sent (meeting_id, owner_email, sent_at) VALUES (?, ?, ?)',
      [MEETING, 'someone.else@deliveryhero.com', new Date().toISOString()],
    )
    const [rows] = await db.query('SELECT COUNT(*) AS n FROM reminder_sent WHERE meeting_id = ?', [
      MEETING,
    ])
    expect(Number((rows as { n: number }[])[0].n)).toBe(2)
    await db.query('DELETE FROM reminder_sent WHERE meeting_id = ?', [MEETING])
    await db.end()
  })
})
