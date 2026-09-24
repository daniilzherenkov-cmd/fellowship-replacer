# Fellow Hero - Project Context (read me first)

> **The app is a web app, in `web/`.** Read [`web/README.md`](web/README.md),
> then `cd web && npm install && npm run dev` (port 3000, auto signed-in).
>
> Three rules that are easy to get wrong, all with real incident history:
> - **Never** add a `?? process.env.DEV_USER_EMAIL` auth fallback. Fail closed.
> - **Every** query filters on `owner_email`. There is no unscoped read path.
> - Native modules must not reach the production bundle. There are none left;
>   keep it that way (see Gotchas).

## What this is
A web app replacing the meeting-management layer of **Fellow** (fellow.app),
which Delivery Hero pays ~$30k/mo for. Built by Daniel ("Danya") Zherenkov at
the request of **Milena** (QC lead). Codename **Fellow Hero**, deployed at
<https://fellow2.dhapps.ai>.

**MVP scope: single-user, NO AI/transcription.** Notes are written by hand. The
value is a faithful, fast Fellow-style notes/1:1/action-item tool at $0/seat.

⚠️ Data lives in a server-side database. 1:1 notes are HR-adjacent, and the
host admits any company SSO account to every app, so **per-user scoping in the
app is the only barrier**. Keep the deployment a **prototype** until a properly
access-controlled backend is agreed. `CF_ACCESS_AUD` is still unset, which
means an Access token minted for another `*.dhapps.ai` app is accepted here.

## The four must-have features
1. **Per-person 1:1 history** - each person has a persistent stream of past 1:1s.
2. **In-meeting checklists** - action items inside the note.
3. **One unified to-do list** - every action item, with back-links to source.
4. **Fellow-grade UX** - the priority. Match Fellow's look and behaviour closely.

## Repo layout
- **`web/` - the live application** (Next.js). Start at [web/README.md](web/README.md).
- `docs/` - research and specs. Start at [docs/00-README.md](docs/00-README.md).
  Recent: `13` post-launch fixes. Key: `02` design brief, `04` MVP spec,
  `11` Fellow export schema, `12` Google OAuth request.
- `Fellow2 - Design/` - React/Tailwind prototype exported from Figma Make, the
  **visual reference** (`pnpm i && pnpm dev`). Not the shippable app.

The SwiftUI source (`Fellow2/`), `project.yml` and `Package.swift` were
**deleted on 2026-09-23**. The app had been a web app for weeks and the Swift
tree was dead weight. It is in git history if a behavioural detail is ever
needed: `git log --all -- Fellow2/`.

## Build / run

**Node 24.** Pinned in `.nvmrc`, `package.json` engines and the Dockerfile, and
they must move together. The image was on Node 20 until 2026-09-23, five months
after it went end-of-life, so production ran unpatched. With `fnm` installed,
`fnm use` in `web/` picks the right version from `.nvmrc`.

```bash
brew services start mysql   # once per boot
cd web
fnm use                     # Node 24, per .nvmrc
npm install
npm run db:setup            # creates fellow_dev, its user, and the schema
npm run dev                 # port 3000, auto signed-in
npm run test:e2e            # full suite
npm run screens:connect     # screenshots of the connect prompts
```

**MySQL is required** for both dev and tests. There is no SQLite fallback any
more (see Gotchas). Local credentials default to database `fellow_dev`, user
`app_fellow_dev`, password `fellowdev`, all localhost-only.

## Architecture and conventions
- **Next.js App Router** + React Server Components, **MySQL** via `mysql2`.
- **Auth**: Cloudflare Access JWT, verified against JWKS. Fails closed.
  `requireIdentity()` is the only way to learn who is asking.
- **Database seam**: every query goes through `getDb()` in
  [web/src/lib/db.ts](web/src/lib/db.ts). Schema DDL is never run from app
  code; [web/sql/schema.mysql.sql](web/sql/schema.mysql.sql) mirrors production
  and is applied out of band via the Protoship `execute_sql` MCP tool.
- **Secrets** come from Vault at boot via `instrumentation.ts`, NOT from
  container env vars.
- **The meeting note is a FIXED 3-block template** (do not restructure):
  Talking Points (○) → Action Items (☐) → Notepad (•).
- **Shell**: top bar + ultra-thin icon rail (Calendar/Actions/People/Meetings)
  + content. Calendar has a Today/Week toggle.

## Fidelity rules (match Fellow - the user is detail-oriented)
- Action-item row: **non-hover** = checkbox + text + pill + avatar only;
  **on hover** = grey rounded bg (~0.18s), source line, add-assignee icon, `⋮`.
- **Checkbox** fills with colour only when the cursor is on the box itself.
- Agenda uses **custom card selection** (light-blue, blue title), never the
  default solid-blue list selection.
