# 05 — Figma Handoff Pack (for Figma AI: Make / First Draft)

> **Tooling reality:** Claude doesn't have a Figma tool connected in this session (only Atlassian + Slack MCP are wired in), so it can't draw in Figma directly. Instead, this pack gives **your** Figma AI everything it needs. Three ways to use it:
> 1. **Figma Make / First Draft (recommended):** paste the **Global style prompt** (§2) once, then paste each **screen prompt** (§4) to generate frames.
> 2. **html.to.design plugin:** if Claude generates the HTML prototype (see [00-README](00-README.md) / ask Claude), import the `.html` straight into Figma frames, then restyle with variables.
> 3. **Manual:** build the component library (§3) from the tokens, then assemble screens per [02 — Design Brief](02-design-brief.md).

All visuals must match **Fellow** (see [02 §1.5](02-design-brief.md) for the verified UI). App codename: **Fellow 2**.

---

## 1. Design tokens

> Hex values are **close approximations of Fellow's palette** — color-pick from the screenshots in the project to finalize. Set these as **Figma Variables** (Color / Number) so light+dark and spacing stay consistent.

### Color — light mode
| Token | Hex (approx) | Use |
|---|---|---|
| `accent/blue` | `#2D6BE6` | Primary buttons, selection, active checkbox, active nav, tab underline |
| `accent/blue-hover` | `#1F57C9` | Hover/pressed primary |
| `accent/blue-subtle` | `#E8F0FE` | Active nav background, selected row tint |
| `ai/purple` | `#6E56CF` | "Ask Fellow" / AI affordances only (cut in MVP, keep token) |
| `bg/window` | `#FFFFFF` | Main content background |
| `bg/sidebar` | `#F6F7F9` | Icon rail + agenda panel (use macOS vibrancy in app) |
| `bg/card` | `#FFFFFF` | Cards, popovers |
| `bg/hover` | `#F0F1F3` | Row hover |
| `border/hairline` | `#E5E7EB` | Separators, grid lines |
| `text/primary` | `#1A1A1E` | Titles, body |
| `text/secondary` | `#6B7280` | Subtitles ("The things to talk about"), timestamps |
| `text/tertiary` | `#9CA3AF` | Placeholders ("New talking point") |
| `semantic/due` | `#E8910C` | Due-date pills (e.g. "Tomorrow") |
| `semantic/now` | `#2DAA5E` | Calendar "now" line |
| `semantic/overdue` | `#DC2626` | Overdue |
| `semantic/done` | `#9CA3AF` | Completed item (muted + strikethrough) |

### Color — dark mode (derive)
Background → `#1C1C1F` (window) / `#232327` (sidebar) / `#2A2A2E` (cards); text primary `#F2F2F5`, secondary `#9CA3AF`; keep accent blue but lift to `#5B8DEF`; borders `#33343A`. (Let Figma generate dark from the light variables, then tune.)

### Typography — SF Pro (system)
| Style | Size / Weight / Line |
|---|---|
| Title (note/page) | 22 / Semibold / 28 |
| Section header ("Talking Points") | 16 / Semibold / 22 |
| Section subtitle | 13 / Regular / 18 (text/secondary) |
| Body / item text | 14 / Regular / 20 |
| List item (sidebar/meeting) | 13 / Medium / 18 |
| Caption / time / pill | 11–12 / Medium / 16 |

### Spacing — 8-pt grid
`4, 8, 12, 16, 24, 32`. Row height ~36–40px. Note content max-width ~720px, centered in detail pane.

### Radius & elevation
Radius: cards/popovers `10`, rows/inputs `6`, pills `999`. Elevation: flat surfaces + hairline borders; shadow only on popovers/menus (`0 8 24 rgba(0,0,0,.12)`).

### Icons
**SF Symbols** throughout. Sidebar: `calendar`, `play.square.stack` (Library), `checkmark.square` (Action items), `ellipsis` (More). Note rail: `text.append`, `checklist`, `bookmark`.

---

