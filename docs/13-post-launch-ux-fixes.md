# 13 - Post-launch fixes, first real-calendar feedback

Written 2026-09-23, after the first sync against Danya's real Google Calendar.
Eight issues raised. This is the investigation and the plan, not the fix.

Confidence is marked per item. **Verified** means traced to a specific line.
**Hypothesis** means a plausible cause that has not been reproduced.

---

## Summary table

| # | Issue | Root cause | Confidence | Effort |
|---|---|---|---|---|
| 4 | Cannot create an action item | `IS ?` is SQLite-only, invalid in MySQL | **Verified** | S |
| 8 | Arrows do not move the week grid | Arrows shift 1 day, grid is keyed to the week | **Verified** | S |
| 7 | Meetings missing vs Google | `skipSolo` + primary-calendar-only | **Verified** | M |
| 1 | No feedback after sync | Feedback exists but is easy to miss | Hypothesis | S |
| 2 | Connect button on /calendar | Already shipped in v14; hidden because connected | **Verified** | none |
| 6 | Sync is not automatic | No scheduler exists at all | **Verified** | M/L |
| 3 | `@` does not link a person | Never implemented | **Verified** | M |
| 5 | No upcoming-meeting notification | Never implemented | **Verified** | M |

---

## 4. Action items cannot be created (BUG, ship first)

`src/lib/queries.ts:410`:

```sql
SELECT MAX(sort_order) AS m FROM action_item
WHERE owner_email = ? AND meeting_id IS ?
```

`meeting_id IS ?` is valid SQLite. In **MySQL, `IS` only accepts NULL / TRUE /
FALSE / UNKNOWN**, never a bound parameter, so this is a syntax error and the
server action throws. Talking points work because `addTalkingPoint` uses
`meeting_id = ?` (`queries.ts:346`).

This is why **local tests pass and production fails**: dev is SQLite
(`FELLOW_DB_DRIVER=sqlite`), production is MySQL. It is the only `IS ?` in the
codebase.

The `IS` was presumably chosen because `meeting_id` is nullable for standalone
action items, where `= ?` would never match NULL. So the fix must branch:

```ts
const clause = meetingId === null ? 'meeting_id IS NULL' : 'meeting_id = ?'
const args = meetingId === null ? [ownerEmail] : [ownerEmail, meetingId]
```

**Test gap worth closing at the same time:** the whole suite runs on SQLite, so
no test could have caught this. Consider a small dialect-lint test that fails
on `IS ?` anywhere in `queries.ts`, which is cheap and catches the whole class.

## 8. Arrows move the agenda but not the week grid (BUG)

`shiftDay()` (`CalendarView.tsx:74`) always moves `selectedDate` by one day.
The agenda filters by exact day so it updates, but `WeekGrid` is built from
`weekDaysFor(selectedDate)`, which only changes when the shift crosses a week
boundary.

**Fix:** step by 7 in week mode.

```ts
function shiftDay(delta: number) {
  const next = new Date(selectedDate)
  next.setDate(next.getDate() + delta * (mode === 'week' ? 7 : 1))
  setSelectedDate(next)
}
```

Also update the arrow `aria-label`s, which currently always say "Previous day"
and "Next day".

## 7. Meetings missing compared with Google

Not a sync failure. Three deliberate filters in `normaliseEvent`
(`src/lib/calendar.ts:165`) plus a scope limit:

| Filter | Default | Effect on Danya's Wed 23 |
|---|---|---|
| `skipDeclined` | on | drops **UX Research** (struck through in Google) |
| `skipAllDay` | on | drops all-day banners |
| `skipSolo` | on | drops **Lunch**, **gym**, and any meeting with no other attendee |
| `calendarId` | `'primary'` only | any secondary calendar is invisible |

`skipSolo` is the big one: it removes the user's own focus blocks. Reasonable
for a meetings tool, wrong if Fellow shows them.

**Decision needed from Danya before coding.** Options, cheapest first:
1. Flip `skipSolo` off by default. One line, brings back Lunch and gym.
2. Add user-facing toggles in Settings for each filter. Honest and matches how
   Fellow lets you pick calendars.
3. Read `calendarList` and sync every selected calendar, not just primary.
   Largest change: the sync token is per calendar, so `google_connection`
   needs a token per calendar rather than one column.

