# 14 - Fellow parity: what is left

> **Updated 2026-09-23 (v17).** Tier 1 and Tier 2 are now BUILT. Global
> search, Actions filters and creation, real carry-forward, the Meet badge and
> location, the all-day band, the time-left chip, and ⌘N/⌘F/⌘K all shipped,
> along with a create-event dialog and Google Calendar write-back. The tables
> below describe the state BEFORE that work; see
> [15 - the plan](15-tier12-and-ux-plan.md) for what each item became. What
> remains is Tier 3 (rich text, drag-to-reorder, private notes) and Tier 4
> (sharing, real-time, AI).

Written 2026-09-23, after v16. Sources: [01 product brief](01-product-brief.md),
[02 design brief §1](02-design-brief.md) (ground truth from real Fellow
screenshots, Delivery Hero workspace), [04 MVP spec](04-mvp-spec-roadmap.md),
and a read of the shipped code.

Status marks: **done**, **partial**, **missing**. Anything marked partial says
what specifically is missing.

---

## 1. Milena's four must-haves

| # | Must-have | Status |
|---|---|---|
| 1 | Per-person 1:1 history | **done** - `/people/[id]` shows the full stream, derived from attendance |
| 2 | In-meeting checklists | **done** - action items live in the note, assignable, with due dates |
| 3 | One unified to-do list | **partial** - aggregation and back-links work; **no filters and no search** |
| 4 | Fellow-grade UX | **partial** - see §3 |

All four are functional. Nothing here is a hole in the product thesis; the gaps
are in reach and polish.

## 2. v1 acceptance criteria from doc 04

| Criterion | Status |
|---|---|
| Reads calendars, lists today and this week | **done** |
| Note workspace, checkboxes, autosave | **done** |
| Persistent per-person 1:1 stream | **done** |
| Action items **carry forward into the next 1:1** | **partial** - the person page lists open items under "Carried forward", but nothing injects them into the next meeting's note. Fellow actually carries them |
| My To-dos with back-links **and filters** | **partial** - back-links work, grouping into Overdue/Today/Upcoming/Inbox works, **filters do not exist** |
| Light/dark, keyboard shortcuts, context menus | **partial** - light/dark done, context menus done, but only ⌘1-4 rail navigation. **No ⌘N, no ⌘F** |
| All data on-device | **void** - reversed by the move to the web |

Three of seven are genuinely incomplete, and the same two words explain most of
it: **search** and **filters**.

## 3. Gaps against the real Fellow UI

From [02 §1](02-design-brief.md), which was captured from live Fellow and
overrides everything else in that doc.

### Global chrome
| Element | Status |
|---|---|
| Left icon rail | **done** (our sections differ: Calendar/Actions/People/Meetings vs Fellow's Calendar/Library/Action items/More) |
| **Global search field** | **missing** - the single biggest absence. Fellow has it in the top bar on every screen |
| Open-note tabs in the top bar | **missing** |
| Back / forward navigation | **missing** |
| Favourite (★) | **missing** |
| Notifications bell | **missing** |
| Workspace switcher | **not applicable** - single tenant |
| "Ask Fellow" | **cut on purpose** (no AI in MVP) |

### Calendar
| Element | Status |
|---|---|
| Day agenda, Today/Week toggle, green now-line | **done** |
| Week grid with accent bars and current-time line | **done** |
| Declined struck through, all-day and solo blocks shown | **done** (v15) |
| **Separate all-day row at the top of the week grid** | **missing** - all-day events currently sit inline. Fellow pins them above the grid, which is where the "Home" and "Berlin / FSA (Office)" chips live in Danya's own screenshots |
| "Meet with…" people search above the grid | **missing** |

### Meeting note
| Element | Status |
|---|---|
| Fixed three blocks, correct bullets and subtitles | **done** |
| Editable title, attendee avatars, autosave | **done** |
| `@` mention in both talking points and action items | **done** (v15) |
| **Google Meet badge** | **missing**, and the data is being **thrown away**: `normaliseEvent` already extracts `conferenceUrl`, and `upsertMeeting` never stores it. Same for `location`. Two parsed fields, no columns |
| "⏱ 50m left" chip | **missing** |
| "📅 Prep for this meeting" | **missing** |
| Drag handle, favourite, Share, ⋮ overflow | **missing** |
| Right inner rail (stream / checklist / bookmark) | **missing** |
| Reorderable talking points | **missing** - no drag anywhere in the app |
| Rich text in the Notepad | **missing** - it is a plain `<textarea>`. Fellow has bulleted rich text |

### Action items
| Element | Status |
|---|---|
| Grouped Overdue / Today / Upcoming / Inbox | **done** |
| Row: checkbox, text, assignee avatar, due pill | **done** |
| Check in one place, checked everywhere | **done** |
| **"My items" vs "Assigned to others" tabs** | **missing** - matters as soon as a second person uses it |
| **Filters button** | **missing** |
| **"Search for items…"** | **missing** |
| **"+ New action item"** on the Actions page | **missing** - items can only be created inside a meeting note |
| User-created groups, "Top priority", "+ New group" | **missing** |

## 4. Fellow's five emotional cores (doc 01 §2)

| Core | Status |
|---|---|
| "I never lose an action item" | **partial** - capture and rollup are solid; true carry-forward into the next 1:1 is not |
| "My 1:1s have continuity" | **done** |
| "Meetings start prepared" | **partial** - agendas exist, but they are not **shared**, so no one can contribute before the meeting |
| "A private space for the manager" | **missing** - no private notes panel |
| "One place for everything" | **done** |

## 5. What I would build next, in order

**Tier 1 - completes the promised v1.** These are on doc 04's own acceptance
list and are the most-felt absences.
1. **Global search** across notes, people and action items. The one thing
   present on every Fellow screen and absent from every one of ours.
2. **Filters on the Actions page**, plus "+ New action item" so the unified
   list is not read-only.
3. **Real carry-forward**: unfinished items from the last 1:1 appear in the
   next one, rather than only on the person page.

**Tier 2 - cheap wins, high fidelity return.**
4. **Persist and show `conferenceUrl` and `location`.** Already parsed and
   discarded; two columns and a badge. Probably the best effort-to-value ratio
   in this list.
5. **All-day row** pinned above the week grid.
6. **"⏱ 50m left"** chip on the note header.
7. **⌘N / ⌘F** to match the spec.

**Tier 3 - structural, needs a decision first.**
8. **Rich text notepad.** Doc 04 flagged the editor as the highest-risk item.
   A plain textarea is the current compromise.
9. **Reorderable talking points** (drag and drop).
10. **Private notes panel** - needs a column and a view, easy alone, but it
    only means something once notes are shared.
11. **"My items" vs "Assigned to others"** - needs multi-user to matter.

**Tier 4 - blocked on a product decision, not effort.**
12. **Shared agendas and real-time collaboration.** Milena's original ask, and
    the one thing on this page that changes the architecture: today every row
    is `owner_email`-scoped and there is no sharing model at all. Needs a
    shared-document access model agreed before any code.
13. **AI / transcription.** Explicitly cut from MVP.

## 6. Honest summary

The **management layer Milena asked for is built and working**. What is missing
divides cleanly:

- **Reach** (search, filters, carry-forward) - the app holds the data and does
  not yet let you get at it. Tier 1 closes this and is the real gap.
- **Polish** (badges, chips, all-day row, drag, rich text) - visible next to
  real Fellow, but nobody is blocked.
- **Multi-user** (sharing, private notes, assigned-to-others) - a genuine
  architectural fork, still undecided, and the only item here that is not
  simply a matter of building it.
