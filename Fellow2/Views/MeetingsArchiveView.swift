import SwiftUI
import SwiftData

/// All meetings, grouped by day (past → future) with date headers, scrolled to today on open.
/// Selecting one jumps to its note in the Calendar section.
struct MeetingsArchiveView: View {
    @Query(sort: \Meeting.start, order: .forward) private var meetings: [Meeting]
    @Binding var selectedMeetingID: PersistentIdentifier?
    @Binding var section: AppSection

    /// Meetings bucketed by calendar day, days ascending (oldest first).
    private var groups: [(day: Date, items: [Meeting])] {
        let cal = Calendar.current
        let dict = Dictionary(grouping: meetings) { cal.startOfDay(for: $0.start) }
        return dict.keys.sorted().map { day in
            (day: day, items: (dict[day] ?? []).sorted { $0.start < $1.start })
        }
    }

    /// Day to scroll to on open: today if present, else the next upcoming day, else the last.
    private var anchorDay: Date? {
        let cal = Calendar.current
        let today = cal.startOfDay(for: .now)
        if groups.contains(where: { $0.day == today }) { return today }
        return groups.first(where: { $0.day >= today })?.day ?? groups.last?.day
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("All meetings")
                .font(.system(size: 22, weight: .semibold))
                .padding(.horizontal, 28).padding(.top, 24).padding(.bottom, 12)

            if meetings.isEmpty {
                ContentUnavailableView("No meetings yet", systemImage: "folder")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollViewReader { proxy in
                    List {
                        ForEach(groups, id: \.day) { group in
                            Section {
                                ForEach(group.items) { meeting in
                                    Button {
                                        selectedMeetingID = meeting.persistentModelID
                                        section = .today
                                    } label: {
                                        ArchiveRow(meeting: meeting)
                                    }
                                    .buttonStyle(.plain)
                                }
                            } header: {
                                DayHeader(day: group.day)
                            }
                            .id(group.day)
                        }
                    }
                    .listStyle(.inset)
                    .onAppear {
                        if let anchor = anchorDay {
                            DispatchQueue.main.async { proxy.scrollTo(anchor, anchor: .top) }
                        }
                    }
                }
            }
        }
    }
}

/// Group title for a day in the archive — "Today · Jun 3", "Tomorrow · …", or "Monday, Jun 8".
struct DayHeader: View {
    let day: Date
    private var isToday: Bool { Calendar.current.isDateInToday(day) }

    var body: some View {
        Text(label)
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(isToday ? Theme.accent : Theme.textSecondary)
    }

    private var label: String {
        let cal = Calendar.current
        let f = DateFormatter()
        if isToday { f.dateFormat = "'Today' · MMM d" }
        else if cal.isDateInTomorrow(day) { f.dateFormat = "'Tomorrow' · MMM d" }
        else if cal.isDateInYesterday(day) { f.dateFormat = "'Yesterday' · MMM d" }
        else { f.dateFormat = "EEEE, MMM d" }
        return f.string(from: day)
    }
}

struct ArchiveRow: View {
    let meeting: Meeting

    private var openCount: Int { meeting.actionItems.filter { !$0.isDone }.count }

    var body: some View {
        HStack(spacing: 10) {
            Circle()
                .fill(meeting.kind == .oneOnOne ? Theme.accent : Theme.textTertiary)
                .frame(width: 8, height: 8)
            VStack(alignment: .leading, spacing: 2) {
                Text(meeting.title).font(.system(size: 14, weight: .medium))
                Text(Self.dateLabel(meeting.start)).font(.system(size: 11)).foregroundStyle(Theme.textSecondary)
            }
            Spacer()
            if !meeting.attendees.isEmpty {
                HStack(spacing: -6) {
                    ForEach(meeting.attendees.prefix(3)) { AvatarView(person: $0, size: 22) }
                }
            }
            if openCount > 0 {
                Text("\(openCount)")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.due)
                    .padding(.horizontal, 7).padding(.vertical, 2)
                    .background(Theme.due.opacity(0.12), in: Capsule())
            }
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
    }

    static func dateLabel(_ d: Date) -> String {
        let f = DateFormatter(); f.dateFormat = "EEE, MMM d · h:mm a"
        return f.string(from: d)
    }
}
