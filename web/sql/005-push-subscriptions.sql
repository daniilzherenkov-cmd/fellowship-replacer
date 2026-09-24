-- Web Push: notifications that arrive with the browser closed.
--
-- Possible now because the app runs as a SINGLE always-on replica
-- (`min: 1, max: 1` in the platform's app.yaml), so an in-process scheduler
-- registered at boot is a real scheduler. There is no platform cron; the app
-- hosts its own.
--
-- reminder_sent exists to make sending IDEMPOTENT rather than relying on
-- there being one replica. Its primary key is (meeting_id, owner_email), so a
-- second attempt fails the insert instead of sending a duplicate. If `max`
-- is ever raised above 1, nobody gets notified twice.
--
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS push_subscription (
  id           varchar(64)  NOT NULL PRIMARY KEY,
  owner_email  varchar(320) NOT NULL,
  -- Push endpoints are long URLs; 500 chars indexes cleanly under utf8mb4.
  endpoint     varchar(500) NOT NULL,
  p256dh       varchar(256) NOT NULL,
  auth_secret  varchar(128) NOT NULL,
  created_at   varchar(32)  NOT NULL,
  updated_at   varchar(32)  NOT NULL,
  UNIQUE KEY uq_push_endpoint (endpoint),
  KEY idx_push_owner (owner_email)
);

CREATE TABLE IF NOT EXISTS reminder_sent (
  meeting_id  varchar(64)  NOT NULL,
  owner_email varchar(320) NOT NULL,
  sent_at     varchar(32)  NOT NULL,
  PRIMARY KEY (meeting_id, owner_email)
);
