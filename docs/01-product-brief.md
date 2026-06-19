# 01 — Product Research Brief

## 1. What is Fellow?

**Fellow** is a meeting-productivity tool. It launched as a **meeting-management** product (shared agendas, talking points, action items, recurring 1:1s, per-person history) and has since **rebranded and pivoted to an AI-first meeting notetaker**.

- **Verified:** `fellow.app` now **301-redirects to `fellow.ai`**, which positions the product as *"a security-focused AI meeting assistant and notetaker that records, transcribes, and summarizes meetings."* (source: https://fellow.ai/)
- The **classic management layer Milena cares about still exists underneath** the AI marketing — collaborative agendas, talking points, one-on-ones with per-person history, and action items that carry forward. (source: https://fellow.ai/use-cases/one-on-one-meetings, https://fellow.ai/features)

> **Disambiguation result:** "Fellowship" = **Fellow / fellow.app (now fellow.ai)**. The feature set Milena described (per-person 1:1 history, talking points, checklists, rolled-up to-dos) matches Fellow's management product precisely, not Otter/Fireflies/Granola (which are transcription-first and have no per-person 1:1 history model).

## 2. Why people love it (jobs-to-be-done)

Synthesized from Fellow's own positioning (https://fellow.ai/use-cases/one-on-one-meetings, /features) and how this category is used in practice:

1. **"I never lose an action item."** Action items are captured *inside* the meeting note, assigned to a person, and **carried forward to the next meeting** so follow-ups don't get dropped. *(verified: action items are "carried forward to your next meeting for easy follow up" — fellow.ai/use-cases/one-on-one-meetings)*
2. **"My 1:1s have continuity."** Each person has a **running history** of past 1:1s — summaries and notes in one place — so you walk into the next 1:1 knowing exactly where you left off. *(verified: "a library of summaries… of past one-on-ones"; "private between you and your direct report")*
3. **"Meetings start prepared."** A **shared, collaborative agenda** both people contribute to before the meeting, plus templates. *(verified: "Shared agendas attendees can contribute to ahead of time")*
4. **"A private space for the manager."** A **private notes panel** for coaching notes / rapport details not shared with the report. *(verified)*
5. **"One place for everything."** Notes, agendas, decisions, and to-dos live together per meeting rather than scattered across Docs/Notion/Slack.

These five are the emotional core to replicate. The first three map **directly** onto Milena's three must-haves.

## 3. Pricing & the DH cost driver

**Verified** (source: https://fellow.ai/pricing):

| Tier | Price (annual) | Price (monthly) | Notable limits |
|---|---|---|---|
| Free | $0 | $0 | 5 AI notes + 5 recordings (lifetime), 5 seats |
| Team | **$7 / user / mo** | $11 | 10 AI notes/recordings per user/mo, 20 seats |
| Business | **$15 / user / mo** | $23 | unlimited AI notes/recordings, 50 seats |
| Enterprise | **$25 / user / mo** | — (annual only) | unlimited; SSO, HIPAA, admin controls |

**Cost math (assumption, not verified):** ~$30k/mo implies roughly **1,200 seats @ Enterprise ($25)** or **~2,000 seats @ Business ($15)**. Either way, the spend scales **per-seat**, so an in-house, **per-seat-cost-free** native app has a large, recurring savings story for leadership — and most of Fellow's per-seat price funds the *AI/transcription* features that the MVP intentionally **does not** need.

> **Positioning for leadership:** "We replace the part of Fellow our managers actually use every day — structured 1:1s, agendas, and action-item tracking — with a native Mac app that costs us $0/seat and keeps meeting notes on-device. AI notetaking can be added later, on our terms (on-device or our own keys), instead of renting it per seat."

## 4. Competitive landscape (for context / what "good" looks like)

Fellow lists its own comparisons against these (source: https://fellow.ai/). Quick read of where each sits:

| Tool | Primary strength | Has per-person 1:1 history + action-item rollup? |
|---|---|---|
| **Fellow** | Meeting *management* + (now) AI notes | **Yes** — the model we're copying |
| Granola | Lightweight AI notepad (native Mac, beloved UX) | No structured 1:1 streams; great UX reference |
| Otter / Fireflies | Transcription-first | No |
| Fathom | Recording/summaries (sales) | No |
| Notion / Reflect | General docs / PKM | Manual only |

**Takeaway:** No mainstream tool nails Fellow's *structured 1:1 + action-item rollup* model in a **native, on-device, free** Mac app. That's the wedge. **Granola** is the best **UX-quality** benchmark for a native Mac note experience (study it for feel; it is *not* the feature model — Fellow is).

## 5. Recommended MVP feature list

Tied to Milena's four must-haves (per-person 1:1 history · in-meeting checklists · unified to-do list · Fellow-grade UX):

**In (v1):**
- **Calendar sync** → meetings auto-appear (read-only import from the Mac's connected calendars).
- **Meeting note workspace** → rich text + checkboxes, per meeting, autosaved locally.
- **People + 1:1 Streams** → a person directory; each person has a persistent, chronological history of their 1:1 notes.
- **Action items** → checkbox items inside notes that can be assigned to a person + optional due date, with a back-link to their source meeting.
- **Unified "My To-dos"** → one screen aggregating all open action items across every meeting, filterable by person/meeting/due date, with **carry-forward** of unfinished items into the next 1:1.
- **Agenda / talking points** → reorderable bullet items at the top of a meeting, contributable before the meeting.
- **Templates** → a few built-in note/agenda templates (1:1, team sync).
- **Search** → across notes, people, and to-dos.
- **Native polish** → light/dark mode, keyboard-first, fast.

**Cut from v1 (explicit):**
- Audio recording, transcription, AI summaries, AI action-item extraction, "Ask Fellow"-style chat. *(explicitly descoped by Milena)*
- Real-time multi-user collaboration / team cloud sync / sharing & permissions.
- Calendar **write-back**, CRM/Asana/Jira/Slack integrations, analytics, meeting policies.
- Mobile/iOS, Windows, web.

> **Design the v1 data model so v2 (AI notes) and v3 (team sync) bolt on without a rewrite** — see [03 — Technical Recommendation](03-technical-recommendation.md).

## 6. Sources
- https://fellow.ai/ (home; confirms `fellow.app → fellow.ai` redirect & AI repositioning)
- https://fellow.ai/pricing (pricing tiers, verified)
- https://fellow.ai/use-cases/one-on-one-meetings (1:1 model: shared agendas, private notes, carry-forward action items, per-person history)
- https://fellow.ai/features (feature lifecycle: before/during/after meeting)
- https://help.fellow.ai/ (help center; categories: Get Started, Fellow AI, Meetings & Notes, Workspace & Admin, Integrations, Plans & Billing)
