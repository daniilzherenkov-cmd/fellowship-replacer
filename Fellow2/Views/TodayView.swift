import SwiftUI
import SwiftData
import AppKit

/// Calendar section: day-agenda panel (Today/Week toggle) + detail (note or week grid).
struct CalendarSectionView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \Meeting.start) private var meetings: [Meeting]
    @Binding var selectedMeetingID: PersistentIdentifier?
    @Binding var columnVisibility: NavigationSplitViewVisibility
    @State private var calendar = CalendarService()
    @State private var google = GoogleCalendarService()
    @State private var mode: CalMode = .today
    @State private var selectedDate = Calendar.current.startOfDay(for: .now)
    @State private var showDatePicker = false
    @State private var showReimportConfirm = false

    enum CalMode: String, CaseIterable { case today = "Today", week = "Week" }

    private var dayMeetings: [Meeting] {
        meetings.filter { Calendar.current.isDate($0.start, inSameDayAs: selectedDate) }
    }
    private var selected: Meeting? {
        meetings.first { $0.persistentModelID == selectedMeetingID }
    }
    private var isViewingToday: Bool { Calendar.current.isDateInToday(selectedDate) }
    private var nowLineIndex: Int? {
        guard isViewingToday else { return nil }   // "Now" line only makes sense on today
        return dayMeetings.firstIndex { $0.start > .now }
    }

    var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            VStack(spacing: 0) {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 4) {
                        Button { showDatePicker.toggle() } label: {
                            HStack(spacing: 4) {
                                Text(dayHeader).font(.system(size: 14, weight: .semibold))
                                Image(systemName: "chevron.down").font(.system(size: 9))
                                    .foregroundStyle(Theme.textSecondary)
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .popover(isPresented: $showDatePicker, arrowEdge: .bottom) {
                            FellowDatePicker(selectedDate: $selectedDate,
                                             weekMode: mode == .week) { showDatePicker = false }
                        }
                        Spacer()
                    }
                    Picker("", selection: $mode) {
                        ForEach(CalMode.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .labelsHidden()
                }
                .padding(12)
                Divider()

                if calendar.needsAccess {
                    CalendarAccessBanner(denied: calendar.accessDenied) {
                        if calendar.accessDenied {
                            // macOS won't re-prompt once denied — deep-link to the pane.
                            if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Calendars") {
                                NSWorkspace.shared.open(url)
                            }
                        } else {
                            Task { await calendar.requestAccess(); calendar.sync(into: context) }
                        }
                    }
                }

                ScrollView {
                    LazyVStack(spacing: 4) {
                        ForEach(Array(dayMeetings.enumerated()), id: \.element.persistentModelID) { idx, meeting in
                            if idx == nowLineIndex { NowLine().padding(.vertical, 2) }
                            AgendaCard(
                                meeting: meeting,
                                isSelected: selectedMeetingID == meeting.persistentModelID,
                                isPast: meeting.end < .now
                            ) {
                                selectedMeetingID = meeting.persistentModelID
                                mode = .today
                            }
                        }
                    }
                    .padding(8)
                }
                .background(Color(nsColor: .textBackgroundColor))
            }
            .background(Color(nsColor: .textBackgroundColor))   // override grey sidebar material
            .background(DeVibrancy())                            // disable the sidebar NSVisualEffectView
            .navigationSplitViewColumnWidth(min: 240, ideal: 268)
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button {
                            Task { await calendar.requestAccess(); calendar.sync(into: context) }
                        } label: { Label("Sync macOS Calendar", systemImage: "menubar.arrow.up.rectangle") }
                        Button {
                            Task { await google.connect(); await google.sync(into: context) }
                        } label: { Label("Connect Google Calendar", systemImage: "globe") }
                        Divider()
                        Button(role: .destructive) {
                            showReimportConfirm = true
                        } label: { Label("Re-import macOS Calendar (clean)", systemImage: "arrow.triangle.2.circlepath") }
                    } label: {
                        Label("Sync", systemImage: "arrow.clockwise")
                    }
                }
            }
        } detail: {
            if mode == .today, let meeting = selected {
                MeetingNoteView(meeting: meeting)
            } else {
                WeekGridView(meetings: meetings, anchorDate: selectedDate) { id in
                    selectedMeetingID = id
                    mode = .today
                }
            }
        }
        .onChange(of: selectedMeetingID) { _, newValue in
            if newValue != nil { mode = .today }
        }
        .onChange(of: mode) { _, newValue in
            if newValue == .week { selectedMeetingID = nil }
        }
        .onChange(of: selectedDate) { _, _ in showDatePicker = false }
        .task { calendar.refreshStatus() }
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
            calendar.refreshStatus()   // clear the banner after the user grants access in Settings
        }
        .confirmationDialog("Re-import calendar?", isPresented: $showReimportConfirm,
                            titleVisibility: .visible) {
            Button("Re-import", role: .destructive) {
                Task { await calendar.reimport(into: context) }
            }
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("Removes calendar events that have no notes and pulls a fresh copy. Meetings where you've written talking points, action items, or notes are kept.")
        }
    }

    private var dayHeader: String {
        let f = DateFormatter(); f.dateFormat = "EEE, MMM d"
        return f.string(from: selectedDate)
    }
}

