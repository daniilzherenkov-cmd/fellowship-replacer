# 11 - Fellow export schema (what migration can actually recover)

Written against a real export, not Fellow's documentation. Fellow's help centre
says the export contains "everything" without itemising it, which turns out to
overstate things considerably.

**Source:** `~/Downloads/exports/1411719/export.json`, 1.6 MB, Danya's own
account, exported 2026-09-07.

**How to get one:** User Settings -> Profile -> Personal Data -> Export.
Self-service, no admin and no support ticket; arrives as a JSON file by emailed
link. (Workspace-wide export does need support via in-app chat.)

## Top-level shape

```
{ user_information, feedback[], calendars[], notes[], attachments[], objectives[] }
```

In the sampled export: `feedback`, `attachments` and `objectives` were all
empty.

## `notes[]` - thinner than expected

Each note has exactly five keys:

```
{ id, title, content, start, end }
```

`content` is a **flat array of strings**, not structured blocks. The three
section headers appear as ordinary text lines, with the subtitle glued on after
a newline inside the same array element:

```
"Talking Points\nThe things to talk about"
```

### What is NOT in the export

Verified by scanning the whole file for each term:

| Field | Occurrences |
|---|---|
| `assignee` | 0 |
| `due_date` / `dueDate` | 0 |
| `completed` / `is_done` / `checked` | 0 |
| `attendee` / `person` / `owner` | 0 |
| `avatar` | 0 |

So **action item state, assignees, due dates, attendees and per-person 1:1
grouping do not survive an export at all.** They are not recoverable by any
importer, however clever.

### Volume

| | Count |
|---|---|
| Notes | 875 |
| Empty template shells | 865 |
| Notes with real content | **10** |
| Undated | 2 |
| Meetings imported | **8** |

Fellow auto-creates a note per calendar meeting, so the overwhelming majority
are scaffolding that was never written in.

## `calendars[].events[]` - where the real history lives

Far more useful than the notes:

```
{ guid, title, description, location, start, end }
```

| | Count |
|---|---|
| Events | 2,354 |
| Properly dated | 2,205 |
| Placeholder-dated (`2000-01-01`) | 149 |
| In 2026 | 1,700 |
| Imported (since 2026-01-01, after dedupe) | **1,778** |
| Detected as 1:1 | **198** |
| Duplicate guids | 0 |

Date range spans 1985 to 2027 (a few far-outliers), so a `since` bound is worth
applying.

## Two traps

**1. Note ids and calendar guids are different identifier spaces.** Zero of 875
note ids match any calendar guid, so `externalId` alone cannot tell that a note
and an event describe the same meeting. De-duplication falls back to
`title|start` at minute precision. Without it, **8 of the 10 substantive notes
duplicate** - and those are precisely the meetings that have content, so the
duplicates would be the most visible rows in the app.

**2. Do not synthesise action items from prose.** Some notes carry an
`AI-Detected Action Items` section containing sentences like *"X to check the
status of Y and report back."* These are prose, not tasks: no state, no
assignee, no due date. Generating action items from them would hand the user a
fake to-do list that looks authoritative. The importer preserves the text as
notepad content and asserts `actionItemsCreated === 0` in its report.

## Implementation

`web/src/import/fellow.ts`, tested in `web/test/e2e/import.spec.ts` (including
against this real file, skipped automatically when it is absent).

## What to tell users migrating

Fellow's export does not carry action items, assignees, or per-person 1:1
history - those start fresh. Meeting titles, times and any written talking
points and notes do come across, and the calendar block supplies a full meeting
history even before calendar sync is connected.
