-- Fellow shows EVERY event: declined ones struck through, all-day ones in
-- their own band, solo blocks like "gym" and "Lunch" alongside real meetings.
-- Fellow Hero was filtering all three out in normaliseEvent, so the calendar
-- looked wrong next to Google.
--
-- Showing them means storing two facts the sync previously computed and threw
-- away: the user's own RSVP, and whether the event is all-day.
--
-- Safe to re-run. Both columns are nullable / defaulted, so existing rows need
-- no backfill; the next sync fills them in.

ALTER TABLE meeting ADD COLUMN response_status varchar(16) NULL;
ALTER TABLE meeting ADD COLUMN is_all_day tinyint NOT NULL DEFAULT 0;