struct NowLine: View {
    var body: some View {
        HStack(spacing: 6) {
            Rectangle().fill(Theme.now).frame(height: 1)
            Text("Now").font(.system(size: 10, weight: .medium)).foregroundStyle(Theme.now)
            Rectangle().fill(Theme.now).frame(height: 1)
        }
    }
}

/// Shown atop the agenda when Fellow 2 lacks Calendar read access. For an active denial it
/// deep-links to System Settings (macOS only prompts once); when access was never requested
/// it offers to ask. Turns a silent empty agenda into a self-service fix.
struct CalendarAccessBanner: View {
    let denied: Bool
    var action: () -> Void

    var body: some View {
        let tint = denied ? Theme.due : Theme.accent
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: denied ? "calendar.badge.exclamationmark" : "calendar.badge.plus")
                .font(.system(size: 15))
                .foregroundStyle(tint)
            VStack(alignment: .leading, spacing: 4) {
                Text(denied ? "No Calendar access" : "Connect your calendar")
                    .font(.system(size: 13, weight: .semibold))
                Text(denied
                     ? "Fellow 2 can’t read your meetings. Turn on Calendars for Fellow 2 in System Settings, then Sync."
                     : "Allow Calendar access to pull meetings from the Mac Calendar app.")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                Button(action: action) {
                    Text(denied ? "Open Settings" : "Allow Access")
                        .font(.system(size: 11, weight: .medium))
                }
                .buttonStyle(.plain)
                .foregroundStyle(tint)
                .padding(.top, 2)
            }
            Spacer(minLength: 0)
        }
        .padding(10)
        .background(tint.opacity(0.10), in: RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(tint.opacity(0.25)))
        .padding(8)
    }
}

/// Fellow-style agenda card: faint card background, colored left bar, custom (non-blue) selection.
struct AgendaCard: View {
    let meeting: Meeting
    let isSelected: Bool
    let isPast: Bool
    var onTap: () -> Void
    @State private var hovering = false
    // @State private var showDetail = false   // hover event popover — hidden until events carry real data

