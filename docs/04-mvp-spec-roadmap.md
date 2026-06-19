# 04 — MVP Spec + Phased Roadmap

## MVP definition (v1)

A native macOS app that lets a manager run structured, calendar-synced meetings and 1:1s, take notes by hand, and never lose an action item — replacing the **part of Fellow DH actually uses daily**, at **$0/seat**, fully **on-device**.

### v1 user stories (mapped to Milena's four must-haves)

**Must-have #1 — Per-person 1:1 history**
- As a manager, I see a **directory of people** I have 1:1s with.
- Selecting a person shows their **1:1 Stream**: a chronological history of every past 1:1 note.
- Starting the next 1:1 carries forward unfinished action items + applies the person's template.

**Must-have #2 — In-meeting checklists / to-dos**
- In any meeting note, I add **checkbox action items**, optionally assign a person + due date.
- Items live inside the note and toggle done/undone instantly.

**Must-have #3 — The "ultimate" unified to-do list**
- **My To-dos** aggregates **every open action item across all meetings**.
- Filter by due date / person / source meeting; each row **back-links to its source note**.
- Checking it anywhere checks it everywhere.

**Must-have #4 — Fellow-grade native UX**
- Three-pane Mac app, light/dark, keyboard-first, autosave, fast. (See [02 — Design Brief](02-design-brief.md).)

### v1 supporting scope
- **Calendar sync** (EventKit, read-only) → today/upcoming meetings auto-appear; manual notes also supported.
- **Agenda / talking points** per meeting (reorderable, "covered" checkbox).
- **Templates** (built-in: 1:1, team sync) + private notes panel for 1:1s.
- **Search** across notes/people/to-dos.

### Explicitly NOT in v1
Audio recording · transcription · AI summaries/extraction · "Ask Fellow" chat · real-time collaboration · team cloud sync/sharing · calendar write-back · third-party integrations (CRM/Asana/Jira/Slack) · analytics/policies · mobile/Windows/web.

## Acceptance criteria (v1 "done")
- [ ] App reads the Mac's connected calendars and lists today's + this week's meetings.
- [ ] Each meeting opens a note workspace with rich text + checkboxes; autosaves locally.
- [ ] Each person has a persistent 1:1 Stream showing full history.
- [ ] Action items carry forward into the next 1:1 in a Stream.
- [ ] "My To-dos" shows all open items across meetings with working back-links + filters.
- [ ] Light/dark, keyboard shortcuts (⌘N/⌘F/⌘1-3), context menus all work.
- [ ] All data stays on-device (no network calls).

## Suggested build sequence (engineering order)
1. **Skeleton** — `NavigationSplitView` shell, SwiftData models, sidebar sections.
2. **Calendar** — EventKit auth + first-run permission UX + import meetings.
3. **Note editor** — start with a block/checkbox editor; iterate toward rich text (highest-risk; see [03 §4](03-technical-recommendation.md)).
4. **Action items + My To-dos** — the rollup query + back-links + filters.
5. **People + 1:1 Streams** — directory, stream timeline, carry-forward.
6. **Agenda, templates, private notes, search.**
7. **Native polish** — shortcuts, menus, dark mode, empty states (apply Figma output).

## Phased roadmap (beyond MVP)
- **v2 — AI notetaker (opt-in):** on-device transcription (e.g., local Whisper) + summaries/action-item extraction using **DH's own keys or on-device models** — keeping the cost/privacy advantage. (Schema already leaves room: add transcript/summary/recording fields.)
- **v3 — Team / sharing:** multi-user sync (CloudKit or a DH-hosted backend), shared agendas, permissions. (UUID + updatedAt + soft-delete already in the v1 model.)
- **v4 — Integrations & reach:** calendar write-back, task-tool sync (Jira/Asana/Linear), Slack, analytics; possibly iOS companion.

## Resolved decisions (from Daniel, 2026-06-02)
1. **Min macOS → macOS 14+ confirmed.** Daniel is on macOS 26 "Tahoe", so SwiftData + modern EventKit are safe (could raise the floor to macOS 15 for newest APIs while keeping older DH Macs in mind).
2. **Calendar → start on EventKit, add Google Calendar API later for parity.** Fellow itself uses the Google Calendar API (OAuth) to create Meet-linked events; we match that in a later phase but ship v1 on EventKit. See [03 §2](03-technical-recommendation.md).
3. **Branding → codename "Fellow 2", Fellow's real palette** (blue primary + purple AI accent, not coral). See [02 §1.5](02-design-brief.md).
4. **Distribution → $0 path:** build & run with a free Apple ID from Xcode; pay $99/yr only when DH sponsors a wider rollout. See [03 §8](03-technical-recommendation.md).
5. **Single-user (clarified):** v1 stores everything **locally on your Mac, just for you** — no logins, no sharing a note with a colleague, no live co-editing. Fellow's shared/collaborative notes need a cloud backend + accounts; that's the **v3 "team sync"** phase. v1 = your personal notes app to prove the concept.
