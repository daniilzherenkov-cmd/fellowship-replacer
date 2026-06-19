# Fellow 2 — Project Context (read me first)

## What this is
A **native macOS app** that replaces the meeting-management layer of **Fellow** (fellow.app → now fellow.ai), which Delivery Hero pays ~$30k/mo for. Built by Daniel ("Danya") Zherenkov at the request of **Milena** (QC lead) — a high-visibility internal initiative. Codename **"Fellow 2"**.

**MVP scope (v1): local-only, single-user, NO AI/transcription.** Milena writes notes by hand. The value is a faithful, fast, on-device Fellow-style notes/1:1/action-item tool at **$0/seat**.

## The four must-have features (all implemented in the skeleton)
1. **Per-person 1:1 history** — each person has a persistent "Stream" of past 1:1s.
2. **In-meeting checklists** — action items inside the note.
3. **One unified "ultimate" to-do list** — all action items across every meeting, with back-links to source.
4. **Fellow-grade native UX** — this is the priority; match Fellow's look/behavior closely.

## Repo layout
- `docs/` — research + specs. Start at [docs/00-README.md](docs/00-README.md). Key ones: `02` design brief, `03` tech, `04` MVP spec, `06` setup/run, `07` Google Calendar + real-time sync.
- `Fellow2/` — the SwiftUI app source (models, services, `Views/`, `DesignSystem.swift`).
- `Fellow2 - Design/` — a **React/Tailwind prototype** exported from Figma Make (the visual reference; `pnpm i && pnpm dev` to view). NOT the shippable app.
- `project.yml` — **XcodeGen** spec → generates `Fellow2.xcodeproj`.
- `Package.swift` — only a lightweight syntax harness (see Build below).

## Build / run (IMPORTANT for agents)
- **Full Xcode is required** to build/run. `swift build` does **NOT** work for the app: SwiftData/SwiftUI **macro plugins ship inside Xcode**, not Command Line Tools.
- **Syntax-check headlessly** (what to run after edits, since this environment may lack Xcode):
  ```bash
  xcrun swiftc -parse -sdk "$(xcrun --show-sdk-path)" Fellow2/*.swift Fellow2/Views/*.swift 2>&1 | grep "error:" | grep -v "macro"
  ```
  Empty output = syntactically clean. (Macro-not-found errors are expected without Xcode; filter them.)
- **Adding/removing files OR editing `project.yml`** → run `xcodegen generate`, then **reopen the project in Xcode** (it won't pick up a regenerated project file that's already open).
- Editing existing source files → Xcode picks up automatically; just ⌘R.
- ⚠️ `xcodegen generate` can **wipe the Signing Team** (`DEVELOPMENT_TEAM` is blank in `project.yml`) — re-set it in Signing & Capabilities if signing errors appear.
- **$0 dev:** build/run with a **free Apple ID** (Personal Team). The $99/yr program is only for notarized distribution.

## Architecture & conventions
- **SwiftUI + SwiftData**, target **macOS 14+** (dev machine is on macOS 26 "Tahoe"). Pattern: plain SwiftUI + `@Observable`/`@Bindable`, no heavy MVVM.
- **Models** ([Fellow2/Models.swift](Fellow2/Models.swift)): `Person`, `MeetingStream`, `Meeting`, `TalkingPoint`, `ActionItem`. Every entity has UUID + (for sync-readiness) keep `updatedAt`-style fields when extending. `ActionItem.meeting` is the back-link powering the unified list; `ekEventIdentifier` is reused as the external calendar event id (dedupe key).
- **Design tokens** ([Fellow2/DesignSystem.swift](Fellow2/DesignSystem.swift)): adaptive **light/dark** via `Color(light:dark:)`. Use `Theme.*` tokens — **Fellow palette** (primary blue `#2563EB`/dark `#60A5FA`, due `#F59E0B`, now-line `#22C55E`, etc.). Shared components: `AvatarView`, `DueDatePill`, `ActionCheckbox`, `RowMenu`.
- **The meeting note is a FIXED 3-block template** (do not restructure): **Talking Points (○) → Action Items (☐) → Notepad (•)** — [MeetingNoteView.swift](Fellow2/Views/MeetingNoteView.swift).
- **Shell**: top bar + ultra-thin icon rail (Calendar/Actions/People/Meetings, ⌘1–4) + content — [RootView.swift](Fellow2/Views/RootView.swift). Calendar has a Today/Week toggle; re-tapping Calendar collapses the agenda panel.
- **Calendar**: `CalendarService` (EventKit, read import) + `GoogleCalendarService` (direct Google API, behind `#if canImport` so the app still builds without the packages). Sample data seeds on first launch ([SampleData.swift](Fellow2/SampleData.swift)).

## Fidelity rules (match Fellow — the user is detail-oriented)
- Action-item row: **non-hover** = checkbox + text + pill + avatar only; **on hover** = grey rounded bg (fades in, ~0.18s), source/"No series" line, add-assignee icon, `⋮` menu.
- **Checkbox** fills with colour **only when the cursor is on the box itself** (own hover target), no checkmark glyph on hover; bigger rounded square.
- Agenda uses **custom card selection** (light-blue, blue title) — never the default solid-blue `List` selection.
- Always verify visual changes against the screenshots the user shares and `Fellow2 - Design/`.

## Key decisions (don't re-litigate without asking)
- **Local-only v1.** Real-time multi-user collaboration is a later phase — **Firebase** is the agreed direction (Firestore + Google auth; private notes stay private). See [docs/07](docs/07-integrations-and-sync.md).
- **Google Calendar = direct API** via an **Internal OAuth app** in the DH Google Cloud org (no public sharing, no verification; needs DH admin sign-off). EventKit stays as a working fallback. Setup checklist in [docs/07](docs/07-integrations-and-sync.md); paste `GIDClientID` + reversed-client-id URL scheme into `Fellow2/Info.plist`.
- **No AI/transcription in MVP** (explicitly cut). "Ask Fellow" button was removed.

## Gotchas
- The Google code path (`GoogleCalendarService` real branch) **can't be compiled-verified without Xcode + the SDKs**; expect possible minor GoogleSignIn/GTLR API tweaks on first real build. Map GTLR objects to a **Sendable** struct inside callbacks (Swift 6 strict concurrency — already done as `GEvent`).
- `WebSearch` is blocked for this model in some environments; use `WebFetch`.

## Honesty / communication
The user (Danya) wants **facts vs assumptions clearly separated**, and unverified code flagged as such (especially anything not compile-checked here).