- **Show every calendar event.** Fellow displays declined meetings struck
  through, all-day events, and solo blocks like "gym". Filtering them out made
  the app look wrong next to Google.
- Always verify visual changes against screenshots the user shares and
  `Fellow2 - Design/`.

## Key decisions (don't re-litigate without asking)
- **Google Calendar = direct API** via an Internal OAuth app in the DH Google
  Cloud org. Credentials are in Vault.
- **No AI/transcription in MVP** (explicitly cut).
- **Two features are blocked on the same unrequested OAuth scope. Ask for
  them together, once.** The current client only has `calendar.events`.
  Anything about *people* rather than *events* needs a People API / directory
  scope, which means a new consent screen and another DH admin approval
  (Anubha Gupta created the current client, project `quick-commerce-data`).
  Both of these are deliberately unbuilt, not forgotten:
  1. **Directory attendee search.** Fellow's event-creation picker searches the
     whole Workspace directory and finds people you have never met. We search
     only the `person` table, i.e. anyone from a synced calendar event.
     Decided 2026-09-23.
  2. **Real profile photos.** Avatars are generated initials on a hashed
     colour. Google's actual photos come from the People API
     (`people.get` with `personFields=photos`), same scope family.

  **Do not raise these as two separate asks.** One request covering directory
  search plus profile photos, or neither. Until then, both fall back
  gracefully and nothing is broken - the narrow search works and initials
  render fine, so there is no urgency to chase the approval.
- **"Registered user" is inferred, not stored.** There is no user table. A
  person counts as registered when their email matches an owner with a
  `google_connection` row, i.e. they have connected a calendar to this app.
  Used to sort the `@` picker. `FILTER_TO_REGISTERED` in `MeetingNote.tsx`
  switches it from sorting to hard filtering; leave it off until more than one
  person uses the app, or the picker shows a single name.
- **Calendar write-back is now IN scope** (reversing [docs/01](docs/01-product-brief.md) §5,
  decided 2026-09-23). The existing `calendar.events` scope already allows
  writes, so no new consent is needed.
- **There is NO scheduler on this platform.** No cron, no background worker,
  no queue: the pod only answers HTTP requests. Anything that must happen at
  a particular moment without a user present is impossible here as deployed.
  This already shapes two features:
  - **Meeting reminders** are real OS notifications fired from an open tab
    (`MeetingReminders.tsx`), NOT Web Push. Real push needs a service worker,
    VAPID keys, stored subscriptions **and** a server-side timer to send
    them; the first three without the fourth would never fire. The limitation
    is stated in the Settings panel itself, deliberately.
  - Calendar sync is polled for the same reason (below).

  If a scheduler ever appears - a Protoship cron, an external trigger hitting
  an endpoint, a small worker - both become straightforward. Worth raising
  with Narbeh as a platform question rather than engineering around.
- **Sync is polled, not pushed.** Google's `events.watch` needs a public
  endpoint it can POST to, and every `*.dhapps.ai` URL answers 302 to Okta, so
  push is impossible until an Access-exempt path is agreed. The ladder in place
  is sync-on-connect, throttled sync-on-load, and a 5-minute interval.

## Gotchas
- **Protoship deploys from `~/.protoship/apps/fellow2/`, NOT the git repo.**
  Always rsync `web/src/` across first, then confirm the commit really carries
  the change.
- **`deployed: true` proves nothing.** The pod lags minutes behind, `curl`
  returns 302 to Okta for every URL, and `check_deploy_status` reports
  `waiting_for_dns` for healthy apps. Verify via the `Update <app_id> image
  tag` commit on `deliveryhero/dh-ets-ei-protoship` main, then the browser.
- **`CMD` must be an ABSOLUTE path** in the Dockerfile.
- **No native modules.** `better-sqlite3` was the only one and cost two
  outages: with `--ignore-scripts` it has no compiled binary and killed the pod
  at boot, and excluding it from tracing left a dangling symlink that broke the
  Docker build. If you ever add one, prune it before tracing.
- **Dev and production must run the same SQL dialect.** `meeting_id IS ?` is
  valid SQLite and a syntax error in MySQL; it shipped broken while 128 tests
  stayed green. That is why SQLite is gone, and why
  [web/test/e2e/dialect.spec.ts](web/test/e2e/dialect.spec.ts) statically scans
  for dialect traps.
- **New pure-logic specs must be added to `UNIT_SPECS`** in
  `playwright.config.ts`, or they silently run as slow browser tests.
- The dev proxy's HMR WebSocket is broken (`WS_ERR_EXPECTED_MASK`), which can
  make click handlers look dead under `npm run dev`. Not an app bug; the
  production build is fine.

## Honesty / communication
Danya wants **facts and assumptions clearly separated**, and unverified code
flagged as such. **Never use an em-dash or en-dash** in any output, chat or
file. No individual names in PR descriptions.
