# 03 — Technical Recommendation

> Scope: native macOS, single-user, local-first, no AI/transcription in v1, calendar **read** sync in v1. Designed so v2 (AI) and v3 (team sync) bolt on without a rewrite.
>
> **Honesty note:** EventKit and OSS facts below were verified against fetched docs (cited). API names and version floors reflect model knowledge current to early 2026 — **pin exact versions when scaffolding**.

## 1. Stack recommendation

| Concern | Recommendation | Why |
|---|---|---|
| Language/UI | **Swift + SwiftUI** (drop to AppKit via `NSViewRepresentable` only where needed, esp. the text editor) | "Exactly native" requirement; fastest path to a modern Mac three-pane app via `NavigationSplitView` |
| Min OS | **macOS 14 Sonoma+** (ideally 15) | Unlocks **SwiftData** and the modern **EventKit full-access** API; keeps code simple |
| Persistence | **SwiftData** (with a fallback option of **GRDB/SQLite** if we hit limits) | Native, Swift-first, integrates with SwiftUI; Core Data is the older alternative |
| Calendar | **EventKit** (read connected calendars) | Reads Google/Exchange/iCloud accounts already in macOS Calendar — no per-service OAuth |
| Text/notes | **`NSTextView`/`AttributedString`-based editor** (AppKit-backed) for editing; **MarkdownUI** only if a read-only render path is wanted | Editing rich text + checkboxes natively; see §4 |
| Distribution | **Free for dev:** run from Xcode with a free Apple ID (Personal Team). The $99/yr paid program is only for warning-free sharing/notarization — see §8 | Build & use v1 at **$0** |

## 2. Calendar integration — **EventKit** (recommended for v1)