Recommend 1 now, 2 next, 3 only if he actually keeps meetings elsewhere.

## 1. No feedback after "Sync now" (needs reproduction)

Feedback IS implemented in both places, so this is about visibility, not a
missing feature:

- Calendar icon: `SyncToast`, absolutely positioned under the button. It does
  **not** auto-dismiss, despite a comment in `SyncButton.tsx` claiming it does.
  The comment is wrong; there is no timer.
- Settings "Sync now": a 12px secondary-colour line reading "Calendar synced."
  below the buttons. Easy to miss.

`summarise(0, 0)` returns "Already up to date", so even a no-op sync has copy.

**Cannot confirm which control was clicked or why nothing was seen.** Needs a
reproduction against a production build. Candidates: the settings line is too
quiet, or the toast is clipped by the agenda's `overflow-auto`.

**Fix regardless of cause:** make success loud and consistent in both places,
give the toast a real auto-dismiss (matching its own comment), and show the
row count. Add a UI test that asserts the readout appears, which nothing
currently covers.

## 2. Connect button on /calendar - ALREADY SHIPPED

Delivered in v14 as `src/components/calendar/ConnectPrompt.tsx`: a first-run
modal plus a persistent card in the agenda column. Both render only when the
deployment is configured AND the user is not connected.

Danya is now connected, so **both are correctly hidden**. Nothing is broken.
To see them, disconnect, or add a `?preview=connect` escape hatch for
screenshotting. Still true that nobody has laid eyes on them.

## 6. Sync is not automatic

**There is no scheduler of any kind.** Sync runs only from the two manual
buttons. Connecting the account does not even trigger a first sync, which is
why the calendar looked empty until the button was pressed.

**Near real-time is harder than it looks here.** Google's push channels
(`events.watch`) need a public HTTPS endpoint Google can POST to. Every
`*.dhapps.ai` URL sits behind Cloudflare Access and returns 302 to Okta, so
Google could never deliver a notification. Verified by `curl` during the
deploy work.

Realistic ladder, each step independently useful:
1. **Sync on connect.** The callback fires one sync before redirecting. Removes
   the empty-calendar-after-connect surprise. Small.
2. **Sync on calendar page load**, throttled to at most once every N minutes
   using the existing `last_sync_at`. Covers most of "it is just up to date".
3. **Client interval** while the tab is open, say every 5 minutes, reusing the
   incremental `syncToken` path so it is cheap.
4. **True push** only if an Access-exempt callback path can be agreed with the
   platform owners. Needs their sign-off, so treat as a separate conversation.

Recommend 1 and 2 together, then 3.

## 3. `@` should link a person from the meeting

Not implemented anywhere; no mention handling exists in the note components.

Scope: an autocomplete popup in `TalkingPointRow` and `ActionItemRow` that
triggers on `@`, lists the meeting's attendees (already available as `people`,
passed into `ActionItemRow`), and inserts a link on select.

Two real design questions before coding:
- **Storage.** Rows hold plain text today. Storing a mention means either a
  marker syntax that is parsed on render, or a separate join table. Marker
  syntax is far cheaper and reversible.
- **Meaning.** Is an `@` a link to the person page, or does it also assign the
  action item? Fellow treats them differently, so this needs Danya's call.

## 5. Upcoming-meeting notification

Nothing exists. `WeekGrid` already ticks every 60s (`WeekGrid.tsx:186`), so
there is a clock to hang this on.

Options:
- **In-app banner** when a meeting starts within N minutes. No permissions, no
  browser prompt, works immediately. Cheapest and least intrusive.
- **Web Notifications API.** Needs an explicit permission prompt and only fires
  while a tab is open. More native-feeling, more friction.
- Anything that fires with the app closed needs a service worker plus push
  infrastructure. Out of scope for a prototype.

Recommend the in-app banner first, with the notification prompt as a later
opt-in in Settings.

---

## Suggested order

1. **#4** and **#8**. Genuine bugs, tiny fixes, ship together.
2. **#7 option 1** once Danya confirms he wants solo blocks back.
3. **#1** loud sync feedback, plus the missing test.
4. **#6** steps 1 and 2, which removes most of the perceived staleness.
5. **#5** in-app banner.
6. **#3** mentions, after the two design questions are answered.

#2 needs no work, only a look.
