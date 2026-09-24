-- `normaliseEvent` has always extracted conferenceUrl and location from every
-- synced event, and `upsertMeeting` threw both away because no column held
-- them. That is why there is no Google Meet badge: the data was parsed and
-- discarded on every sync.
--
-- Safe to re-run. Both nullable, so no backfill; the next sync fills them.

ALTER TABLE meeting ADD COLUMN conference_url varchar(512) NULL;
ALTER TABLE meeting ADD COLUMN location varchar(512) NULL;
