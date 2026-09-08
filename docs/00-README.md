# Fellow Replacement — Research Deliverables

> ## ⚠️ The app is now a WEB app, not native macOS
>
> **To build or run it, start at [`web/README.md`](../web/README.md)** (`cd web && npm install && npm run dev`).
>
> The documents below were written for the original SwiftUI build and are kept
> for the research, design and product decisions they record - most of which
> still hold. But anything describing **how to build, run or ship** the app is
> superseded, and a few specific claims are now wrong:
>
> - **Doc 06** describes the Xcode/SwiftUI build. Obsolete; use `web/README.md`.
> - **Doc 08** covers ad-hoc Mac distribution. The whole Apple track (Developer
>   seat, notarization, MDM) was dropped when the app moved to the web.
> - **Docs 04 and 07** claim UUID / `updatedAt` / soft-delete already exist in
>   `Models.swift`. **They do not** - the web schema adds them.
> - **Doc 04** asserts "all data stays on-device". Going web contradicts this,
>   and that claim was the basis for "no InfoSec review needed".
> - **Doc 09 (RFC)** requested an *iOS-type* OAuth client. A web app needs a
>   *Web application* client - see [12](12-google-oauth-web-request.md).
>
> `Fellow2/` at the repo root remains the **behavioural specification** and is
> genuinely useful for interaction detail; it is no longer developed.

An in-house replacement for **Fellow** (the meeting-notes / meeting-management tool DH pays ~$30k/mo for). MVP = the **management/organization layer** (manual notes, calendar-synced meetings, per-person 1:1 history, checklists, and one unified to-do list). **No audio/AI transcription in v1.**

## Documents
1. [01 — Product Research Brief](01-product-brief.md) — what Fellow is, why it's loved, pricing/cost, the landscape, and the recommended MVP feature list + cut list.
2. [02 — Design Brief for Figma](02-design-brief.md) ⭐ — the primary handoff artifact: IA, screen-by-screen breakdown, component inventory, visual language, macOS-HIG guidance, and reference links.
3. [03 — Technical Recommendation](03-technical-recommendation.md) — native stack, calendar integration, local data model, reusable OSS, architecture.
4. [04 — MVP Spec + Roadmap](04-mvp-spec-roadmap.md) — v1 scope tied to the four must-haves, plus a phased roadmap.
5. [05 — Figma Handoff Pack](05-figma-handoff.md) — design tokens + copy-paste prompts for Figma AI (Make / First Draft).
6. [06 — Setup & Run](06-setup-and-run.md) — how to build/run the SwiftUI **Fellow 2** app skeleton (`Fellow2/`, `Fellow2.xcodeproj`).
7. [07 — Integrations & Sync](07-integrations-and-sync.md) — direct Google Calendar (OAuth) + real-time collaboration architecture.
8. [08 — Build & Hand-off](08-build-and-handoff.md) — free ($0) ad-hoc build for testers (Path A); `scripts/build-app.sh` + [FOR-MILENA.md](FOR-MILENA.md) tester sheet. **(Superseded — macOS only.)**
9. [11 — Fellow export schema](11-fellow-export-schema.md) — what a real Fellow export actually contains, measured. Far less than expected.
10. [12 — Google OAuth request (web)](12-google-oauth-web-request.md) — the credential ask for calendar sync, written to forward as-is.

## Confirmed scope (from Milena, via the requester)
- MVP = **management layer only**; Milena writes notes herself → **no transcription/AI in MVP**.
- **Calendar auto-sync is in scope.**
- ~~**Native macOS** (SwiftUI), not web/Electron.~~ **Reversed:** the app is now a web app. macOS-only excluded Windows/Linux/iPad users, install required walking testers through Gatekeeper and a Hardened Runtime permission bug, and distribution needed an Apple Developer seat plus MDM.
- Must feel like Fellow (UI/UX fidelity is the priority).

## Method & honesty note
Research was done via direct page fetches of fellow.ai and Apple/OSS docs (live web *search* was blocked by an org policy on this model, and `web.archive.org` was unreachable from the fetch tool). Throughout these docs, **verified-from-a-fetched-page** facts are cited with a URL; items drawn from model knowledge or that are recommendations are **labeled as such** so nothing uncertain reads as fact.

_Last updated: 2026-06-02._