    private var background: Color {
        if isSelected { return Theme.accentSubtle }
        if hovering { return Theme.hover }
        return .clear   // clean cards on white, like Fellow (no grey film)
    }

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 10) {
                RoundedRectangle(cornerRadius: 2)
                    .fill(meeting.kind == .oneOnOne ? Theme.accent : Theme.textTertiary)
                    .frame(width: 3)
                    .frame(maxHeight: .infinity)
                VStack(alignment: .leading, spacing: 3) {
                    Text(meeting.title)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(isSelected ? Theme.accent : .primary)
                        .lineLimit(2)
                    HStack(spacing: 6) {
                        Text(AgendaCard.timeRange(meeting))
                            .font(.system(size: 12))
                            .foregroundStyle(Theme.textSecondary)
                        if meeting.kind == .oneOnOne {
                            Text("1:1")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundStyle(Theme.accent)
                                .padding(.horizontal, 5).padding(.vertical, 1)
                                .background(Theme.accent.opacity(0.12), in: Capsule())
                        }
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(.vertical, 8)
            .padding(.horizontal, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(background, in: RoundedRectangle(cornerRadius: 8))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { hovering = $0 }
        // Hover event popover — hidden until events carry real data (Meet link, attendees, RSVP).
        // .onHover { h in
        //     hovering = h
        //     if h {
        //         Task {
        //             try? await Task.sleep(for: .milliseconds(450))
        //             if hovering { showDetail = true }
        //         }
        //     } else { showDetail = false }
        // }
        // .popover(isPresented: $showDetail, arrowEdge: .trailing) {
        //     EventDetailPopover(meeting: meeting)
        // }
    }

    static func timeRange(_ m: Meeting) -> String {
        let f = DateFormatter(); f.dateFormat = "h:mm a"
        return "\(f.string(from: m.start)) – \(f.string(from: m.end))"
    }
}

/// Hover/click event card — mirrors Fellow's calendar popover (attendees, Join Meet, RSVP).
struct EventDetailPopover: View {
    let meeting: Meeting
    @State private var rsvp = "Yes"

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Circle().fill(meeting.kind == .oneOnOne ? Theme.accent : Theme.textTertiary)
                    .frame(width: 10, height: 10)
                Text(meeting.title).font(.system(size: 15, weight: .semibold))
                Spacer()
                Image(systemName: "square.and.pencil").foregroundStyle(Theme.textSecondary)
                Image(systemName: "ellipsis").foregroundStyle(Theme.textSecondary)
            }

            Label(Self.dateLine(meeting), systemImage: "calendar").font(.system(size: 13))

            if !meeting.attendees.isEmpty {
                Label("\(meeting.attendees.count) attendees", systemImage: "person.2")
                    .font(.system(size: 13)).foregroundStyle(Theme.textSecondary)
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(meeting.attendees) { p in
                        HStack(spacing: 8) {
                            Image(systemName: "checkmark.circle.fill").foregroundStyle(Theme.now)
                            AvatarView(person: p, size: 20)
                            Text(p.name).font(.system(size: 13))
                        }
                    }
                }
                .padding(.leading, 4)
            }

            Button { } label: { Label("Join Google Meet", systemImage: "video.fill") }
                .buttonStyle(.bordered).controlSize(.small)

            Divider()
            HStack(spacing: 10) {
                Label("Going?", systemImage: "person.crop.circle.badge.checkmark")
                    .font(.system(size: 13, weight: .medium))
                ForEach(["Yes", "No", "Maybe"], id: \.self) { option in
                    Button(option) { rsvp = option }
                        .buttonStyle(.plain)
                        .font(.system(size: 13, weight: rsvp == option ? .semibold : .regular))
                        .foregroundStyle(rsvp == option ? Theme.accent : Theme.textSecondary)
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(rsvp == option ? Theme.accentSubtle : .clear, in: Capsule())
                }
            }
        }
        .padding(16)
        .frame(width: 340)
    }

    static func dateLine(_ m: Meeting) -> String {
        let f = DateFormatter(); f.dateFormat = "h:mm a"
        return "Today from \(f.string(from: m.start)) – \(f.string(from: m.end))"
    }
}

/// Simplified week grid (Sun–Sat) — events listed under their day, today highlighted.
struct WeekGridView: View {
    let meetings: [Meeting]
    var anchorDate: Date = .now
    var onSelect: (PersistentIdentifier) -> Void

    private let weekdaySymbols = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

    private var weekDays: [Date] {
        let cal = Calendar.current
        let base = cal.startOfDay(for: anchorDate)
        let weekday = cal.component(.weekday, from: base)
        guard let sunday = cal.date(byAdding: .day, value: -(weekday - 1), to: base) else { return [] }
        return (0..<7).compactMap { cal.date(byAdding: .day, value: $0, to: sunday) }
    }