**Verified** (source: https://developer.apple.com/documentation/eventkit):
- EventKit reads the system's unified calendar DB (`EKEventStore`), which **aggregates every account the user added in System Settings → Internet Accounts** — iCloud, **Google**, Exchange, CalDAV. *"Whatever the Calendar app shows is what EventKit sees."* So if Milena's DH Google calendar is in macOS Calendar, **we get it for free without building Google OAuth.**
- macOS 14+ API: `try await store.requestFullAccessToEvents()` (older `requestAccess(to:)` is deprecated). Statuses: `.fullAccess`, `.writeOnly`, `.denied`, `.restricted`, `.notDetermined`.
- **Info.plist:** `NSCalendarsFullAccessUsageDescription` (legacy `NSCalendarsUsageDescription` deprecated).
- **Sandbox entitlement** (if sandboxed): `com.apple.security.personal-information.calendars`.

**v1 approach:** read-only import — list events in a date range (`predicateForEvents(withStart:end:calendars:)`), map each to a Meeting, dedupe recurring instances into per-person/per-series **Streams**, and observe `.EKEventStoreChanged` to refresh.

**How Fellow does it (verified from screenshots):** Fellow is a web/desktop app that integrates the **Google Calendar API directly** via **OAuth 2.0** — it reads your calendars and **creates events with Google Meet links** plus a calendar picker ("Primary Calendar") and auto-record toggle. That requires a Google Cloud OAuth client and the user granting calendar scopes.

**For our native Mac app — two options:**
- **EventKit (recommended for v1):** zero OAuth. If Daniel's DH Google calendar is added to macOS Calendar (System Settings → Internet Accounts), EventKit reads — and can write — it for free. Fastest path; best privacy story.
- **Google Calendar API (Fellow-parity path):** needed if the calendar is *not* in macOS Calendar, or to match Fellow's richer writes (create event **with a Meet link**, RSVP details). Cost: a Google Cloud project + OAuth client, token storage (Keychain), and — important — **DH IT may need to approve the OAuth app/scopes** for Workspace data. That approval is the main downside vs. EventKit.

**Recommendation:** ship v1 on **EventKit** (read + optional local event create) to get a working demo fast, then add the **Google Calendar API** in a later phase for Fellow-style Meet-link creation. You flagged wanting Google API — fully viable, just heavier and gated on IT approval, so I'd still start with EventKit.

## 3. Local data model

Single-user, local. Core entities (SwiftData `@Model` classes):

- **Person** — id, name, email, role/title, avatar, calendarIdentifier(s). 1:1 partner.
- **Meeting** — id, title, start/end, type (`oneOnOne` | `team` | `manual`), `ekEventIdentifier?`, `seriesId?` (recurring), attendees → [Person], `streamId?`.
- **Stream** — id, kind (`person1on1` | `recurringSeries`), title, partnerPerson?, ordered meetings. *(This is Fellow's "continuity" thread — the backbone of per-person history.)*
- **Note** — id, meetingId, body (rich text/attributed or markdown), privateBody? (1:1 manager-only), updatedAt.
- **AgendaItem** — id, meetingId, text, order, covered:Bool.
- **ActionItem** ⭐ — id, text, done:Bool, assignee→Person?, dueDate?, **sourceMeetingId** (back-link), createdAt, completedAt?, carriedForwardFromId?.
  - The **unified "My To-dos"** screen is just a query over all `ActionItem` where `!done`, grouped/sorted by dueDate/assignee/meeting.
  - **Carry-forward**: when creating the next 1:1 in a Stream, clone/link unfinished `ActionItem`s from the previous meeting in that Stream.
- **Template** — id, kind, title, default agenda items / note skeleton.

**Future-proofing for v3 sync:** give every entity a stable UUID + `updatedAt` (and soft-delete `deletedAt`) now, so a later CRDT/CloudKit/Postgres sync layer has clean primary keys and change tracking. For v2 AI, add nullable `transcript`/`summary`/`recordingURL` to Meeting later — no schema break.

## 4. Rich-text + checklist editor (the hardest piece)

- **Verified:** **MarkdownUI** (https://github.com/gonzalezreal/swift-markdown-ui) renders GFM **including task lists/checkboxes**, MIT license, macOS 12+ — but it is **display-only** (now in maintenance mode; successor "Textual"). Good for a read-only stream/preview, **not** for editing.
- **Editing recommendation:** build the editor on **`NSTextView`** (AppKit) wrapped in `NSViewRepresentable`, using `AttributedString`/`NSAttributedString`, with custom handling for the **checkbox/action-item** block (toggle, assignee, due date). This is the most reliable native rich-text path and what serious Mac note apps do.
  - Lighter alternative: a **block-based SwiftUI editor** (each line = a typed block: heading/bullet/checkbox) — simpler to reason about, more work to match a fluid text feel.
  - Store as **markdown + a small JSON sidecar** for action-item metadata (assignee/due/links), or as `AttributedString` archived data. Markdown keeps notes portable and v2-AI-friendly.
- Other OSS to evaluate (model knowledge — verify license/fit): `swift-markdown` (Apple, parsing), `Down` (cmark rendering), `STTextView` (TextKit2 editor component), `HighlightedTextEditor`.

## 5. Architecture sketch

- **Pattern:** SwiftUI + **MV / observable services** (avoid heavy MVVM ceremony). `@Observable` services for `CalendarService` (EventKit), `MeetingStore`/`ActionItemStore` (SwiftData), `SearchService`.
- **Layers:**
  - `CalendarService` — EventKit auth + fetch + change observation → upserts Meetings/Streams.
  - `Persistence` — SwiftData `ModelContainer`; queries power the views (`@Query`).
  - `Views` — `NavigationSplitView` (sidebar/list/detail) per [02 — Design Brief](02-design-brief.md).
  - `Editor` — `NSTextView` representable + action-item plumbing.
- **Search:** SwiftData predicates for v1; consider SQLite FTS5 (via GRDB) if note volume grows.
- **No network in v1** → simpler security/privacy story (great for the "data stays on-device" leadership pitch).

## 6. Risks / watch-items
- **Editor effort** is the dominant risk — budget the most time here; consider shipping a simpler block editor first.
- **EventKit full-access prompt** + (if sandboxed) the calendars entitlement must be set or sync silently fails — wire the first-run UX (see [02 §7](02-design-brief.md)).
- **Recurring-event → Stream mapping** has edge cases (changed series, exceptions); start simple (group by title+attendees / series id).
- **SwiftData maturity** — if migrations/perf bite, GRDB/SQLite is the escape hatch; the UUID+updatedAt model makes either viable.

## 8. Distribution & signing — the $0 path

You do **not** need to pay to build and use this app:
- **Develop & run for free:** sign into Xcode with a **free Apple ID** (a "Personal Team"). You can build, run, and debug on **your own Mac** indefinitely — EventKit included. Cost: **$0**.
- **Caveat (free Apple ID):** Personal-Team builds aren't notarized, so handing the `.app` to someone else triggers Gatekeeper's "unidentified developer" warning (they right-click → Open, or you ship an **ad-hoc-signed** build with bypass notes). Fine for personal use and a demo to Milena.
- **Warning-free distribution** to colleagues needs either the **$99/yr Apple Developer Program** (Developer ID + notarization) or **DH's existing org Apple account / MDM** — defer until the demo lands and DH sponsors it.
- **Sandboxing** is required only for the **App Store**. For dev / ad-hoc / Developer-ID builds it's optional; if you do sandbox, add the calendars entitlement (§2).

**Recommendation:** build v1 with a free Apple ID and run from Xcode (ad-hoc share for the demo). Ask DH to fund the $99 program — or use their account — only when rolling out beyond yourself.

## 7. Sources
- https://developer.apple.com/documentation/eventkit (EventKit capabilities, `requestFullAccessToEvents`, Info.plist key, sandbox entitlement)
- https://github.com/gonzalezreal/swift-markdown-ui (MarkdownUI: GFM incl. task lists, MIT, macOS 12+, display-only, maintenance mode)
- Apple SwiftData / SwiftUI / Human Interface Guidelines (model knowledge — pin versions at scaffold time)
