# 07 — Google Calendar Integration & Real-Time Collaboration

Answers to two architecture questions: (#4) connect Google Calendar **directly** (not via macOS Calendar), and (#5) make a note live for **both** people in a 1:1.

---

## Part A — Google Calendar, connected directly (#4)

### First, a myth to clear up
Reading your calendar through **EventKit does NOT require making your calendar public.** The screenshot you saw ("Make available to public → See only free/busy") is Google's *calendar-sharing* setting — unrelated. Adding your Google account in **System Settings → Internet Accounts** just signs you in via OAuth; nothing becomes public. So EventKit is safe.

**But** your instinct is still right for the *product*: a clean in-app **"Connect Google Calendar"** button (like the modal in your Figma `CalendarPermissionModal`) is a much better flow than asking each user to add their account to macOS Calendar first. So we go **direct to the Google Calendar API.**

### How it works (OAuth 2.0 for a native app, with PKCE)
1. User clicks **"Connect Google Calendar"**.
2. App opens the **system browser** to Google's consent screen (native apps must use the browser, not an embedded webview — Google requires it).
3. User signs in with their **@deliveryhero.com** account and grants the scope.
4. Google redirects back to the app via a **custom URL scheme** (e.g. `com.googleusercontent.apps.<id>:/oauth2redirect`).
5. App exchanges the auth code (+ PKCE verifier) for an **access token + refresh token**; refresh token is stored in the **Keychain**.
6. App calls `GET /calendar/v3/calendars/primary/events` (`events.list`) and maps results → `Meeting`s. Refresh token keeps it working without re-login.

### The key enabler: an **Internal** OAuth app
Create a **Google Cloud project inside the DH organization**, enable the **Calendar API**, and set the OAuth consent screen to **"Internal"**. Consequences:
- Only DH Google accounts can use it.
- **No Google app-verification** needed, and **no "unverified app" warning**.
- Likely needs sign-off from **DH Google Workspace admins** — this is the one real dependency (and the same approval would cover sync below). Worth starting that conversation early.

### Scopes (least privilege)
- v1 (read meetings): `https://www.googleapis.com/auth/calendar.readonly` (or `calendar.events.readonly`).
- Later (create events with Meet links, RSVP — matching Fellow): `calendar.events`.

### Recommended libraries (all SwiftPM)
- **GoogleSignIn-iOS** (supports macOS) — handles the OAuth/PKCE/browser/Keychain flow.
- **GoogleAPIClientForREST/Calendar** (`GTLRCalendar`) — typed Calendar API client.
- Lighter alternative: **AppAuth** (OpenID AppAuth) + raw REST calls if we want fewer Google SDKs.

### Setup checklist (one-time — gives you the 2 values to paste)
1. **Google Cloud Console** → create/choose a project **inside the DH org**.
2. **APIs & Services → Library** → enable **Google Calendar API**.
3. **OAuth consent screen** → User type **Internal** (DH-only; no Google verification). Add scope `.../auth/calendar.readonly`.
4. **Credentials → Create credentials → OAuth client ID → Application type: iOS** (used for macOS too). Bundle ID `com.deliveryhero.fellow2`. Copy the **Client ID** (e.g. `1234-abc.apps.googleusercontent.com`).
5. In **`Fellow2/Info.plist`** replace both placeholders:
   - `GIDClientID` → `1234-abc.apps.googleusercontent.com`
   - URL scheme → the **reversed** client ID → `com.googleusercontent.apps.1234-abc`
6. Packages are already declared in `project.yml`. Run `xcodegen generate`, reopen the project so Xcode resolves **GoogleSignIn** + **GoogleAPIClientForREST**, build.
7. In-app: **Sync ▾ → Connect Google Calendar** → sign in with your DH account → meetings import.

> Until step 5 is done, the app builds & runs on EventKit and "Connect Google Calendar" just shows a hint. **DH Workspace admin** may need to approve the internal OAuth app.

### Where this slots into the code
Replace/augment [Fellow2/CalendarService.swift](../Fellow2/CalendarService.swift) with a `GoogleCalendarService` that:
- exposes `connect()` (runs the OAuth flow) and `isConnected`,
- `fetchEvents(daysBack:daysAhead:)` → upserts `Meeting`s (same dedupe-by-id logic, keyed on the Google event id),
- keeps **EventKit as an optional fallback** for users who'd rather use local calendars or work offline.

> **Cost:** $0 — the Google Calendar API is free at our usage. The only "cost" is the IT approval + a Google Cloud project.

---

## Part B — Real-time, shared between both people (#5)

**Goal:** a 1:1 note (talking points, action items, notepad) that the manager *and* the report both see and edit, ideally live — while the manager's **Private notes stay private**. This is Fellow's collaborative model and it's the **v3** phase (v1 stays local-only).

### Why local-only (SwiftData) can't do this
SwiftData is on-device. Real-time multi-user needs a **shared backend** with auth, storage, and a push channel. Three honest options:

| Option | Real-time | Auth via Google | Data residency (DH) | Effort | Notes |
|---|---|---|---|---|---|
| **Supabase** | ✅ Postgres Realtime (websockets) | ✅ Google OAuth | ✅ **self-hostable** (DH infra/EU) | Medium | Postgres + row-level security; open-source. Best balance for an internal tool. |
| **Firebase (Firestore)** | ✅ live listeners (easiest) | ✅ Google OAuth | ⚠️ Google-hosted only | Low | Fastest to ship; less control over where data lives. |
| **DH-hosted service** | ✅ (build WebSocket/SSE) | ✅ (DH SSO/Google) | ✅ full control | High | Most aligned with DH governance; most work. May be *required* by DH data policy. |

> **CloudKit** (Apple) is deliberately omitted: it keys on iCloud accounts, not DH Google identities, and cross-user sharing is awkward — wrong fit for a team tool.

### Recommended architecture (v3)
- **Identity:** reuse the **Google OAuth** from Part A — same login, so "who can see this note" = real DH people.
- **Data:** mirror the local model to the backend. Each `Meeting`/`Stream` has **participants**; both participants' apps **subscribe to that note's channel** and get changes pushed live.
- **Conflict handling:**
  - Action items / talking points / metadata → **last-write-wins per field** (with `updatedAt`) is plenty.
  - The free-text **Notepad**, if you want true simultaneous typing (Google-Docs-style), needs a **CRDT** — use **Automerge** (or Yjs) for that one block, layered on top of whichever backend. If simultaneous typing is rare, simpler **presence + section-level editing** ("Ana is editing…") avoids the CRDT complexity.
- **Privacy:** the manager's **Private notes** block is **user-scoped** — enforced by row-level security (Supabase) / security rules (Firebase) so it never syncs to the other participant.
- **Offline-first:** keep SwiftData as the local cache; sync in the background and reconcile on reconnect. The UUID + `updatedAt` + soft-delete fields already in [Models.swift](../Fellow2/Models.swift) were added for exactly this.

### If Firebase: what the data storage looks like
Firestore is a NoSQL **document** database (collections → documents → subcollections), with **Google Auth** built in and **live listeners** (`onSnapshot`) that push every change to all participants instantly.

```
users/{uid}                      → { name, email, photoURL }

meetings/{meetingId}             → { title, start, end, kind, googleEventId,
                                     participantUids: [uidA, uidB],   // who can see it
                                     notepad, createdAt, updatedAt }
  talkingPoints/{id}             → { text, isCovered, order, updatedAt }
  actionItems/{id}               → { text, isDone, dueDate, assigneeUid,
                                     sourceMeetingId, order, updatedAt }
  privateNotes/{uid}             → { body }            // manager-only; doc id == owner uid

streams/{streamId}               → { kind, personRef, participantUids, meetingIds: [...] }
```

- **Real-time:** both clients attach an `onSnapshot` listener to a meeting doc + its subcollections → edits appear on the other screen in well under a second.
- **Privacy:** the **Private notes** live in `privateNotes/{uid}` — a security rule allows read/write only when `uid == request.auth.uid`, so they never reach the other participant.
- **Access control (security rules):** a user can read/write a `meeting` only if `request.auth.uid in resource.data.participantUids`.
- **Unified "My To-dos":** a **collection-group query** over all `actionItems where assigneeUid == me && isDone == false`.
- **Offline:** Firestore has a built-in offline cache that syncs on reconnect — so the app still works on a plane and reconciles later.
- **Conflicts:** last-write-wins per field (fine for checkboxes/talking points). For simultaneous typing in the Notepad you'd still add a CRDT later (same as the Supabase plan).

### If "local": how would real-time sync work? (Honest answer: it wouldn't — by itself)
"Local" means SwiftData **on your Mac only**. There's **no server**, so two *different* people fundamentally cannot see each other's notes live — real-time multi-user *requires* shared storage somewhere. So "keep local" and "live for both people" are mutually exclusive.

What local *can* still give you:
- **Across your own devices** (Mac + future iPad): turn on **CloudKit** (SwiftData's `.cloudKit` container) → your data syncs through *your* iCloud. Still single-person, just multi-device.
- **Apple-to-Apple sharing** (`CKShare`): can share a record with another person near-real-time — but both must be on **iCloud**, not DH Google, and the UX is clunky. Not recommended for a team tool.
- Anything truly cross-user and live ⇒ you've left "local" and need Firebase / Supabase / DH-hosted.

**So the real fork is:** *does the MVP need two different people editing the same note?*
- **No (for now)** → keep **local** v1, ship fast, demo. The model already has the fields to add a backend later with no rewrite.
- **Yes** → pick a backend. **Firebase** = fastest to real-time; **Supabase** = same but self-hostable in the EU for DH data rules.

My suggestion: **local for v1** (it's a strong, fast, private personal MVP to impress leadership), then **Firebase or Supabase for the collaboration phase** — Supabase if DH requires EU/self-hosted data residency, Firebase if speed-to-prototype wins.

### Suggested phasing
1. **v3.0 — shared, near-real-time:** backend + Google auth; notes sync within a second or two via the realtime channel; last-write-wins. Covers 95% of the "we both see it" need.
2. **v3.1 — live co-editing of the Notepad:** add Automerge/Yjs for the rich-text block only.
3. **v3.2 — presence & comments:** avatars showing who's viewing, inline comments.

### The decision that drives this
**Where must DH meeting data live, and what backend?** That single answer (Supabase self-hosted in EU / Firebase / DH-hosted) determines the whole stack. Given DH is an enterprise with data-governance rules, I lean **Supabase self-hosted** (Postgres, EU-hostable, Google-OAuth, real-time out of the box) — *unless* DH platform teams already provide a standard backend we should use, in which case use that.

---

## Immediate vs later
- **Now (still v1):** keep EventKit working; it's the zero-dependency path for a demo. Stand up the **Google Cloud internal OAuth app** in parallel (it unblocks both Part A and Part B).
- **Next:** swap calendar to the Google API (Part A).
- **v3:** add the backend + real-time (Part B) once the backend decision is made.

---

## Gotcha: Hardened Runtime silently breaks Calendar access (root-caused 2026-06-16)

**Symptom:** On a fresh Mac (e.g. Milena's), Calendar never syncs. No permission
dialog appears, and "Fellow 2" never shows up under System Settings → Privacy &
Security → Calendars (the list stays empty). Re-Import does nothing.

**Root cause:** `requestFullAccessToEvents()` returns `granted=false, error=nil`
(authorization status stays `.notDetermined`) when the app is built with the
**Hardened Runtime** (`ENABLE_HARDENED_RUNTIME = YES`) but **without** the
`com.apple.security.personal-information.calendars` entitlement. Under the hardened
runtime the Info.plist `NSCalendarsFullAccessUsageDescription` string is **not
sufficient on its own** — the entitlement is also required. (It works without the
entitlement only when the hardened runtime is OFF, which is why old/stale Debug
builds appeared to work.)

**Proven empirically** with three identical ad-hoc EventKit probes:

| Hardened Runtime | `personal-information.calendars` entitlement | Result |
|---|---|---|
| off | — | ✅ prompts, full access |
| **on** | **absent** | ❌ `granted=false`, no prompt, nothing in Privacy list |
| on | present | ✅ prompts, full access |

**Fix (applied):**
- `Fellow2/Fellow2.entitlements` now includes
  `com.apple.security.personal-information.calendars = true`.
- `scripts/build-app.sh` re-sign step now passes
  `--entitlements Fellow2/Fellow2.entitlements` — a bare `codesign --sign -` STRIPS
  entitlements, which silently re-introduced this bug even after the entitlements
  file was correct.

This is the notarization-ready fix (notarization requires the hardened runtime, so
keeping HR on + the entitlement avoids a second migration later). Alternative for
internal-only ad-hoc builds: set `ENABLE_HARDENED_RUNTIME = NO`.

**How to debug TCC issues like this:** `log show` hides tccd messages on recent
macOS, so don't rely on it. Instead build a tiny standalone EventKit probe (a CLI
in a signed `.app` bundle with the usage string), sign it the same way as the app,
run it, and print `EKEventStore.authorizationStatus` + `requestFullAccessToEvents`
results to a file. That isolates signing/entitlements from the app's own code.