    private var weekTitle: String {
        let cal = Calendar.current
        if weekDays.contains(where: { cal.isDateInToday($0) }) { return "This week" }
        guard let first = weekDays.first, let last = weekDays.last else { return "Week" }
        let f = DateFormatter(); f.dateFormat = "MMM d"
        return "\(f.string(from: first)) – \(f.string(from: last))"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(weekTitle).font(.system(size: 16, weight: .semibold))
                Spacer()
                // "+ New" meeting — hidden until create-meeting is wired (needs Google write API).
                // Button { } label: { Label("New", systemImage: "plus") }
                //     .buttonStyle(.borderedProminent).tint(Theme.accent).controlSize(.small)
            }

            HStack(alignment: .top, spacing: 1) {
                ForEach(Array(weekDays.enumerated()), id: \.element) { idx, day in
                    DayColumn(
                        weekday: weekdaySymbols[idx],
                        date: day,
                        isToday: Calendar.current.isDateInToday(day),
                        meetings: meetings.filter { Calendar.current.isDate($0.start, inSameDayAs: day) },
                        onSelect: onSelect
                    )
                }
            }
            .background(Theme.hairline)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.hairline))

            Spacer()
        }
        .padding(20)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color(nsColor: .textBackgroundColor))
    }
}

struct DayColumn: View {
    let weekday: String
    let date: Date
    let isToday: Bool
    let meetings: [Meeting]
    var onSelect: (PersistentIdentifier) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(weekday)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(isToday ? Theme.accent : .primary)
            Text(Self.dayNumber(date))
                .font(.system(size: 10))
                .foregroundStyle(isToday ? Theme.accent : Theme.textSecondary)

            ForEach(meetings.sorted { $0.start < $1.start }) { m in
                Button { onSelect(m.persistentModelID) } label: {
                    VStack(alignment: .leading, spacing: 1) {
                        Text(Self.time(m.start)).font(.system(size: 9, weight: .medium))
                            .foregroundStyle(Theme.accent)
                        Text(m.title).font(.system(size: 10, weight: .medium)).lineLimit(2)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 6).padding(.vertical, 4)
                    .background(Theme.accentSubtle.opacity(0.6))
                    .overlay(alignment: .leading) { Rectangle().fill(Theme.accent).frame(width: 2) }
                    .clipShape(RoundedRectangle(cornerRadius: 4))
                }
                .buttonStyle(.plain)
            }
            Spacer(minLength: 0)
        }
        .padding(8)
        .frame(maxWidth: .infinity, minHeight: 220, alignment: .topLeading)
        .background(isToday ? Theme.accentSubtle : Color(nsColor: .textBackgroundColor))
    }

    static func dayNumber(_ d: Date) -> String {
        let f = DateFormatter(); f.dateFormat = "d"; return f.string(from: d)
    }
    static func time(_ d: Date) -> String {
        let f = DateFormatter(); f.dateFormat = "h:mm a"; return f.string(from: d)
    }
}

/// Clean Fellow-style month calendar: weekday row, today in blue, selected day as a filled
/// circle, ‹ › month navigation. Replaces the macOS-looking graphical DatePicker.
struct FellowDatePicker: View {
    @Binding var selectedDate: Date
    var weekMode: Bool = false
    var onPick: () -> Void = {}
    @State private var visibleMonth: Date
    @State private var hoveredDate: Date? = nil

    init(selectedDate: Binding<Date>, weekMode: Bool = false, onPick: @escaping () -> Void = {}) {
        _selectedDate = selectedDate
        _visibleMonth = State(initialValue: selectedDate.wrappedValue)
        self.weekMode = weekMode
        self.onPick = onPick
    }

    private let weekdays = ["S", "M", "T", "W", "T", "F", "S"]
    private var cal: Calendar {
        var c = Calendar.current; c.firstWeekday = 1; return c   // Sunday-first, matches header
    }

