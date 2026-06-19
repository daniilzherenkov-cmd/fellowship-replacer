# [RFC] Fellow 2 — Access, Licenses & Backend Enablement for the Full Build

**Owner team:** Shop Science (Fellow 2)
**Author:** Daniel ("Danya") Zherenkov
**Sponsor:** Milena (QC lead)
**Related:** `docs/07 — Integrations & Sync`, `docs/04 — MVP Spec + Roadmap`
**Status:** DRAFT — for review

---

## Reviewers

| Team | Reviewer | Required/optional | Status | Comment |
|---|---|---|---|---|
| IT / Google Workspace Admin | _TBD_ | Required | — | Owns Internal OAuth app approval |
| Apple Developer Program (DH) | _TBD_ | Required | — | Owns membership + signing/notarization |
| Platform / Data Engineering | _TBD_ | Required | — | Owns backend + data-residency decision |
| InfoSec / Privacy | _TBD_ | Required | — | Reviews off-device storage of 1:1 notes |
| Endpoint / MDM (Jamf) | _TBD_ | Optional | — | Needed only at rollout (Wave 3) |
| QC Leadership | Milena | Optional (informed) | — | Sponsor |

---

## 1. Preamble

### 1.1 Context
Fellow 2 is a native macOS replacement for **Fellow** (fellow.ai), the meeting-management tool DH currently pays **~$30k/mo** for. The local-only, single-user MVP (manual notes, calendar-synced meetings, per-person 1:1 history, in-meeting checklists, one unified to-do list — no AI/transcription) has been **built and approved by the sponsor (Milena)**.

We now want to move from the local MVP to a **full Fellow replica**: real Google Calendar connectivity, distribution to colleagues, and the collaborative "both people see the 1:1 note" experience. Each of these depends on external access, licenses, or org decisions that the project does **not** currently hold.

### 1.2 Problem statement
The MVP runs entirely on-device (SwiftData + EventKit) and needs no external grants. The full build does:

- **Calendar:** a clean in-app "Connect Google Calendar" flow requires a DH-owned Google Cloud project with an **Internal** OAuth app — which needs Workspace-admin sign-off.
- **Distribution:** running on colleagues' Macs without Gatekeeper warnings requires a **paid Apple Developer Program** seat for signing + notarization (a free Apple ID covers local dev only).
- **Collaboration (v3):** real-time, multi-user notes require a **shared backend** — which forces a **data-residency decision** that is DH's to make, plus an InfoSec review (1:1 notes are sensitive, HR-adjacent content).

These are the blocking dependencies. This RFC enumerates them so the owning teams can grant/decide them in one pass.

### 1.3 Goal
Secure the specific access, licenses, and decisions listed in §3 so the full Fellow 2 build can proceed. The **long-pole** is the Internal Google OAuth app (§3.1) — it unblocks both calendar sync and, later, collaboration auth — so we want that approval started first.

### 1.4 Out of scope
- **Paid Google Calendar API cost** — the API is free at our usage; we are not requesting budget for it.
- **AI / transcription infrastructure** — explicitly cut from scope; not requested.
- **Public Google app verification** — avoided entirely by the Internal OAuth setting.
- Building the BFF/CRDT co-editing layer — a later phase, not an access request.

---

## 2. Why these specific choices (background for reviewers)
- **Internal OAuth (not public):** set the OAuth consent screen to *Internal* so only DH Google accounts can use it → **no Google app-verification and no "unverified app" warning**. The trade-off is it must live inside the DH Google Cloud org and be admin-approved.
- **Notarization (not App Store):** internal tool → direct notarized distribution (Developer ID), not the Mac App Store. Notarization requires the Hardened Runtime, which the app already ships with.
- **Backend fork:** the data-residency answer (EU-self-hosted vs Google-hosted vs DH-platform) determines the whole collaboration stack. We surface it as an explicit decision rather than pre-deciding it.

---

## 3. What we need (access, licenses & decisions)

### 3.1 Google Cloud / Calendar — *long-pole, start first*
| # | Item | Why | Approver | Blocking |
|---|---|---|---|---|
| 1 | Google Cloud project **inside the DH org** | Lets the OAuth app be set to "Internal" | GCP org owner | ✅ |
| 2 | **Google Calendar API** enabled on it | Read (and later create) meetings | GCP project admin | ✅ |
| 3 | OAuth consent screen = **Internal**, scopes `calendar.readonly` (v1) + `calendar.events` (write: Meet links, RSVP) | Calendar sync + Fellow-parity event creation | Workspace admin | ✅ |
| 4 | **OAuth Client ID (type: iOS)** for bundle `com.deliveryhero.fellow2` | Yields the Client ID + reversed-client-id URL scheme pasted into `Info.plist` | GCP project admin | ✅ |
| 5 | **Workspace-admin sign-off** to publish the Internal OAuth app | The real gating approval; also covers collaboration auth later | Google Workspace admin | ✅ |

