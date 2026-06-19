# Fellow 2 — Design Implementation Guide

This is a complete implementation of the Fellow 2 macOS meeting notes application based on the comprehensive design brief. The application features a native-like macOS interface with three-pane layouts, full dark mode support, and all core functionality.

## Design Principles

**Three words: Native. Calm. Continuous.**

- **Native** — First-class Mac app feel (Things 3 / Craft / Granola tier)
- **Calm** — Single accent color, generous whitespace, content-first
- **Continuous** — Every person and recurring meeting is a thread

## Color System

### Light Mode
- Primary accent: `#2563EB` (Fellow blue)
- Active nav background: `#EFF6FF`
- Window background: `#FFFFFF`
- Sidebar/panel: `#F9FAFB`
- Text primary: `#0F172A`
- Text secondary: `#6B7280`
- Due-date/warning: `#F59E0B`
- Now-line/success: `#22C55E`
- Border: `#E5E7EB`

### Dark Mode
- Primary accent: `#60A5FA`
- Active nav background: `#1E3A8A`
- Window background: `#0F172A`
- Sidebar/panel: `#111827`
- Text primary: `#F9FAFB`
- Text secondary: `#9CA3AF`
- Border: `#374151`

## Application Structure

### Global Chrome
- **Left icon rail** (~64px wide) with Calendar, Actions, People, Meetings
- **Top bar** with workspace switcher, tabs, navigation, search, and "Ask Fellow" button
- **Three-pane layout**: Icon rail → Secondary panel → Main content area

## Implemented Screens

### 1. Calendar / Today View (Home Screen)
**File:** `src/app/components/CalendarView.tsx`

**Three zones:**
1. **Icon rail** - Active Calendar icon showing date "2"
2. **Day agenda panel** (220px) - Scrollable list of today's meetings with green "Now" line
3. **Week grid** - 7-day calendar view with event blocks and location chips

**Features:**
- Today/Week toggle in day agenda
- Real-time "now" indicator
- Color-coded event blocks with left accent bars
- Hover and selection states
- Meeting time display

### 2. Meeting Note (Core Editor)
**File:** `src/app/components/MeetingNote.tsx`

**Structure:**
- **Header row**: Drag handle, editable title, favorite star, time remaining, Google Meet badge, attendees, Share button
- **Prep button**: "📅 Prep for this meeting"
- **Three fixed sections** (muscle-memory template):
  1. **Talking Points** - Circle bullets (○)
  2. **Action Items** - Square checkboxes (☐) with assignees and due dates
  3. **Notepad** - Bullet points (•)

**Features:**
- Inline editing for all content
- Checkbox completion with strikethrough
- Assignee avatars
- Due date pills (Today/Tomorrow with orange)
- Add new items to each section

### 3. Action Items / My To-dos
**File:** `src/app/components/ActionItems.tsx`

**Features:**
- Tab navigation: "My items" | "Assigned to others"
- Grouped task lists: 📥 Inbox, Top priority, custom groups
- Each task row shows: checkbox, text, assignee avatar, due date pill
- Meeting back-links (small gray "↗ FOS – Office hours")
- Search and filters
- "+ New action item" button

### 4. People / 1:1 Stream
**File:** `src/app/components/PeopleStream.tsx`

**Layout:**
- **Left panel**: Searchable people directory with avatars and last meeting dates
- **Main content**:
  - Person header with avatar, name, role, next 1:1 time
  - Carry-forward strip showing items from last session
  - "Start next 1:1" button
  - Timeline of past meetings (collapsible cards)

**Timeline entries include:**
- Date and summary
- Talking points, action items, notes from each session
- Expand/collapse functionality

### 5. People Directory (Grid View)
**File:** `src/app/components/PeopleDirectory.tsx`

**Features:**
- 3-column grid of person cards
- Each card shows: avatar, name, role, last 1:1 date, open to-dos count
- Hover state with border highlight and shadow
- Empty state placeholder
- Search functionality
- Click to open person's 1:1 stream

### 6. Meetings Archive
**File:** `src/app/components/MeetingsArchive.tsx`

**Layout:**
- **Left panel**: Time period filters (This week, Past month, All notes)
- **Main content**:
  - Week-grouped meeting list
  - Each row: color dot, title, date/time, attendee avatars, action item count
  - Orange indicator for meetings with open action items
  - Filter chips and search