## 2. Global style prompt (paste into Figma AI FIRST)

```
You are designing "Fellow 2", a native macOS productivity app for meeting notes and 1:1s. It must look like a first-class Mac app (think Things 3 / Craft / Apple Notes), NOT a web app.

Visual language:
- Background white (#FFFFFF); sidebars light gray (#F6F7F9). Near-black text (#1A1A1E), secondary gray (#6B7280), placeholders (#9CA3AF).
- Single primary accent = blue (#2D6BE6) for buttons, selection, active nav, active checkboxes, tab underlines. Active nav item sits on a light-blue pill (#E8F0FE). Reserve purple (#6E56CF) only for AI features.
- Semantic: due-date pills orange (#E8910C), "now" line green (#2DAA5E), overdue red (#DC2626), done = gray + strikethrough.
- Font: SF Pro. Titles 22/Semibold, section headers 16/Semibold, subtitles 13/Regular gray, body 14/Regular, captions 11–12.
- 8pt spacing grid. Radius 10 (cards), 6 (rows/inputs), pills fully rounded. Flat surfaces with 1px hairline borders (#E5E7EB); shadows only on popovers.
- Icons: Apple SF Symbols style, thin line.
Layout shell: an ultra-thin (~64px) left ICON RAIL (Calendar, Library, Action items, More — active item = blue icon on light-blue pill with label beneath), then a secondary LIST panel, then the main CONTENT area. Provide both light and dark variants.
Keep it calm, content-first, generous whitespace. No marketing flourish.
```

---

## 3. Component prompts (build the library)

Generate these as components with variants (default / hover / selected; light + dark):

- **Icon-rail item** — SF Symbol + label; states default/hover/active(blue icon on `#E8F0FE` pill).
- **Agenda-panel meeting row** — time (caption, gray) + title (13/Medium); states default/hover/selected(blue tint); a green "now" divider variant.
- **Note header bar** — hamburger, editable title (22/Semibold), star, "Xm left" chip, "Google Meet" badge, overlapping attendee avatars + "+", "Share" button, "⋮".
- **Note section** — collapsible header (16/Semibold) + gray subtitle + item list. Three subtypes: Talking Points (○ circle bullet), Action Items (☐ checkbox), Notepad (• bullet).
- **Action-item row** — checkbox + text + right-aligned assignee avatar + optional due-date pill (orange). Done state = strikethrough + gray.
- **Due-date pill / assignee chip / attendee avatar (with initials fallback).**
- **Action-items group** — group title + count + rows + "+ New action item"; special "Inbox" variant; "+ New group".
- **Tab bar** — "My items / Assigned to others" with blue underline.
- **Calendar week grid** — day columns w/ headers, all-day row, location chips, event blocks (rounded, subtle fill, left accent bar), green now-line.
- **Primary / secondary button, search field, filter button, segmented control, date-picker popover.**
- **Empty states** for Today, People, My To-dos, Search.

---

## 4. Screen prompts (paste one at a time, after §2)

### 4.1 Calendar / Today (home)
```
Design the "Calendar" screen for Fellow 2 (macOS, light + dark).
Three zones left→right: (1) thin icon rail [Calendar active, Library, Action items, More]; (2) a day-agenda panel headed "Tue, Jun 2 ▾" with "Today" and "Week view" buttons and a vertical list of today's meetings (each = time + title, e.g. "9–10 AM / Claude Code – First Steps", with a green 'now' divider mid-list); (3) the main week grid Sun–Sat with a top all-day row, per-day location chips (Home/office/car), rounded event blocks with a thin left accent bar, and a green current-time line. Top bar: workspace switcher "Delivery Hero SE", open-note tab, back/forward, star, bell, help, global search, and a purple "Ask Fellow" button far right. Add a "Meet with…" search and "+" above the grid.
```

