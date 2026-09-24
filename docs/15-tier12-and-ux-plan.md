# 15 - Plan: Tier 1 + Tier 2 + four UX issues

Written 2026-09-23 after v16. Plan only, nothing built yet.
Builds on [14 - Fellow parity gap](14-fellow-parity-gap.md).

---

# Part A - the four new issues

## A1. Make the UI bigger

**Diagnosis.** Base font is **14px** (`globals.css:120`), the agenda panel is
**268px**, and the icon rail is **64px**. Against Fellow's own screenshot at a
comparable window width, Fellow's agenda is wider and its rows are taller.

The blocker is not the numbers, it is that **there is no scale to turn**. Sizes
are hardcoded at roughly 90 call sites:

| Size | Uses |
|---|---|
| `text-[13px]` | **44** |
| `text-[12px]` | 15 |
| `text-[10px]` | 8 |
| `text-[11px]` | 7 |
| others (22/16/15/14/17/9px) | ~20 |

So "make it bigger" today means editing 90 values by hand and getting it
inconsistently wrong.

**Plan.**
1. Add a **type and density scale** to `globals.css`: `--text-xs/sm/base/lg/xl`
   and `--row-height`, `--agenda-width`, `--rail-width`.
2. Replace the ~90 hardcoded `text-[Npx]` with the tokens. Mechanical, one
   pass, no behaviour change.
3. Step the scale up one notch: body 14 → 15, the 13px tier → 14, agenda 268 →
   300, and a little more row padding.
4. Screenshot before and after at the same window width for comparison.

Step 2 is the real work and is worth doing regardless: it makes future density
changes a one-line edit.

## A2. Wrong participants in the note, and `@` should be scoped

**Diagnosis - confirmed bug.** `meetings/[id]/page.tsx:16` calls
`listPeople(identity.email)`, which is **every person you have ever shared a
meeting with**, and passes that as `people` to the note. That is why "Shops
Science retro" offers Abdalla Chair, Abdou Abougouda and the rest of the
alphabet.

`meeting.attendees` already holds the correct list and is what the header
avatars render, so the data is right there.

**Plan.**
1. Pass `meeting.attendees` to the `@` picker in both talking points and
   action items. Small change, fixes the screenshot.
2. Keep the **assignee** picker on the full list. Fellow lets you assign work
   to someone who was not in the room, and losing that would be a regression.
3. **"Only people with a Fellow account"** cannot be reproduced faithfully yet:
   this app has **no user table**. Everyone is a `person` row derived from a
   calendar attendee, so there is no fact recorded about who has an account.
   Fellow filtered 5 attendees down to 2 in your screenshot on exactly that
   basis. Attendee-scoping gets most of the benefit now; the account filter
   becomes possible only once multi-user exists (Tier 4 in doc 14).

## A3. A real "New meeting", and creating from the grid

**Diagnosis.** `createMeetingAction` inserts a stub titled "New meeting" at
09:00 on the selected day and navigates to it. There is no form: you cannot
set the time, duration or attendees, which is why two identical 9:00 stubs
appear in your screenshot.

**Plan, in two steps.**

**A3a - a proper create dialog (local only).** Click an empty slot in the week
grid, or the "+" button, and get Fellow's popup: title, date, start and end,
all-day toggle, repeat, attendee search, description. Saves to our database.
Click-to-create needs a slot-to-time hit test in `WeekGrid`, which is the only
fiddly part.

**A3b - write the event to Google Calendar.** Newly possible: the OAuth scope
is already `calendar.events`, which is **read and write**, so no new consent
is needed. Nothing in the app writes today.

Two things to know before committing to this:

- **It reverses a v1 decision.** [Doc 01 §5](01-product-brief.md) explicitly
  cuts "calendar write-back" from v1. Reversing it is fine, but it should be a
  deliberate call, not a side effect.