### 7. Calendar Permission Modal
**File:** `src/app/components/CalendarPermissionModal.tsx`

**Features:**
- Centered modal with backdrop blur
- Calendar icon
- Permission list with checkmarks
- "Connect Google Calendar" primary button
- "Set up manually" secondary button
- Footer text about settings

## Navigation

Click the **settings gear icon (⚙️)** in the top bar to see the calendar permission modal.

### Icon Rail Navigation
- **Calendar (date icon)** - Today view and week calendar
- **Actions (checkmark)** - Unified action items list
- **People (users icon)** - People directory → Click person → 1:1 stream
- **Meetings (folder)** - All meetings archive

### Theme Toggle
Click the **sun/moon icon** in the top bar to toggle dark mode.

## Typography

- **Font family**: Inter (fallback for SF Pro)
- **Scale**:
  - Titles: 22px/Semibold
  - Section headers: 16px/Semibold
  - Subtitles: 13px/Regular (text-secondary)
  - Body/items: 14px/Regular
  - Sidebar rows: 13px/Medium
  - Captions/pills: 11-12px/Medium

## Spacing & Layout

- **8pt grid system** for consistent spacing
- **Row heights**: 36-40px
- **Sidebar widths**: 220px for secondary panels, 64px for icon rail
- **Content max-width**: 720px centered
- **Radius**: Cards 10px, rows/inputs 6px, pills fully rounded

## Interactive States

All interactive elements support:
- **Default** state
- **Hover** state (subtle background change)
- **Selected/Active** state (blue accent with light blue background)
- **Disabled** state where appropriate

## Key Design Patterns

### Avatar Chips
- 32px circles with initials
- Stackable with -8px overlap
- 2px white/dark border for separation
- "+" button to add more

### Due Date Pills
- Fully rounded
- Color-coded: Orange for Today/Tomorrow, Red for Overdue, Gray for future
- 11px font size, medium weight
- Compact padding

### Timeline Cards
- 8px border radius
- 1px border
- Collapsible with chevron indicator
- Compact content display when collapsed
- Full three-section layout when expanded

### Now Line
- 1px green horizontal line (`#22C55E`)
- "Now" label inline
- Spans full width of content area
- Separates past from upcoming

## Technical Implementation

- **React 18** with TypeScript
- **Tailwind CSS v4** for styling
- **Lucide React** for icons
- **No external UI libraries** - all components custom-built
- **Responsive states** with proper hover/active feedback
- **Dark mode** via Tailwind's dark variant

## File Structure

```
src/app/
├── App.tsx                           # Main app shell with navigation
└── components/
    ├── CalendarView.tsx              # Today/Week calendar view
    ├── MeetingNote.tsx               # Meeting note editor
    ├── ActionItems.tsx               # To-do list
    ├── PeopleStream.tsx              # Person 1:1 history
    ├── PeopleDirectory.tsx           # People grid view
    ├── MeetingsArchive.tsx           # All meetings list
    └── CalendarPermissionModal.tsx   # First-run permission flow
```

## Usage Notes

1. **Default view**: Calendar with today's meetings
2. **Click any meeting** in the day agenda to open its note
3. **Switch tabs** via icon rail to access Actions, People, or Meetings
4. **Dark mode** toggles throughout entire application
5. **All content is editable** - click to type in any text field
6. **Checkboxes** toggle completion with visual feedback
7. **People cards** link to their 1:1 stream view
8. **Meeting rows** in archive link back to meeting notes

## Design Fidelity

This implementation follows the Fellow 2 design brief specifications:
✅ Three-pane macOS-native layout
✅ Exact color palette (light + dark modes)
✅ Proper typography hierarchy
✅ 8pt grid spacing system
✅ All 7 core screens implemented
✅ Interactive states and hover effects
✅ Component patterns (avatars, pills, cards)
✅ Muscle-memory three-section meeting template
✅ Carry-forward functionality in 1:1s
✅ Timeline with collapsible history
✅ Empty states and placeholders

## Future Enhancements

Based on the design brief, these features could be added:
- Keyboard shortcuts (⌘N, ⌘F, ⌘1/2/3)
- Drag-and-drop reordering
- Real calendar integration
- Autosave indicators
- Inline popover for assignee/date selection
- More screen implementations from brief
- Component library extraction
