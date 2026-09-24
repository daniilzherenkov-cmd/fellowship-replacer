-- MySQL schema for Fellow Hero, mirroring PRODUCTION exactly.
--
-- WHY THIS EXISTS SEPARATELY FROM schema.sql: that file claims to be written
-- in the "MySQL 8 / SQLite common subset", but it is not. MySQL rejects it at
-- the first table:
--
--   ERROR 1101: BLOB, TEXT, GEOMETRY or JSON column 'color_hex'
--               can't have a default value
--
-- Production was therefore built from an adapted version applied out of band,
-- and drifted from the checked-in file: production uses varchar(n) for every
-- key and short column, not TEXT.
--
-- The column types below were read back from the live database with the
-- Protoship describe_database tool on 2026-09-23, so this file IS production.
-- Keep it that way: when you change production, change this too.
--
-- Load into a local dev database with:
--   mysql -u root fellow_dev < sql/schema.mysql.sql

CREATE TABLE IF NOT EXISTS person (
  id           varchar(64)  NOT NULL PRIMARY KEY,
  owner_email  varchar(320) NOT NULL,
  name         text         NOT NULL,
  email        varchar(320) NULL,
  role         text         NULL,
  color_hex    varchar(16)  NOT NULL DEFAULT '#2563EB',
  is_me        tinyint      NOT NULL DEFAULT 0,
  created_at   varchar(32)  NOT NULL,
  updated_at   varchar(32)  NOT NULL,
  deleted_at   varchar(32)  NULL,
  KEY idx_person_owner (owner_email)
);

CREATE TABLE IF NOT EXISTS meeting (
  id           varchar(64)  NOT NULL PRIMARY KEY,
  owner_email  varchar(320) NOT NULL,
  title        text         NOT NULL,
  start_at     varchar(32)  NOT NULL,
  end_at       varchar(32)  NOT NULL,
  kind         varchar(16)  NOT NULL DEFAULT 'manual',
  external_id  varchar(400) NULL,
  notepad      mediumtext   NOT NULL,
  -- The owner's own RSVP, so declined meetings can render struck through the
  -- way Fellow does rather than being hidden.
  response_status varchar(16) NULL,
  is_all_day   tinyint      NOT NULL DEFAULT 0,
  -- Parsed from the calendar event. Drives the Google Meet badge and the
  -- location line; both were being extracted and discarded before 2026-09-23.
  conference_url varchar(512) NULL,
  location     varchar(512) NULL,
  -- Manager-only notes on a 1:1. Not an access boundary yet (nothing is
  -- shared), but keeps private content separate from the shared note body.
  private_notes mediumtext NULL,
  created_at   varchar(32)  NOT NULL,
  updated_at   varchar(32)  NOT NULL,
  deleted_at   varchar(32)  NULL,
  KEY idx_meeting_owner (owner_email)
);

CREATE TABLE IF NOT EXISTS meeting_attendee (
  meeting_id  varchar(64) NOT NULL,
  person_id   varchar(64) NOT NULL,
  PRIMARY KEY (meeting_id, person_id)
);

CREATE TABLE IF NOT EXISTS talking_point (
  id           varchar(64)  NOT NULL PRIMARY KEY,
  owner_email  varchar(320) NOT NULL,
  meeting_id   varchar(64)  NOT NULL,
  text         mediumtext   NOT NULL,
  is_covered   tinyint      NOT NULL DEFAULT 0,
  sort_order   int          NOT NULL DEFAULT 0,
  created_at   varchar(32)  NOT NULL,
  updated_at   varchar(32)  NOT NULL,
  deleted_at   varchar(32)  NULL,
  KEY idx_tp_meeting (meeting_id)
);

CREATE TABLE IF NOT EXISTS action_item (
  id           varchar(64)  NOT NULL PRIMARY KEY,
  owner_email  varchar(320) NOT NULL,
  meeting_id   varchar(64)  NULL,
  assignee_id  varchar(64)  NULL,
  text         mediumtext   NOT NULL,
  is_done      tinyint      NOT NULL DEFAULT 0,
  due_date     varchar(32)  NULL,
  completed_at varchar(32)  NULL,
  sort_order   int          NOT NULL DEFAULT 0,
  created_at   varchar(32)  NOT NULL,
  updated_at   varchar(32)  NOT NULL,
  deleted_at   varchar(32)  NULL,
  KEY idx_ai_owner (owner_email),
  KEY idx_ai_meeting (meeting_id),
  KEY idx_ai_assignee (assignee_id)
);

CREATE TABLE IF NOT EXISTS google_connection (
  owner_email          varchar(320) NOT NULL PRIMARY KEY,
  refresh_token_cipher text         NOT NULL,
  google_email         varchar(320) NULL,
  scope                text         NULL,
  sync_token           text         NULL,
  last_sync_at         varchar(32)  NULL,
  last_sync_error      text         NULL,
  created_at           varchar(32)  NOT NULL,
  updated_at           varchar(32)  NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_state (
  state       varchar(128) NOT NULL PRIMARY KEY,
  owner_email varchar(320) NOT NULL,
  verifier    varchar(256) NOT NULL,
  created_at  varchar(32)  NOT NULL,
  expires_at  varchar(32)  NOT NULL
);

CREATE TABLE IF NOT EXISTS user_settings (
  owner_email      varchar(320) NOT NULL PRIMARY KEY,
  ics_url_cipher   text         NULL,
  ics_last_sync_at varchar(32)  NULL,
  created_at       varchar(32)  NOT NULL,
  updated_at       varchar(32)  NOT NULL
);

CREATE TABLE IF NOT EXISTS push_subscription (
  id           varchar(64)  NOT NULL PRIMARY KEY,
  owner_email  varchar(320) NOT NULL,
  endpoint     varchar(500) NOT NULL,
  p256dh       varchar(256) NOT NULL,
  auth_secret  varchar(128) NOT NULL,
  created_at   varchar(32)  NOT NULL,
  updated_at   varchar(32)  NOT NULL,
  UNIQUE KEY uq_push_endpoint (endpoint),
  KEY idx_push_owner (owner_email)
);

-- Makes reminder sending idempotent: the PK rejects a second attempt, so
-- duplicates are impossible even if the app ever runs more than one replica.
CREATE TABLE IF NOT EXISTS reminder_sent (
  meeting_id  varchar(64)  NOT NULL,
  owner_email varchar(320) NOT NULL,
  sent_at     varchar(32)  NOT NULL,
  PRIMARY KEY (meeting_id, owner_email)
);

-- Real-time shared notes (docs/16). Keyed on the external_id Google gives
-- every attendee identically. Additive: no shared_note row means the note
-- behaves exactly as a single-owner note.
CREATE TABLE IF NOT EXISTS shared_note (
  external_id  varchar(400) NOT NULL PRIMARY KEY,
  content      mediumtext   NOT NULL,
  updated_at   varchar(32)  NOT NULL,
  updated_by   varchar(320) NOT NULL,
  revision     bigint       NOT NULL DEFAULT 0
);

-- Membership is derived from the calendar invite, written server-side.
CREATE TABLE IF NOT EXISTS shared_note_member (
  external_id varchar(400) NOT NULL,
  email       varchar(320) NOT NULL,
  created_at  varchar(32)  NOT NULL,
  PRIMARY KEY (external_id, email)
);
