# 17 - Pre-launch audit

Written 2026-09-24, before letting a test group of real users in.

Ordered by what would actually go wrong, not by how interesting the bug is.
Everything here was checked against the code or production, not recalled.

---

## P0 - fix before anyone else logs in

### 1. ~~Creating an event sends REAL calendar invites~~ WITHDRAWN

`createEvent` sets `sendUpdates=all` and the dialog ticks "also add to my
Google Calendar" by default, so a tester who adds a guest and saves sends a
genuine invite.

**Checked against Fellow, and this is correct behaviour.** Fellow's own
Create event panel writes to Primary Calendar and adds participants with no
opt-out at all; sending real invites is the thing being matched. Ours is
arguably clearer for having a checkbox. Decision 2026-09-24: leave as is.

### 2. ~~The app is sized and scaled for one user~~ WITHDRAWN, plus a real bug

**Withdrawn.** I called the 200MB budget a blocker without measuring it. A
previous session already had: **~98MB RSS measured**, recorded in
`tooling/protoship_platform_internals.md` as "the default `memory: 200` is
fine and no `app.yaml` bump is needed". With the subscriber caps now in
place, this holds for a small test group. No PR to the platform repo is
needed, and no MCP tool can change scaling anyway (the surface is auth,
create, deploy, database, secrets, sharing, logs).

**But reading the Dockerfile to check turned up a real one.** It said:

```dockerfile
# Keep V8's heap under the cgroup limit so an OOM is a clean JS error rather
# than a silent SIGKILL that stalls the readiness probe.
ENV NODE_OPTIONS="--max-old-space-size=300"
```

300 against a `memory: 200` limit: the exact opposite of what the comment
claims. V8 would grow past the container ceiling and be SIGKILLed by the
cgroup, producing the silent death the line exists to prevent. Lowered to
**128**, which leaves room for the ~60-70MB of non-heap RSS inside 200.

`max: 1` is still load bearing for correctness: the shared-note hub keeps
channels in process memory, so raising it without moving to Redis pub/sub
would silently split viewers across replicas.

### 3. CF_ACCESS_AUD: deliberately left unset

Decision 2026-09-24: **open to anyone with the link.** Not a notes
disclosure risk, because every query filters on `owner_email` and a foreign
token authenticates as its own holder. The consequence is that anyone at
Delivery Hero who finds the URL can use the app and create their own
workspace. Accepted for a prototype.

---

## P1 - abuse and resource limits

### 4. No length limit on anything a user types

`notepad`, `private_notes`, talking points, action items and `shared_note`
are all `mediumtext`, which is **16MB**. Nothing validates length on the way
in. The ICS import path has `MAX_EVENTS` and `MAX_FEED_BYTES`; the app's own
write paths have nothing.

Worst case is not the storage, it is the fan-out: a large paste into a shared
note is broadcast in full to every subscriber on that channel, through a pod
with 200MB of memory.

**Fix:** cap at something like 64KB per field, rejected server-side, with a
clear message rather than silent truncation.

### 5. No rate limiting anywhere

No endpoint, action or channel is rate limited. The shared-note write fires
on a 400ms debounce, so a held key is a write every 400ms per user, each one
a database write plus a broadcast.

**Fix:** at minimum a per-owner write throttle on `writeSharedNoteAction`.

### 6. No cap on SSE subscribers

`note-hub` holds an unbounded set per channel and there is no per-user limit.
A user with many tabs open holds many streams. HTTP/2 allows far more
concurrent streams than the old six-per-domain limit.

**Fix:** cap subscribers per channel and per user, and reject beyond it.

---

## P2 - correctness and hygiene

### 7. `removePushSubscriptionAction` does not check ownership

It calls `me()` for authentication and then deletes **by endpoint alone**. Any
authenticated user could remove another user's subscription if they knew the
endpoint. Endpoints are 188-character unguessable URLs, so this is not
practically exploitable, but the gap is gratuitous and the code comment
rationalises it, which is how these survive.

**Fix:** scope the delete by `owner_email` as well.

### 8. Shared-note membership can never be revoked

`syncSharedNoteMembers` is additive on purpose, so a churning attendee list
does not silently cut someone off mid-conversation. The consequence is that
**there is no way to remove someone through the app**, only by hand in SQL.

For a test group this matters: a mis-seeded membership is permanent until
someone runs a DELETE.

**Fix:** decide the revocation rule deliberately. "Removed from the invite
for N days" is defensible; never is not.

### 9. The shared-note queries do not enforce their own gate

`getSharedNote` and `writeSharedNote` take an `external_id` and act on it.
The membership check lives in the two callers. That IS the intended design
(one rule, one place), and it is correct today, but a third caller added
later would bypass it silently.

**Fix:** either take the caller's email and check inside, or name them
`...Unchecked` so the requirement is impossible to miss.

---

## Also true, not bugs

- **v28 never built.** The reminder claim-release fix is committed and pushed
  but no Drone build exists for it; production runs v27. Not harmful, but the
  fix is not live.
- **16 files are uncommitted** on the PR branch: the shared-notes work and
  the claim fix, added after the PR was opened.
- **Two Google scopes remain unrequested** (directory search, profile
  photos). Both degrade gracefully. See CLAUDE.md.

## Suggested order

1. Default the Google invite checkbox OFF (minutes, prevents the worst outcome)
2. Set `CF_ACCESS_AUD`
3. Raise the memory budget
4. Length caps, then a write throttle
5. The P2 items, which are cheap and can follow the group in