### 3.2 Apple Developer
| # | Item | Why | Approver | Blocking |
|---|---|---|---|---|
| 6 | Seat on DH's **Apple Developer Program** (Org account, paid $99/yr) | Required for notarized distribution beyond the dev's own Mac | Apple Dev account holder | ✅ (for distribution) |
| 7 | My Apple ID added to the team (Developer role) → real **`DEVELOPMENT_TEAM` ID** | Code signing | Apple Dev admin | ✅ (for distribution) |
| 8 | **Developer ID Application** certificate | What notarization signs against | Apple Dev admin | ✅ (for distribution) |
| 9 | Reserve/confirm bundle id **`com.deliveryhero.fellow2`** (Apple + Google) | Keep OAuth client + signing aligned | Apple/GCP admins | ✅ |

### 3.3 Collaboration backend (v3) — *gated on a decision*
> **Decision required (DH's call):** *Where must DH meeting data live, and on what backend?*
> Options: **Supabase self-hosted in EU** (recommended if residency rules apply — Postgres, EU-hostable, Google OAuth, real-time built in) · **Firebase/Firestore** (fastest, Google-hosted only) · **DH-hosted/standard platform** (most governance-aligned, most work — may already exist).

| # | Item | Why | Approver | Blocking |
|---|---|---|---|---|
| 10 | **Backend decision** (per the fork above) | Determines the entire collaboration stack | Platform / Data Eng | ✅ (for v3) |
| 11 | Provisioning per the choice: Firebase project **or** EU infra to self-host Supabase **or** onboarding to the DH standard backend | Where shared notes live | Platform / DevOps | ✅ (for v3) |
| 12 | Confirm app login can **reuse the Google OAuth** from §3.1 (or SSO/Okta details if mandated) | Identity = real DH people for note access control | IT / IAM | ✅ (for v3) |
| 13 | **InfoSec / privacy review** + data-classification for off-device 1:1 notes | Sensitive content leaving the device | InfoSec | ✅ (for v3) |

### 3.4 Distribution at scale (Wave 3)
| # | Item | Why | Approver | Blocking |
|---|---|---|---|---|
| 14 | **MDM / Jamf** push + pre-approved calendar/TCC permissions | Smooth rollout to colleagues vs. manual installs | Endpoint team | ⬜ (rollout only) |

---

### 3.5 Deployment & build infrastructure
*Distinct from §3.4: that is "push to the fleet"; this is the build → sign → host → auto-update pipeline.*

| # | Item | Why | Approver | Blocking |
|---|---|---|---|---|
| 15 | macOS build/CI runner with Xcode (DH self-hosted Mac, or GitHub Actions macOS runners) | Builds must run on macOS with full Xcode — SwiftData/SwiftUI macros ship in Xcode, not Command Line Tools | Platform / CI team | ✅ (release) |
| 16 | App Store Connect API key + secure secrets storage (signing certs, keys) wired into CI | Automated, repeatable signing + notarization in the pipeline | Apple Dev admin / Platform | ✅ (release) |
| 17 | Artifact / release hosting for the `.dmg`/`.zip` (DH artifact registry, or a GCS/S3 bucket) | Somewhere to publish downloadable builds for testers and rollout | Platform / DevOps | ✅ (release) |
| 18 | Auto-update feed — **Sparkle** appcast hosting + EdDSA signing key | Fellow-parity silent auto-updates, no manual reinstall per release | Platform / DevOps | ⬜ (fast-follow) |
| 19 | Repo in the DH GitHub org + CI minutes | Source control + a place to run the build/release pipeline | Eng / GitHub admin | ✅ (release) |

## 4. Rollout / phasing
- **Wave 1 — full-feature build (now):** §3.1 + §3.2. Until granted, the app keeps working on EventKit; "Connect Google Calendar" shows a hint. Start the §3.1 admin approval immediately.
- **Wave 2 — collaboration (v3):** §3.3, after the backend decision lands.
- **Wave 3 — fleet rollout:** §3.4, once distribution is signed off.

## 5. Risks & mitigations
- **Workspace-admin approval is the long-pole** → start the §3.1 conversation before anything else; everything calendar- and auth-related waits on it.
- **`calendar.events` (write) may trigger heavier admin review** than read-only → we can ship Wave 1 on `calendar.readonly` and request write scope as a fast-follow if it stalls.
- **Data residency unknown** → we do not pre-build a backend; we request the *decision* first (§3.3, #10), keeping SwiftData as the offline cache so no rework is needed.
- **InfoSec sign-off can gate v3** → engage InfoSec in parallel with the backend decision, not after.

## 6. Open decisions for reviewers
1. **Calendar write now, or read-only first?** (scope = `calendar.events` vs `calendar.readonly`)
2. **Who owns the backend choice** — is there a standard DH backend we must use, or is this ours to propose?
3. **Confirm bundle id** `com.deliveryhero.fellow2` is free to reserve.
