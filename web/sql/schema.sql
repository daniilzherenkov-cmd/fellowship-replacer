-- Fellow 2 schema.
--
-- Ported from Fellow2/Models.swift, plus the four columns that model was missing
-- despite docs/04 and docs/07 claiming otherwise: id (uuid), owner_email,
-- updated_at, deleted_at. Retrofitting those later is expensive; they cost
-- nothing now.
--
-- owner_email is the authorization boundary. Protoship admits any DH Okta
-- account to the app, so EVERY query must filter on it. There is no other
-- barrier between one manager's 1:1 notes and the rest of Delivery Hero.
--
-- Written in the MySQL 8 / SQLite common subset so the same DDL serves
-- production and the test harness:
--   * TEXT rather than VARCHAR(n)  * ISO-8601 strings for datetimes
--   * INTEGER 0/1 for booleans     * no engine/charset clauses
--
-- Applied to production out-of-band via the execute_sql MCP tool. App code must
-- never run DDL.

CREATE TABLE IF NOT EXISTS person (
  id           TEXT PRIMARY KEY,
  owner_email  TEXT NOT NULL,
  name         TEXT NOT NULL,
  email        TEXT,
  role         TEXT,
  color_hex    TEXT NOT NULL DEFAULT '#2563EB',
  -- Marks the row representing the owner themselves, so "assign to me" can sort
  -- first in the picker (Swift: Person.isMe).
  is_me        INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_person_owner ON person (owner_email, deleted_at);

CREATE TABLE IF NOT EXISTS meeting (
  id           TEXT PRIMARY KEY,
  owner_email  TEXT NOT NULL,
  title        TEXT NOT NULL,
  start_at     TEXT NOT NULL,
  end_at       TEXT NOT NULL,
  -- 'oneOnOne' | 'team' | 'manual' (Swift: MeetingKind)
  kind         TEXT NOT NULL DEFAULT 'manual',
  -- Dedupe key for calendar import. Held the EventKit id in the Swift app; now
  -- holds the .ics/Google event uid, or 'fellow:<id>' for imported notes.
  external_id  TEXT,
  notepad      TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_meeting_owner_start ON meeting (owner_email, start_at);
-- Makes calendar re-import idempotent: one external event maps to one meeting
-- per owner. This is where the Swift recurring-event dedupe bug was fixed.
CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_external
  ON meeting (owner_email, external_id);

CREATE TABLE IF NOT EXISTS meeting_attendee (
  meeting_id  TEXT NOT NULL,
  person_id   TEXT NOT NULL,
  PRIMARY KEY (meeting_id, person_id),
  FOREIGN KEY (meeting_id) REFERENCES meeting (id) ON DELETE CASCADE,
  FOREIGN KEY (person_id) REFERENCES person (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS talking_point (
  id           TEXT PRIMARY KEY,
  owner_email  TEXT NOT NULL,
  meeting_id   TEXT NOT NULL,
  text         TEXT NOT NULL DEFAULT '',
  is_covered   INTEGER NOT NULL DEFAULT 0,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT,
  FOREIGN KEY (meeting_id) REFERENCES meeting (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tp_meeting ON talking_point (meeting_id, sort_order);

CREATE TABLE IF NOT EXISTS action_item (
  id           TEXT PRIMARY KEY,
  owner_email  TEXT NOT NULL,
  -- Nullable: the unified list holds standalone to-dos with no source meeting
  -- (these render as "No series", matching Fellow).
  meeting_id   TEXT,
  assignee_id  TEXT,
  text         TEXT NOT NULL DEFAULT '',
  is_done      INTEGER NOT NULL DEFAULT 0,
  due_date     TEXT,
  completed_at TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT,
  FOREIGN KEY (meeting_id) REFERENCES meeting (id) ON DELETE CASCADE,
  FOREIGN KEY (assignee_id) REFERENCES person (id) ON DELETE SET NULL
);

-- Drives the unified "My To-dos": open items for one owner, ordered by due date.
CREATE INDEX IF NOT EXISTS idx_ai_owner_open
  ON action_item (owner_email, is_done, due_date);
CREATE INDEX IF NOT EXISTS idx_ai_meeting ON action_item (meeting_id, sort_order);

-- Per-user settings. Holds the Google Calendar secret .ics URL, which is a
-- bearer credential: anyone with it can read the calendar, so it is encrypted
-- at rest and never sent to the client.
CREATE TABLE IF NOT EXISTS user_settings (
  owner_email      TEXT PRIMARY KEY,
  ics_url_cipher   TEXT,
  ics_last_sync_at TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

-- NOTE: MeetingStream from Models.swift is deliberately NOT ported. It was
-- modelled but never rendered - PersonStreamView recomputed a person's history
-- from attendees and assigned action items instead. Rather than carry a table
-- nothing reads, per-person history is derived the same way here. Revisit only
-- if streams need to diverge from attendance.

-- Google Calendar connection, one row per user.
--
-- The refresh token is a long-lived credential: it grants calendar access until
-- explicitly revoked, so it is stored encrypted (AES-256-GCM, key from Vault
-- via FELLOW_ENCRYPTION_KEY) and never sent to the client. Access tokens are
-- short-lived and deliberately NOT persisted - they are re-minted on demand.
CREATE TABLE IF NOT EXISTS google_connection (
  owner_email          TEXT PRIMARY KEY,
  refresh_token_cipher TEXT NOT NULL,
  google_email         TEXT,
  scope                TEXT,
  -- Incremental sync cursor. Google may expire it at any time (410), which
  -- forces a full resync; null means "next sync is a full one".
  sync_token           TEXT,
  last_sync_at         TEXT,
  last_sync_error      TEXT,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);

-- Short-lived OAuth handshake state (CSRF token + PKCE verifier).
-- Rows are single-use and expire in minutes; a sweep on write keeps this small.
CREATE TABLE IF NOT EXISTS oauth_state (
  state        TEXT PRIMARY KEY,
  owner_email  TEXT NOT NULL,
  verifier     TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL
);
