-- Real-time shared notes. See docs/16.
--
-- ADDITIVE ONLY. Nothing here alters `meeting`, and a meeting with no
-- shared_note row behaves exactly as it does today, so this ships dark.
--
-- The key is `external_id`, which Google already gives identically to every
-- attendee: 29 meetings on production already share one across both owners.
-- No mapping table and no migration are needed.
--
-- What is NOT here: private_notes stays on `meeting`, owner-scoped. That is
-- the shared/private line, and it is the whole reason this is safe to build.

CREATE TABLE IF NOT EXISTS shared_note (
  external_id  varchar(400) NOT NULL PRIMARY KEY,
  -- Last-write-wins for now. updated_at is the tiebreaker and updated_by
  -- lets the UI say whose version won.
  content      mediumtext   NOT NULL,
  updated_at   varchar(32)  NOT NULL,
  updated_by   varchar(320) NOT NULL,
  -- Monotonic per note, so a client can ignore an echo of its own write and
  -- detect that it missed one.
  revision     bigint       NOT NULL DEFAULT 0
);

-- Who may join a note's channel. Written server-side at sync time from the
-- calendar event's attendee list; a client never asserts its own membership.
CREATE TABLE IF NOT EXISTS shared_note_member (
  external_id varchar(400) NOT NULL,
  email       varchar(320) NOT NULL,
  created_at  varchar(32)  NOT NULL,
  PRIMARY KEY (external_id, email)
);
