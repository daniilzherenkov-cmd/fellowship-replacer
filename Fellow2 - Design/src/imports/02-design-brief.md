# Fellow 2 — Design Brief & Figma AI Prompt Pack

> **How to use this file**
>
> The Figma file already has the full token foundation built (variables, text styles, effect styles, 9 pages): **[Fellow 2 — macOS App Design](https://www.figma.com/design/TXY2Yp6fqHiv9YIqONgAVS)**
>
> To build the UI with Figma AI:
> 1. Open the file above, navigate to the target page (e.g. "Today")
> 2. Press **`K`** or click the sparkle/wand icon in the toolbar to open Figma AI
> 3. Paste the **Global context prompt (§3)** first — do this once per session
> 4. Then paste the relevant **screen prompt from §4** — one screen at a time
> 5. Iterate with follow-up instructions in the same AI session
>
> The design tokens (colors, spacing, radius, typography) are already in the file as Variables — ask Figma AI to apply them.

---

## 1. Verified UI — ground truth from real Fellow screenshots ✅

Captured from the live Fellow app (Delivery Hero SE workspace, June 2026). **Where anything below conflicts with this section, this section wins.**

### Global chrome
- **Left icon rail** (~64px wide). Holds: **Calendar** (shows today's date number), **Library**, **Action items** (checkmark icon), **More (•••)**. Active item = blue icon on a light-blue rounded pill background, label beneath. Rail sits flush left, no border — just a subtle background difference from the content area.
- **Top bar:** "Delivery Hero SE ▾" workspace switcher with logo · open-note tab(s) e.g. "Now · FOS – Office hours ✕" · back/forward ‹ › · favorite ★ · notifications 🔔 · help ? · global Search… field · **"Ask Fellow"** button in purple/violet, far right.

### Calendar tab (three zones left → right)
1. Icon rail (active: Calendar)
2. **Day agenda panel** — header "Tue, Jun 2 ▾" with Today / Week view toggle, scrollable list of the day's meetings (time + title per row), a green horizontal **"now" line** separating past from upcoming
3. **Week grid** — Sun–Sat columns, all-day row at top, per-day **location chips** (Home / office / car), colored rounded event blocks each with a thin left accent bar, green current-time line, "Meet with…" search + "+" button above

### Meeting note (when a meeting is open)
- **Header row:** ≡ drag handle · editable title · ★ favorite · "⏱ 50m left" chip · "🟢 Google Meet" badge · overlapping attendee avatars + "+" · **Share** button · ⋮ overflow
- **"📅 Prep for this meeting"** button sits just below the header
- **Body = exactly three fixed sections (muscle-memory template — do not change order or structure):**
  1. **Talking Points** — subtitle *"The things to talk about"* — items use **○ empty circle** bullets — placeholder "New talking point"
  2. **Action Items** — subtitle *"What came out of this meeting? What are your next steps?"* — items use **☐ square checkboxes** — each row: checkbox · text · assignee avatar (right) · optional orange due-date pill — placeholder "New action item"
  3. **Notepad** — subtitle *"Anything else to write down?"* — plain **•** bullet rich text
- **Right inner rail:** three icon buttons (stream/notes, checklist, bookmark)
- **Omit:** the floating "Record…" pill — AI recording is cut from MVP

### Action items tab
- Title "Action items" + blue **"+ New action item"** button top-right
- Tabs: **"My items"** (active, blue underline) | **"Assigned to others"** · Filters button · "Search for items…" field
- Groups: **📥 Inbox** (special), **Top priority**, user-created groups, **"+ New group"** link
- Each row: checkbox · text · assignee avatar (right-aligned) · optional orange due-date pill (e.g. "Tomorrow")
- Omit the "✨ AI Suggestions" card — AI is cut

### Real palette
| Role | Light | Dark |
|---|---|---|
| Primary accent (buttons, selection, active) | `#2563EB` (Fellow blue) | `#60A5FA` |
| Active nav background | `#EFF6FF` | `#1E3A8A` |
| AI accent (reserve, not MVP) | `#9333EA` | `#C084FC` |
| Window background | `#FFFFFF` | `#0F172A` |
| Sidebar / panel | `#F9FAFB` | `#111827` |
| Text primary | `#0F172A` | `#F9FAFB` |
| Text secondary | `#6B7280` | `#9CA3AF` |
| Due-date / warning | `#F59E0B` | `#FBBF24` |
| Now-line / success | `#22C55E` | `#4ADE80` |
| Overdue / error | `#EF4444` | `#F87171` |
| Border / separator | `#E5E7EB` | `#374151` |

---

## 2. Design principles

**Three words: Native. Calm. Continuous.**

- **Native** — first-class Mac app (Things 3 / Craft / Granola tier). macOS chrome, vibrancy on sidebars, SF Symbols, full keyboard support. Not a web app in a frame.
- **Calm** — used many times a day. One accent color, generous whitespace, content-first. No marketing flourish.
- **Continuous** — every person and recurring meeting is a thread. "Where did we leave off?" must be answerable in one glance.

**Primary user:** Milena — a manager running recurring 1:1s and team meetings, taking notes by hand, tracking action items.

---

## 3. Figma AI — Global context prompt

> **Paste this first in every Figma AI session before any screen prompt. It anchors the visual language for the whole file.**

```
You are designing "Fellow 2" — a native macOS productivity app for meeting notes, 1:1s, and action items. It must look and feel like a first-class Mac app at the level of Things 3, Craft, or Apple Notes. NOT a web app.

APP SHELL (always present):
- Ultra-thin LEFT ICON RAIL (~64px). Icons (SF Symbols style, thin line): Calendar (shows date number), Library (play.square.stack), Action items (checkmark.square), More (ellipsis). Active item = blue icon sitting on a light-blue rounded pill, label in 11px caption below.
- TOP BAR: workspace name "Delivery Hero SE ▾" + logo · open-note tab(s) with close "✕" · back/forward ‹ › · star ★ · bell 🔔 · help ? · Search… field · "Ask Fellow" button in purple far right.
- Three-pane layout: icon rail → secondary panel (list/agenda) → main content area.

VISUAL LANGUAGE:
Colors (light mode) — accent blue #2563EB for all interactive/selected states; active nav background #EFF6FF; window white #FFFFFF; sidebar/panels #F9FAFB; text primary #0F172A; text secondary #6B7280; placeholders #9CA3AF; borders #E5E7EB; due-date orange #F59E0B; now-line green #22C55E; overdue red #EF4444; AI purple #9333EA (reserved, not used in MVP).
Dark mode — window #0F172A; sidebar #111827; text primary #F9FAFB; accent blue lifts to #60A5FA; borders #374151.

Typography — SF Pro (use Inter as fallback). Scale: titles 22px/Semibold, section headers 16px/Semibold, subtitles 13px/Regular in text-secondary color, body/items 14px/Regular, sidebar rows 13px/Medium, captions/pills 11–12px/Medium.

Spacing — 8pt grid. Row height 36–40px. Sidebar width ~220px. Content max-width ~720px centered. Padding: 16px horizontal in content, 8px in rows.

Radius — cards and popovers 10px; rows and inputs 6px; pills/badges fully rounded (999px).

Elevation — flat surfaces + 1px hairline borders (#E5E7EB). Drop shadows ONLY on popovers and menus: 0 8px 24px rgba(0,0,0,0.12).

Icons — SF Symbols throughout, thin/regular weight. No custom icon sets.

Density — comfortable. This is a reading/writing tool, not a dashboard. Let content breathe.

Generate both LIGHT and DARK variants side by side.
```

---

## 4. Screen prompts — paste one at a time after §3

### 4.1 — Calendar / Today (home screen)

```
Using the Fellow 2 visual language established above, design the CALENDAR / TODAY screen. Light + dark side by side. Use the existing file's Variables for all colors.

THREE ZONES left to right:
ZONE 1 — Icon rail (64px, bg #F9FAFB / dark #111827): Calendar icon active (blue on #EFF6FF pill, "2" as the date number shown inside a calendar icon), Library, Action items, More — each with 11px label beneath.

ZONE 2 — Day agenda panel (220px, same bg as rail, right hairline border): Header row "Tue, Jun 2 ▾" in 15px/Semibold + Today/Week segmented toggle. Then a vertical scrollable list of today's meetings — each row: time in 11px/Medium text-secondary (e.g. "9:00 AM") + title in 13px/Medium text-primary (e.g. "FOS – Office hours"). A green horizontal 1px "now" line with "Now" label separates past from upcoming meetings. Rows have default/hover/selected states (selected = #EFF6FF tint).

ZONE 3 — Week grid (fills remaining width): top bar with "Meet with…" search input + blue "+" button. Column headers Sun–Sat with date numbers; today's column subtly highlighted. All-day row at top. Below: per-day location chips (small rounded pills: "Home", "office", "car") in 11px. Time slots with colored rounded event blocks — each block has a 3px left accent bar in the calendar color, event title in 12px/Medium. Green horizontal current-time line spanning full width.

TOP BAR (above all three zones, full width): "Delivery Hero SE ▾" + logo · "Now · FOS – Office hours ✕" tab · ‹ › · ★ · 🔔 · ? · Search… · "Ask Fellow" purple button.
```

### 4.2 — Meeting note (the core editor)

```
Using the Fellow 2 visual language, design the MEETING NOTE screen. Light + dark side by side.

Keep zones 1 (icon rail) and 2 (day agenda panel) on the left — zone 2 shows today's meetings, with "FOS – Office hours" selected (highlighted #EFF6FF row).

ZONE 3 — note workspace (max-width 720px, centered in content area):

HEADER ROW: ≡ drag handle (gray) · editable title "FOS – Office hours" (22px/Semibold) · ★ (gray, unfilled) · "⏱ 50m left" chip (small, gray bg, 11px) · "🟢 Google Meet" badge (green dot + "Google Meet" text, 11px, rounded pill) · three overlapping attendee avatar circles (32px, with initials) + "+" button · "Share" button (secondary style) · ⋮.
Below header: "📅 Prep for this meeting" small button (secondary style, full-width or left-aligned).

THEN THREE FIXED SECTIONS (vertical stack, 24px gap between sections):

SECTION 1 — TALKING POINTS
  Header: "Talking Points" (16px/Semibold) + subtitle "The things to talk about" (13px/Regular, text-secondary)
  Items: ○ empty circle bullet (18px circle outline, accent blue) + text "New talking point" (14px/Regular, placeholder gray). Show 2–3 real items filled in (e.g. "Q2 hiring plan", "Blockers this week") + one placeholder.

SECTION 2 — ACTION ITEMS
  Header: "Action Items" (16px/Semibold) + subtitle "What came out of this meeting? What are your next steps?" (13px/Regular, text-secondary)
  Items: ☐ square checkbox + text + right-aligned 28px avatar chip + optional orange pill "Tomorrow" (11px/Medium, #F59E0B bg). Show 2 filled items + 1 placeholder "New action item". One row should be checked (checkbox filled blue, text gray + strikethrough).

SECTION 3 — NOTEPAD
  Header: "Notepad" (16px/Semibold) + subtitle "Anything else to write down?" (13px/Regular, text-secondary)
  Items: • bullet points. Show 1–2 sample notes in 14px/Regular.

RIGHT INNER RAIL (24px wide, sits flush right of content area): three icon buttons stacked — stream icon, checklist icon, bookmark icon — gray, active one blue.

Lots of whitespace. Clean. No floating record button.
```

### 4.3 — My To-dos (unified action item list)

```
Using the Fellow 2 visual language, design the MY TO-DOS / ACTION ITEMS screen. Light + dark side by side.

Left: icon rail with "Action items" (checkmark icon) active.
No secondary panel — the full remaining width is the to-do list content.

TOP OF CONTENT:
Title "Action items" (22px/Semibold) left-aligned + blue "＋ New action item" button right-aligned.
Below: tab row "My items" (active, blue underline) | "Assigned to others" (gray) · then right-aligned: "Filters" button + "Search for items…" text field.

BODY — grouped checklist:

GROUP: 📥 Inbox (special group, no reorder)
  1 item: ☐ "Follow up on Q2 report" · assignee avatar · orange pill "Tomorrow"
  1 item: ☐ "Review PR for onboarding flow" · assignee avatar · (no pill)

GROUP: Top priority
  1 item: ☐ "Define OKRs for H2" · assignee avatar · orange pill "Today" (use due-today orange)
  1 item: ☑ "Send weekly update" · gray + strikethrough (done state)

GROUP: This week (user-created, labeled in 13px/Semibold gray)
  2–3 items with varied due dates and assignees
  Faint back-link under each item: small gray text "↗ FOS – Office hours" (11px, clickable)

"＋ New group" link at bottom, gray, 13px.

Each row: 36px height · left checkbox (24px) · task text 14px/Regular · right: assignee avatar 24px + optional due-date pill. Selected row has #EFF6FF tint. Hover shows light gray. Row has 12px left indent inside group.
```

### 4.4 — Person 1:1 Stream (the key differentiator)

```
Using the Fellow 2 visual language, design the PERSON 1:1 STREAM screen. Light + dark side by side.

Left: icon rail — no standard item active (or use a "People" icon).
Secondary panel (220px): People directory — searchable. Each row: 32px avatar + name (13px/Medium) + last-1:1 date (11px, text-secondary). "Ana Popescu" row selected (#EFF6FF tint).

MAIN CONTENT:

PERSON HEADER (top of content, 80px tall, bg #F9FAFB / dark #1F2937, bottom hairline):
  Large avatar (48px) · Name "Ana Popescu" (17px/Semibold) · Role "Senior Engineer" (13px, text-secondary) · "Next 1:1: Thu 10:00" (12px, accent blue) · right side: "3 open to-dos" badge (small, gray).

CARRY-FORWARD STRIP (below header, accent-subtle bg #EFF6FF, 8px vertical padding):
  "3 items carried forward from last 1:1 ▾" (13px/Medium, accent blue). Expanded: 3 checkbox rows with the unfinished items from last session. "Dismiss" link right-aligned.

"Start next 1:1" primary blue button (full-width or large left-aligned).

TIMELINE (reverse-chronological, below button):
  Each entry = collapsible card (border radius 8px, 1px border #E5E7EB, 12px padding):
    Header row: date "Tue, May 27" (13px/Semibold) + one-line summary "Discussed Q2 roadmap, 2 action items" (13px/Regular, text-secondary) + expand chevron ▸ right-aligned.
    Expanded: shows the three-section note (Talking Points / Action Items / Notepad) in compact form (12px, less padding).
  Show 1 expanded + 2 collapsed below it. Gap 8px between cards.
```

### 4.5 — People directory

```
Using the Fellow 2 visual language, design the PEOPLE DIRECTORY screen. Light + dark side by side.

Left: icon rail.
No secondary panel — full width is the directory.

TOP: Title "People" (22px/Semibold) + search field "Search people…" right side.

BODY — grid of person cards (3–4 columns, 16px gap):
Each card (border radius 10px, 1px border, 16px padding, white bg):
  Avatar (48px, with initials fallback) · Name (15px/Semibold) · Role (13px, text-secondary) · "Last 1:1: May 27" (11px, text-tertiary) · "3 open to-dos" badge (small orange pill bottom-right of card).
Cards have hover state (slight shadow lift, border turns accent blue).

EMPTY STATE (show as one card slot): illustration or icon + "No people yet" + "Meetings with participants will appear here automatically" (13px, text-secondary). Centered.
```

### 4.6 — Meetings archive

```
Using the Fellow 2 visual language, design the MEETINGS / ALL NOTES archive screen. Light + dark side by side.

Left: icon rail.
Secondary panel (220px): filter/nav — sections "This week", "Past month", "All notes" (source-list style, collapsible). "This week" selected.

MAIN CONTENT:
Top: "Meetings" title (22px/Semibold) + filter chips (date range, attendee) + search field.

Body — chronological list of meeting note cards, grouped by week:
  Week header: "This week — Jun 2–6" (13px/Semibold, text-secondary, with a hairline below).
  Each meeting row (40px, hover state): calendar color dot (8px) · title (14px/Medium) · date + time (12px, text-secondary) · attendee avatar stack (3 max, 20px) · "2 action items" badge right-aligned · small open-note arrow far right.
  Completed/past meetings show normally; meetings with open action items get a small orange dot indicator.

Show 6–8 rows total across two week groups.
```

### 4.7 — First-run / calendar permission

```
Using the Fellow 2 visual language, design the FIRST-RUN / CALENDAR PERMISSION screen. Light only (single screen, centered modal over a dimmed app shell).

Modal (480×380px, radius 12px, white bg, shadow: 0 24px 48px rgba(0,0,0,0.16)):
  Top: calendar icon (SF Symbol "calendar", 48px, accent blue, centered).
  Title: "Connect your calendar" (22px/Semibold, centered).
  Body text (14px/Regular, text-secondary, centered, max-width 360px):
    "Fellow 2 reads your Google Calendar to show meetings and create note workspaces automatically. We never modify your events without asking."
  Bullet list of permissions requested (13px/Regular, text-primary, left-aligned with checkmark icons in accent blue):
    ✓ View calendar events
    ✓ Read attendee lists
    ✓ Create events on your behalf (for new meetings)
  Two buttons stacked (full width, 44px height, 8px gap):
    Primary: "Connect Google Calendar" (blue, rounded 8px)
    Secondary: "Set up manually" (gray border, rounded 8px)
  Small text below: "You can change permissions in Settings at any time." (11px, text-tertiary, centered).
```

---

## 5. Component prompts (build these as the library)

> After generating screens, ask Figma AI to extract and formalize these as components with variants. Generate on the "Components" page.

```
On the Components page of the Fellow 2 file, build the following reusable components. Each component needs Default / Hover / Selected (or Active) state variants, and all colors must use the file's Variables — not hardcoded hex.

1. SIDEBAR NAV ROW (220×36px)
   Left: 16px SF Symbol icon · 13px/Medium label. States: Default (transparent bg), Hover (#F3F4F6), Selected (icon blue + label #2563EB + bg #EFF6FF pill, 6px radius).

2. MEETING CARD ROW (for the day agenda panel, 220px wide, 40px tall)
   Time (11px/Medium, text-secondary) · title (13px/Medium, text-primary). States: Default, Hover, Selected. NOW DIVIDER variant: full-width green 1px line with "Now" label.

3. ACTION ITEM ROW (full width, 36px tall)
   Left: 20px checkbox (unchecked circle or filled blue square) · task text (14px/Regular) · right: 24px avatar + optional due-date pill. States: Default, Hover, Done (gray + strikethrough). Due-date pill variants: None / Today (orange) / Tomorrow (orange) / Overdue (red).

4. NOTE SECTION BLOCK
   Header: 16px/Semibold title + 13px/Regular subtitle (text-secondary). Three subtypes:
   - TALKING POINTS: ○ circle bullet items (24px circle outline, blue)
   - ACTION ITEMS: ☐ checkbox items (see component 3)
   - NOTEPAD: • bullet items

5. PERSON CARD (for directory grid, ~200px wide, ~120px tall)
   48px avatar + name (15px/Semibold) + role (13px, text-secondary) + last-1:1 date (11px) + open-todos badge. States: Default, Hover (border turns blue).

6. TIMELINE ENTRY CARD (for 1:1 stream, full width)
   Collapsed: date (13px/Semibold) + summary (13px, text-secondary) + ▸ chevron. Expanded: full note content in compact 12px. States: Collapsed / Expanded.

7. ATTENDEE AVATAR CHIP (32px circle with initials, stackable with overlap)
   With "+" add button variant.

8. DUE-DATE PILL (rounded pill, 11px/Medium)
   Variants: None / Tomorrow (orange) / Today (orange) / Overdue (red) / Custom date (gray).

9. MEETING HEADER BAR (full width of content pane)
   All header elements from §1 meeting note. Editable title (22px/Semibold), chips, avatars, Share, ⋮.

10. EMPTY STATE (centered, ~280px wide)
    SF Symbol illustration (48px, text-tertiary) + title (15px/Semibold) + subtitle (13px, text-secondary) + optional CTA button.
```

---

## 6. Information architecture

```
Three-pane layout: Sidebar → List → Detail

┌──────────┬──────────────────────┬──────────────────────────────┐
│ ICON     │ LIST (context)       │ DETAIL (editor/content)      │
│ RAIL     │                      │                              │
│ 64px     │ e.g. Today meetings: │ Meeting note workspace:      │
│          │  9:00 FOS – Office   │  ── Title + chips + people   │
│ Calendar │  11:00 Team sync     │  ── Talking Points ○         │
│ Library  │  14:00 1:1 Ana       │  ── Action Items ☐           │
│ To-dos   │                      │  ── Notepad •                │
│ More     │                      │  ── Private notes (1:1 only) │
└──────────┴──────────────────────┴──────────────────────────────┘
```

| Sidebar item | List shows | Detail shows |
|---|---|---|
| **Today** (home) | Today's meetings, chronological | Selected meeting note workspace |
| **My To-dos** ⭐ | All open action items across all meetings | Action item in context / source meeting |
| **People** ⭐ | Directory of 1:1 contacts | Person's 1:1 Stream (history) |
| **Meetings** | This week / all past notes | Selected meeting note workspace |

---

## 7. Design token reference (already in Figma Variables)

The Figma file already contains these collections — reference them by name when prompting Figma AI.

| Collection | Tokens | Notes |
|---|---|---|
| **Primitives** | 37 raw color values | Hidden from pickers — aliased by Color |
| **Color** | 30 semantic tokens, Light + Dark modes | Use these for all fills, strokes, text |
| **Spacing** | 13 steps (0–64px, 8pt grid) | GAP and WIDTH_HEIGHT scope |
| **Radius** | 8 steps (0–9999px) | CORNER_RADIUS scope |
| **Text styles** | 14 styles (Title, Headline, Body, Label, Caption, Note) | All Inter; SF Pro in production |
| **Effect styles** | 4 shadows (Popover, Menu, Card, Tooltip) | Popover: 0 8 24 rgba(0,0,0,0.12) |

**Key semantic color names to reference:**
- `bg/primary`, `bg/secondary`, `bg/sidebar` — surfaces
- `text/primary`, `text/secondary`, `text/tertiary` — text hierarchy
- `accent/primary`, `accent/subtle`, `accent/text` — Fellow blue
- `border/default`, `border/subtle` — separators
- `state/hover`, `state/selected` — interactive states
- `semantic/overdue`, `semantic/due-today`, `semantic/now-line` — status colors
- `ai/accent` — purple, reserved for AI features

---

## 8. macOS-native behavior (fidelity checklist)

- **Window:** three-pane `NavigationSplitView`, traffic-light controls, full-screen support
- **Sidebar:** translucent vibrancy material, system selection highlight, collapsible sections
- **Light/Dark:** automatic via semantic color variables — both modes required
- **Keyboard:** ⌘N new note, ⌘F search, ⌘1/2/3 switch sections, ⌘W close tab
- **Autosave:** no save button — subtle "Saved" affordance only
- **Checkboxes:** instant response, assignee/due-date set via inline popover (not modal)
- **Carry-forward:** visible strip at top of 1:1 with count, dismissable
- **Accessibility:** sufficient contrast, VoiceOver-friendly labels

---

## 9. What to deliver from Figma

1. All **6–7 screens** (§4.1–4.7) in **light + dark**
2. **Component library** (§5) with all variant states
3. **Three hero flows** polished end-to-end:
   - (a) Person 1:1 Stream — history, carry-forward, start next meeting
   - (b) My To-dos — grouped list, back-links, quick-add
   - (c) In-meeting note — header → three blocks → checkbox → action item with assignee
4. **First-run** calendar permission flow (§4.7)
5. Design tokens exported as JSON (Variables → JSON) for SwiftUI mapping
