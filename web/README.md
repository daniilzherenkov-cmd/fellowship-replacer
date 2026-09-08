# Fellow 2 (web)

Meeting notes, 1:1 history and a unified action list. A replacement for the
meeting-management layer of Fellow, running in the browser at $0/seat.

This directory is the **live application**. The SwiftUI app at the repo root is
kept as a behavioural reference and is no longer developed - see
[Relationship to the Swift app](#relationship-to-the-swift-app).

---

## Quick start

```bash
cd web
npm install
npm run dev
```

Then open **http://localhost:3000**. You will be signed in automatically as
`danya@deliveryhero.com`.

Requires **Node 20+** (developed on 25.9). No Docker, no local database, no
credentials needed.

### Why `npm run dev` is not just `next dev`

The app verifies a signed Cloudflare Access JWT and **has no development
bypass** - that is deliberate (see [Security model](#security-model)), but it
means a bare `next dev` renders only a "Not signed in" page.

`npm run dev` runs `scripts/dev-with-auth.mjs`, which:

1. generates a throwaway RSA keypair in `.dev/`,
2. serves a local JWKS on port 3002 and points `CF_ACCESS_ISSUER` at it,
3. runs `next dev` on port 3001,
4. proxies port 3000 → 3001, stamping each request with a signed assertion the
   way Cloudflare would.

**The production verification path runs unmodified.** Nothing is stubbed.

Open **port 3000**, not 3001 - 3001 has no injected assertion and shows the
signed-out page.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with injected auth (**use this**) |
| `npm run dev:raw` | Plain `next dev`, no auth - signed-out page only |
| `npm run build` | Production build (`output: 'standalone'`) |
| `npm start` | Run the production bundle locally |
| `npm run test:e2e` | Full test suite (114 tests) |
| `npm run test:e2e:ui` | Playwright UI mode |

Sign in as someone else: `FELLOW_DEV_USER=other@deliveryhero.com npm run dev`.
Useful for checking per-user isolation by hand.

Local data lives in `.dev/dev.sqlite` (gitignored). Delete the file for a clean
slate; the schema is applied automatically on first use.

---

## Tests

```bash
npm run test:e2e              # everything (114 tests, ~35s)
SKIP_WEBSERVER=1 npx playwright test --project=unit   # pure-Node only, ~1s
```

Two projects:

- **unit** - auth crypto, calendar/`.ics` parsing, the Fellow importer, week-grid
  geometry. No browser, no server.
- **ui** - drives the real app in Chromium against SQLite.

The UI tests mint **genuine RS256 tokens** against a local JWKS server, so the
production auth path is what is under test rather than a stub. If Playwright
reports a missing browser, run `npx playwright install chromium`.

---

## Architecture

```
src/
  app/                 Next.js App Router
    (app)/             authenticated shell (top bar + icon rail)
    api/               health, Google OAuth, calendar sync
  components/
    note/              the meeting note - the core screen
    calendar/          agenda + time-proportional week grid
    actions/           unified to-do list
    settings/          calendar connection panels
    ui/                Avatar, Checkbox, DueDatePill, RowMenu
  lib/
    auth.ts            Cloudflare Access JWT verification
    db.ts              MySQL (prod) / SQLite (test) seam
    queries.ts         all data access - every query scoped by owner_email
    calendar.ts        Google Calendar API -> meetings
    ics.ts             .ics feed parsing
    sync.ts            shared write path for both calendar sources
  actions/             Server Actions
sql/schema.sql         schema (applied out-of-band in production)
test/                  Playwright specs + auth harness
```

**Stack:** Next.js 16 (App Router, standalone output), React 19, TypeScript,
Tailwind v4, MySQL in production / SQLite in tests.

Design tokens in `src/styles/globals.css` are ported 1:1 from the Swift app's
`DesignSystem.swift`. **Do not inline hex values in components** - that is what
went wrong in the earlier Figma prototype, where the palette silently drifted.

---

## Security model

The app is deployed on an internal platform where **every app is reachable by
any company SSO account**, and the platform's per-app sharing control is a
documented no-op. Per-user scoping in this app is therefore the only thing
protecting HR-adjacent 1:1 notes.

Consequences, all load-bearing:

- **Verify the signed JWT** (`Cf-Access-Jwt-Assertion`), never the plain
  `Cf-Access-Authenticated-User-Email` header. The plain header is
  perimeter-trusted only and is spoofable off-platform.
- **Fail closed.** No identity means 401. **Never** add a
  `?? process.env.DEV_USER_EMAIL` fallback - that exact pattern is a documented
  full-admin backdoor in another app on the same platform.
- **Every query is scoped by `owner_email`.** There is deliberately no
  "get meeting by id" without an owner check.
- Credentials (Google refresh tokens, `.ics` feed URLs) are AES-256-GCM
  encrypted with a Vault-supplied key. Encryption **refuses to run** without a
  configured key rather than falling back to a constant.

Two tests assert a second user can neither list **nor directly open by id**
another user's meeting. Keep them passing.

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `FELLOW_ENCRYPTION_KEY` | prod | Encrypts stored credentials (32+ chars) |
| `CF_ACCESS_AUD` | prod | Binds tokens to **this** app - see below |
| `CF_ACCESS_ISSUER` | — | Access team domain; defaults to the shared one |
| `APP_ID`, `DB_HOST`, `DB_PORT`, `DB_PASSWORD` | prod | MySQL, injected by the platform |
| `FELLOW_DB_DRIVER=sqlite` | dev/test | **Explicit** opt-in to SQLite |
| `GOOGLE_CLIENT_ID` / `_SECRET` / `_REDIRECT_URI` | optional | Google Calendar OAuth |

> ⚠️ **`CF_ACCESS_AUD` is currently unset in production.** Without it the
> audience check is skipped, so a valid Access token minted for a *different*
> app on the same Access instance would authenticate here. Signature, issuer and
> expiry still hold, so this is narrowed defence rather than an open door - and
> the app logs a warning at startup. Get the value from whoever administers the
> Access application.

`FELLOW_DB_DRIVER` requires an explicit opt-in on purpose. It previously fell
back to SQLite whenever `DB_HOST` was unset, which in a container means a
misconfiguration silently starts an in-memory database that looks healthy and
loses every write.

---

## Calendar

Two paths into the same write layer (`lib/sync.ts`):

**1. Secret `.ics` address** - works today, no approvals. Settings → paste the
address from Google Calendar → *Settings* → your calendar → *Secret address in
iCal format*.

- The URL is a **bearer credential**: it never expires and is not scoped to this
  app. Stored encrypted, never returned to the browser, shown only masked.
- Fetched server-side from user input, so it is restricted to `https` on
  `calendar.google.com` **only** - otherwise the app becomes an SSRF proxy.
- Events marked **private** arrive as "Busy" with no title and no attendees.
  Google strips them server-side, so nothing can recover them; they are detected,
  skipped and counted.
- Google refreshes these feeds slowly, often hours.

**2. Google OAuth** - fully built but **dormant**: it needs a *Web application*
OAuth client, which does not exist yet. See [`docs/12`](../docs/12-google-oauth-web-request.md).
Until the credentials exist, Settings says so and everything else works.

### Parsing traps (already handled - do not "simplify" these away)

- **Recurring events are not expanded** in an `.ics` feed. Without expansion a
  weekly 1:1 shows once and every later occurrence disappears.
- **Moved and cancelled occurrences hide** in `recurrences`/`exdate` rather than
  appearing as their own entries.
- **Google Calendar API**: key on the *instance* `id`, never `recurringEventId`.
  In one sampled week 28 instances shared only 20 series ids, so keying on the
  series would merge 8 separate occurrences into one row and destroy their notes.

---

## Deployment

Deploys go to an internal container platform. **There is no staging - every
deploy ships straight to production**, which is why the test suite is the gate.

Four traps, all hit for real:

1. **`node_modules` and `.next` must be removed before deploy.** The uploader
   ignores `.gitignore`, and including them blows past the 50 MB archive limit
   (558 MB → 648 KB after removal).
2. **The readiness probe targets `/` and accepts only 2xx** - it does not follow
   redirects. A server-side redirect from `/` leaves the pod permanently unready
   while CI stays green and nothing explains why.
3. **Native modules must not reach the production bundle.** `better-sqlite3` is
   test-only; it is installed with `--ignore-scripts` so it has no compiled
   binary, and importing it kills the server at boot. Its specifier is resolved
   at runtime so the build tracer cannot follow it. Excluding it via
   `outputFileTracingExcludes` does **not** work - that leaves a dangling symlink
   which Docker's `COPY` follows and fails on.
4. **`public/` must exist**, or the Dockerfile's `COPY` fails outright.

### Verifying a deploy

A green CI build and a correct image tag prove the **build** worked, not that the
**container runs**. Reproduce the runner stage locally instead:

```bash
npm ci --ignore-scripts && npm run build

# Assemble the runner stage exactly as the Dockerfile does
mkdir -p /tmp/runner
cp -r .next/standalone/. /tmp/runner/
mkdir -p /tmp/runner/.next && cp -r .next/static /tmp/runner/.next/static
cp -r public /tmp/runner/public && cp -r sql /tmp/runner/sql

# Boot it in isolation - no parent node_modules to fall back on
cd /tmp/runner && PORT=8080 NODE_ENV=production APP_ID=x \
  DB_HOST=fake DB_PASSWORD=x FELLOW_ENCRYPTION_KEY=$(openssl rand -hex 32) \
  node server.js
```

`/` and `/api/health` must both return **200**. Running this from the project
directory instead will pass even when the container is broken, because Node
finds the missing native module in the parent `node_modules`.

> **You cannot check liveness with curl.** Every `*.dhapps.ai` URL returns a 302
> to SSO - including subdomains with no app deployed at all - because the access
> layer answers before the container. Only a real browser session can confirm the
> app is serving. `check_deploy_status` is unreliable for the same reason.

---

## Relationship to the Swift app

`Fellow2/` at the repo root is a SwiftUI app, kept as the **behavioural
specification**. It is not maintained and should not be developed further.

Most valuable references:

- `Fellow2/Views/MeetingNoteView.swift` - the interaction spec: `@`-mention
  detection, the three-state checkbox hover, hover-reveal row menus.
- `Fellow2/DesignSystem.swift` - the source of the design tokens.
- `Fellow2/Views/ActionItemsView.swift` - Overdue/Today/Upcoming/Inbox grouping.

**One place where it is the wrong reference:** its `WeekGridView` stacks chips in
day columns, and `docs/06` admits it "lists events under each day (not
time-positioned yet)". The web app's week grid is time-proportional, matching the
real Fellow UI rather than the Swift placeholder.

Two claims in the older docs are **false** and were corrected here: `docs/04` and
`docs/07` state that UUID / `updatedAt` / soft-delete already exist in
`Models.swift`. They do not. `docs/04` also asserts "all data stays on-device",
which going web contradicts.

---

## Known gaps

- **Search (⌘F)** is in the v1 spec and not built.
- **Carry-forward into the next 1:1**: open items are shown on a person's page,
  but there is no "Start next 1:1" action.
- **`CF_ACCESS_AUD`** unset in production (see above).
- Fellow's export carries **no action items, assignees or per-person history** -
  Google strips them. See [`docs/11`](../docs/11-fellow-export-schema.md). The
  importer deliberately does **not** synthesise action items from prose; inventing
  tasks that were never real would hand the user a fake to-do list.
