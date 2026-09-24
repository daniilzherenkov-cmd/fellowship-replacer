-- Fellow gives the manager a private notes panel on a 1:1: coaching notes and
-- rapport details that are NOT shared with the report. docs/01 lists it as
-- one of the five reasons people love Fellow, and it was the last of the five
-- with nothing behind it.
--
-- Worth being precise about what "private" means here TODAY: every row in
-- this database is already scoped to one owner_email and nothing is shared
-- with anyone, so this column is not yet an access-control boundary. It is
-- the place the content belongs, so that when sharing does arrive the private
-- notes are already separated from the shared note body rather than needing
-- to be untangled from it.
--
-- Safe to re-run. Nullable, no backfill.

ALTER TABLE meeting ADD COLUMN private_notes mediumtext NULL;
