# 16 - Real-time shared notes: design

Written 2026-09-24. Milena's original ask, and the last item that changes the
architecture rather than adding to it.

This supersedes the pessimistic framing in [14](14-fellow-parity-gap.md) §5.
Two of the three blockers turned out to be smaller than stated, and the third
was wrong. The corrections are recorded below because the reasoning matters
more than the conclusion.

---

## What changed since doc 14

**1. There is already a canonical shared key.** Doc 14 said this needed "a
schema change touching the core table, plus a migration for the 1528 rows".
Wrong. Google gives every attendee the **same event id**, so the same
`external_id` already appears in both owners' rows. Measured on production
2026-09-24:

```sql
SELECT COUNT(*) FROM (
  SELECT external_id FROM meeting
   WHERE external_id IS NOT NULL AND deleted_at IS NULL
   GROUP BY external_id HAVING COUNT(DISTINCT owner_email) > 1) t;
-- 29
```

29 meetings are already dual-owned, e.g. `gcal:058c7ifau174e91a64oo10qhfi`
("Blocker Central All Hands") exists once per owner with the same
`external_id`. **No mapping table and no migration are needed.**

**2. Sharing does not have to touch the 40 owner-scoped query sites.** Doc 14
framed this as replacing a grep-verifiable invariant everywhere. It does not,
provided shared content lives in its OWN table keyed on `external_id`. The
existing 40 `owner_email = ?` sites stay exactly as they are, and the
authorization decision happens once, at channel join.

**3. `CF_ACCESS_AUD` is not a notes-disclosure risk.** Repeatedly overstated
in earlier notes. With it unset, someone holding an Access token for another
`*.dhapps.ai` app authenticates here **as themselves**; every query filters on
`owner_email`, so they see their own empty workspace, not anyone's notes. The
real risk is narrower and still worth fixing: a person never granted Fellow
Hero can use Fellow Hero.

---

## The model

Split what is shared from what is not. **This line already exists in the
schema**: `private_notes` shipped 2026-09-23.

| Content | Scope | Lives in |
|---|---|---|
| Talking points, action items, notepad | **Shared** with the meeting's participants | new `shared_note`, keyed on `external_id` |
| `private_notes` | **Never shared** | `meeting`, owner-scoped, as today |
| Everything else (`person`, reminders, sync state) | Owner-scoped | unchanged |

That is Fellow's own split: a collaborative agenda plus a private manager
panel.

### Schema, additive only

```sql
CREATE TABLE shared_note (
  external_id  varchar(400) NOT NULL PRIMARY KEY,
  content      mediumtext   NOT NULL,
  -- Last-write-wins needs a tiebreaker and an author for the UI.
  updated_at   varchar(32)  NOT NULL,
  updated_by   varchar(320) NOT NULL
);

-- Who may join. Written at sync time from the calendar's attendee list, so
-- membership is derived from the invite rather than asserted by a client.
CREATE TABLE shared_note_member (
  external_id  varchar(400) NOT NULL,
  email        varchar(320) NOT NULL,
  PRIMARY KEY (external_id, email)
);
```

Nothing above alters `meeting`. A meeting with no `shared_note` row behaves
exactly as it does now, so the feature can ship dark.

## Who may join a channel

**Working rule: the meeting's own attendees, as recorded on the calendar
event.** Not "anyone with the id", not "anyone in the workspace".

Evidence, and its limits. Fellow's 1:1 page states notes are *"kept private
between you and your direct report"*, and its agenda copy says *"shared
agendas attendees can contribute to ahead of time"*. Both point at attendance
being the default grant. What is NOT verified is whether Fellow grants
automatically or requires the explicit **Share** button visible in its
header: the public docs describe admin RBAC and never state calendar
inheritance outright.

⚠️ **Confirm before building:** open a 1:1 in Fellow, click Share, and see
whether the other attendee already has access before doing anything. If yes,
attendance is the default grant and the rule below is right. If no, sharing
is opt-in per note and `shared_note_member` should be populated by an
explicit action instead of at sync time. **The table shape is the same
either way**, which is why this can be settled late.

The authorization check lives in exactly one place:

```
on channel join (external_id, caller):
  caller.email IN (SELECT email FROM shared_note_member WHERE external_id = ?)
```

Membership is written server-side during calendar sync from the event's
attendee list. A client never asserts who it is allowed to see.

## Conflict handling: last-write-wins

Agreed as the starting point. Honest about what it means: two people typing
in the same paragraph at the same instant, one loses those keystrokes.
Acceptable for two people in a 1:1 who are talking to each other; not
acceptable for a document with eight editors.

Mitigations that cost almost nothing:
- Broadcast on a short debounce, not per keystroke, so the losing window is
  small.
- Show "X is editing" from channel presence, which prevents most collisions
  socially rather than technically.
- Store `updated_by` so the UI can say who last wrote.

A CRDT (Yjs) is the upgrade path and slots in behind the same table. Not
worth it for two people.

## Transport: in-process WebSockets

Recommended, for the same reason the push scheduler works: `app.yaml` pins
this service to `min: 1, max: 1`, so one always-on replica holds all channel
state in memory with no coordination problem.

Considered and rejected:
- **Firebase** ([docs/07](07-integrations-and-sync.md)'s original suggestion).
  A second datastore, a second auth model and a third party holding
  HR-adjacent notes, to solve a problem one process can already solve.
- **Polling.** Simple, but "real-time notes" that lag five seconds are not
  the feature.
- **Server-Sent Events.** Fine downstream, still needs POSTs upstream. A
  WebSocket is less machinery overall.

⚠️ **The single-replica assumption must not become invisible.** If `max` is
ever raised above 1, clients on different replicas stop seeing each other,
and silently. The push scheduler survives that case by design (its
`reminder_sent` primary key makes duplicate sends impossible); this would
not. Whatever is built should assert the assumption loudly at boot rather
than degrade quietly.

## Suggested sequence

1. **Confirm the Fellow sharing rule** (thirty seconds, above).
2. `shared_note` + `shared_note_member`, populated at sync. No UI. Ships dark.
3. Read path: when a `shared_note` exists, the note renders from it. Still no
   writing, still no socket. Behaviour is unchanged for everyone.
4. WebSocket channel with the join check, last-write-wins, presence.
5. Only then, the UI affordance that says a note is shared.

Steps 2 and 3 are reversible and carry no risk. The decision point is step 4.

## Still worth doing first

Not blockers, but cheap and they make this safer:
- **Set `CF_ACCESS_AUD`.** Not the notes risk it was described as, but it
  governs who can get a foothold at all, which matters more once anything is
  shared.
- **Commit the work.** Shared notes is the first change here that could
  disclose data if it went wrong. Doing it on top of ~110 uncommitted files
  with no history to bisect is the actual risk in this plan.