- **Attendee search is not full parity.** Fellow's picker searches the Google
  Workspace **directory** (your screenshot shows "zoe" matching four people,
  including ones you may never have met). That needs a directory or contacts
  scope, which means a new consent screen and another admin approval. What we
  can do **without any new scope** is search the `person` table, which already
  holds everyone from your synced calendar. That covers colleagues you actually
  meet and needs nothing from anybody.

Recommend shipping A3a, then A3b against the `person` table, and treating the
directory scope as a separate ask only if the narrower search proves annoying.

---

# Part B - Tier 1 (completes the promised v1)

## B1. Global search
The single most-present thing in Fellow and absent from every screen of ours.

- Top-bar field, `⌘K` and `⌘F`.
- Searches **meetings** (title, notepad), **talking points**, **action items**
  and **people**, all `owner_email`-scoped.
- Start with `LIKE '%term%'` across those tables, ordered by recency. MySQL
  FULLTEXT is the upgrade path if it gets slow; at this data size it will not.
- Results grouped by type, keyboard navigable, Enter opens.

## B2. Actions page: filters and creation
- **Filters**: by person, by due window, by source meeting, and done/not done.
- **"+ New action item"** so the unified list is not read-only. Creates a
  standalone item (`meeting_id IS NULL`, the path the `IS ?` bug used to break).
- **Search within items**, reusing B1's query layer.

## B3. Real carry-forward
Today the person page lists open items under "Carried forward" but nothing
moves them. Fellow carries unfinished items into the next meeting of the same
series.

- On opening a 1:1, surface unfinished items from the previous meeting with
  the same person, as a dismissible "Carried forward" block above Talking
  Points.
- Deliberately **not** copying rows: the item keeps its identity and back-link,
  it is only shown in a second place. Copying would break "check it once,
  checked everywhere".

---

# Part C - Tier 2 (cheap, high fidelity return)

## C1. Persist and show `conferenceUrl` and `location`
Best ratio on the list. `normaliseEvent` already extracts both and
`upsertMeeting` throws them away. Two columns, then the green **Google Meet**
badge in the note header and the location on the agenda row.

## C2. All-day row above the week grid
All-day events sit inline today. Fellow pins them in their own band at the top,
which is where "Home" and "Berlin | FSA (Office)" belong. `is_all_day` already
exists, so this is layout only.

## C3. "50m left" chip
Time remaining in the note header, ticking. There is already a 60s timer in
`WeekGrid` to copy.

## C4. `⌘N` and `⌘F`
Doc 04 asked for both. Only `⌘1-4` exists. `⌘N` opens the new-meeting dialog
from A3a, `⌘F` focuses search from B1.

---

# Sequencing

Ordered so each step unblocks the next and nothing is wasted.

| # | Work | Why here |
|---|---|---|
| 1 | **A2** attendee scoping | Confirmed bug, smallest fix, wrong data on screen today |
| 2 | **C1** conferenceUrl + location | Two columns; do it in the same migration as anything else schema-touching |
| 3 | **A1** scale tokens, then step up | Touches every component, so do it before adding more of them |
| 4 | **B1** global search | Biggest single gap; B2 and C4 both build on it |
| 5 | **B2** filters and creation | Reuses B1's query layer |
| 6 | **A3a** create dialog | Needs the scale work done to look right |
| 7 | **C2**, **C3**, **C4** | Small, independent |
| 8 | **B3** carry-forward | Most product nuance; benefits from the rest settling |
| 9 | **A3b** Google write-back | Reverses a v1 decision; wants an explicit yes |

## Decisions I need from you

1. **A3b write-back**: confirmed you want it, given doc 01 cut it from v1?
2. **Directory search**: accept `person`-table search, or ask Anubha for a
   directory scope?
3. **A1 scale**: step up one notch as described, or do you want a specific
   target, for example matching Fellow pixel for pixel at 1440px?

I can start on 1 and 2 immediately; neither depends on the answers.