    var body: some View {
        VStack(spacing: 10) {
            HStack {
                Text(monthTitle).font(.system(size: 14, weight: .semibold))
                Spacer()
                Button { shiftMonth(-1) } label: { Image(systemName: "chevron.left") }
                    .buttonStyle(.plain).foregroundStyle(Theme.textSecondary)
                Button { shiftMonth(1) } label: { Image(systemName: "chevron.right") }
                    .buttonStyle(.plain).foregroundStyle(Theme.textSecondary)
            }

            HStack(spacing: 0) {
                ForEach(Array(weekdays.enumerated()), id: \.offset) { _, d in
                    Text(d).font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Theme.textTertiary)
                        .frame(maxWidth: .infinity)
                }
            }

            let days = monthGrid
            VStack(spacing: 4) {
                ForEach(0..<6, id: \.self) { row in
                    HStack(spacing: 0) {
                        ForEach(0..<7, id: \.self) { col in
                            dayCell(days[row * 7 + col])
                        }
                    }
                }
            }

            Button("Today") {
                let t = cal.startOfDay(for: .now)
                visibleMonth = t
                selectedDate = t
                onPick()
            }
            .buttonStyle(.plain)
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(Theme.accent)
        }
        .padding(14)
        .frame(width: 260)
    }

    private func dayCell(_ date: Date) -> some View {
        let isToday = cal.isDateInToday(date)
        let inMonth = cal.isDate(date, equalTo: visibleMonth, toGranularity: .month)
        let selected = weekMode ? sameWeek(date, selectedDate) : cal.isDate(date, inSameDayAs: selectedDate)
        let hovered  = weekMode ? sameWeek(date, hoveredDate) : sameDay(date, hoveredDate)
        let fill: Color = selected ? Theme.accentSubtle : (hovered ? Theme.hover : .clear)
        return Text("\(cal.component(.day, from: date))")
            .font(.system(size: 13, weight: isToday ? .bold : .regular))
            .foregroundStyle(isToday ? Theme.accent : (inMonth ? .primary : Theme.textTertiary))
            .frame(width: 30, height: 30)
            .background(weekMode ? Color.clear : fill, in: RoundedRectangle(cornerRadius: 7))
            .frame(maxWidth: .infinity)
            .background(weekMode ? fill : Color.clear)   // week mode: continuous row strip
            .contentShape(Rectangle())
            .onHover { hoveredDate = $0 ? date : nil }
            .onTapGesture {
                selectedDate = cal.startOfDay(for: date)
                onPick()
            }
    }

    private var monthTitle: String {
        let f = DateFormatter(); f.dateFormat = "MMMM yyyy"
        return f.string(from: visibleMonth)
    }
    private func shiftMonth(_ delta: Int) {
        if let d = cal.date(byAdding: .month, value: delta, to: visibleMonth) { visibleMonth = d }
    }
    private func sameDay(_ a: Date, _ b: Date?) -> Bool {
        guard let b else { return false }
        return cal.isDate(a, inSameDayAs: b)
    }
    private func sameWeek(_ a: Date, _ b: Date?) -> Bool {
        guard let b else { return false }
        return cal.isDate(a, equalTo: b, toGranularity: .weekOfYear)
    }
    /// 6×7 grid (Sunday-first) covering the visible month plus leading/trailing days.
    private var monthGrid: [Date] {
        guard let monthStart = cal.dateInterval(of: .month, for: visibleMonth)?.start,
              let firstCell = cal.dateInterval(of: .weekOfMonth, for: monthStart)?.start
        else { return [] }
        return (0..<42).map { cal.date(byAdding: .day, value: $0, to: firstCell)! }
    }
}

/// Walks up to the enclosing `NSVisualEffectView` (the NavigationSplitView sidebar material)
/// and neutralizes it, so the agenda column renders on a solid background instead of the
/// translucent grey that SwiftUI `.background` can't override.
struct DeVibrancy: NSViewRepresentable {
    func makeNSView(context: Context) -> NSView {
        let view = NSView()
        DispatchQueue.main.async {
            var parent = view.superview
            while let current = parent {
                if let effect = current as? NSVisualEffectView {
                    effect.state = .inactive
                    effect.material = .contentBackground
                }
                parent = current.superview
            }
        }
        return view
    }
    func updateNSView(_ nsView: NSView, context: Context) {}
}
