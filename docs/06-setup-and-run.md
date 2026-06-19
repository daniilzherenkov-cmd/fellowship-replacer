# 06 — Setup & Run (Fellow 2 SwiftUI app)

A runnable native macOS skeleton of **Fellow 2** lives at the repo root (`Fellow2/`, `Fellow2.xcodeproj`).

## What's implemented (v0.2 skeleton)
- **Top bar** — workspace switcher, global Search, "Ask Fellow" (stub), light/dark toggle — [RootView.swift](../Fellow2/Views/RootView.swift)
- **Icon-rail navigation** (Calendar · Actions · People · Meetings) with **⌘1–⌘4** shortcuts — [RootView.swift](../Fellow2/Views/RootView.swift)
- **Calendar** — day-agenda panel with **Today/Week toggle**, green "now" line, **week-grid** view, and a **hover event popover** (attendees, Join Meet, RSVP), "Sync calendar" via EventKit — [TodayView.swift](../Fellow2/Views/TodayView.swift)
- **Meeting note — fixed 3-block template** (Talking Points ○ / Action Items ☐ / Notepad •), editable; rows have **hover fill + grey hover + ⋮ edit menu**; action items take assignee + due date — [MeetingNoteView.swift](../Fellow2/Views/MeetingNoteView.swift)
- **Unified "Action items"** across all meetings (Overdue/Today/Upcoming/Inbox) with back-links — [ActionItemsView.swift](../Fellow2/Views/ActionItemsView.swift)
- **People + per-person 1:1 Stream** (history timeline + carried-forward to-dos) — [PeopleView.swift](../Fellow2/Views/PeopleView.swift)
- **Meetings archive** (all meetings, open-todo badges) — [MeetingsArchiveView.swift](../Fellow2/Views/MeetingsArchiveView.swift)
- **Global search** (⌘F) across meetings/people/to-dos — [SearchView.swift](../Fellow2/Views/SearchView.swift)
- **Full light + dark mode** via adaptive tokens — [DesignSystem.swift](../Fellow2/DesignSystem.swift)
- **SwiftData** models + **EventKit** service + seeded **sample data** so it looks alive on first launch.
- Real-time collaboration is deferred to a later phase (**Firebase**, agreed) — see [07](07-integrations-and-sync.md).

## Prerequisites
1. **Install Xcode** (free, Mac App Store). Required to build/run — the SwiftData/SwiftUI macros only resolve under Xcode's toolchain. *(The $99/yr Apple Developer Program is NOT needed for local dev — see [03 §8](03-technical-recommendation.md).)*
2. After installing, point the toolchain at it once:
   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   ```

## Run it
1. Open the project:
   ```bash
   open Fellow2.xcodeproj
   ```
2. In Xcode: select the **Fellow2** scheme → **Signing & Capabilities** → set **Team** to your personal Apple ID (free "Personal Team").
3. Press **⌘R**. The app launches with seeded demo data (Ana / Bo / Sofia, today's meetings, action items).
4. Click **"Sync calendar"** (toolbar, top-right of the agenda list) → grant calendar access → your real meetings import via EventKit.

## Regenerating the Xcode project
The project is generated from [project.yml](../project.yml) by XcodeGen (already installed via `brew install xcodegen`). After adding/removing files:
```bash
xcodegen generate
```

## Notes & limitations (honest status)
- **Not yet type-checked end-to-end.** Syntax parses cleanly (0 errors) and the project generates, but a full compile requires Xcode — expect to fix a few minor SwiftUI/SwiftData type issues on first build. The structure is sound.
- `swift build` / `Package.swift` exist only as a lightweight syntax harness; they **can't** fully build here (no macro plugins without Xcode). Use Xcode.
- The 1:1 Stream currently derives a person's history from their assigned action items (good enough for the demo); wire it to `MeetingStream`/attendees for completeness.
- Calendar is **read-only import** (EventKit). Direct Google Calendar (OAuth) + Meet-link write-back is a later phase — see [07](07-integrations-and-sync.md).
- The week grid lists events under each day (not time-positioned yet); the hover popover timing may need tuning on a real build.
- App icon, real note templates, drag-reorder, and quick-capture are not in the skeleton yet.

## Next steps
- First build in Xcode → fix any type nits → confirm it runs.
- Apply the Figma output (when ready) to the design tokens in [Fellow2/DesignSystem.swift](../Fellow2/DesignSystem.swift).
- Then iterate toward the [MVP acceptance criteria](04-mvp-spec-roadmap.md).