### 4.2 Meeting note (THE core screen — fixed 3-block template)
```
Design the meeting-note workspace for Fellow 2 (macOS, light + dark). Keep the left icon rail + day-agenda panel; the selected meeting is highlighted in the panel.
Main content (max-width ~720px, centered): a header row with hamburger + editable title "FOS – Office hours", a star, a "50m left" chip, a green "Google Meet" badge, attendee avatars + "+", a "Share" button and "⋮". Below it a small "📅 Prep for this meeting" button.
Then THREE FIXED SECTIONS, each a bold 16px header + gray subtitle + item list:
1) "Talking Points" — subtitle "The things to talk about" — items use empty CIRCLE bullets; show a placeholder "New talking point".
2) "Action Items" — subtitle "What came out of this meeting? What are your next steps?" — items use SQUARE CHECKBOXES; each row can show a right-aligned assignee avatar and an orange due-date pill; placeholder "New action item".
3) "Notepad" — subtitle "Anything else to write down?" — plain bullet rich text.
A thin right icon rail (notes, checklist, bookmark). Calm, lots of whitespace.
```

### 4.3 Action items / "My To-dos" (the unified list)
```
Design the "Action items" screen for Fellow 2 (macOS, light + dark) — this is the unified to-do list aggregating action items from all meetings.
Left icon rail with "Action items" active. Main: page title "Action items" + a blue "New action item" button top-right. Below: tabs "My items" (active, blue underline) / "Assigned to others", and a "Filters" button + "Search for items…" field.
Body = grouped checklists: a "📥 Inbox" group, a "Top priority" group, and user groups, ending with "+ New group". Each row = checkbox + task text + right-aligned assignee avatar + optional orange due-date pill (e.g. "Tomorrow"). Each row also shows a small back-link to its source meeting. Completed rows are gray + strikethrough. (Do NOT include the AI Suggestions card — AI is out of scope.)
```

### 4.4 Person / 1:1 Stream (per-person history — key differentiator)
```
Design the "Person 1:1 Stream" screen for Fellow 2 (macOS, light + dark) — the persistent history for one person.
Left icon rail; the secondary panel shows a "People" directory list (avatar + name + last-1:1 date), one selected. Main content: a person header (large avatar, name, role/title, "Next 1:1: Thu 10:00", and a small stat "3 open to-dos"). Below the header, a "Start next 1:1" primary button and a strip "3 items carried forward from last 1:1" listing unfinished action items. Then a reverse-chronological TIMELINE of past 1:1 notes — each entry is a collapsible card (date + one-line summary; expandable to the full Talking Points / Action Items / Notepad). Calm, readable.
```

### 4.5 People directory
```
Design the "People" directory for Fellow 2 (macOS, light + dark): the icon rail, then a searchable list/grid of people cards (avatar, name, role, last-1:1 date, open-to-do count badge). Selecting a card opens that person's 1:1 Stream. Include an empty state.
```

### 4.6 Create-event modal (later phase, Google parity)
```
Design a "Create event" modal for Fellow 2 (macOS, light + dark), matching Fellow: left half shows the week grid dimmed; right panel has "Add event title", a date row, start→end time, "All day / Repeat / Time zone" links, "Add participants" with the organizer listed, a "Google Meet" row, a calendar picker ("Primary Calendar"), "Add a description", and an "Enable Auto-record" toggle, with Save / Cancel.
```

---

## 5. What to deliver back from Figma
- All screens in **light + dark**, built from shared **Variables** (the §1 tokens).
- A **component library** (§3) with variants.
- The **three hero flows** polished: 1:1 Stream (§4.4), unified Action items (§4.3), meeting note (§4.2).
- Exported tokens (Figma Variables → JSON) so they map cleanly to SwiftUI `Color`/spacing constants.

## 6. Tips for better Figma AI output
- Paste the **Global style prompt (§2) first**, in the same session, before each screen prompt — it anchors the look.
- Generate **one screen at a time**; iterate with follow-ups ("make the sidebar narrower", "use SF Pro", "tighten row spacing to 8pt").
- After generating, **convert raw colors to Variables** and relink, so dark mode + theming work.
- Use the real **screenshots** as a visual reference image in First Draft where supported.
