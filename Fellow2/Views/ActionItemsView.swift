import SwiftUI
import SwiftData

/// The unified "ultimate" to-do list — every open action item across all meetings.
struct ActionItemsView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \ActionItem.createdAt, order: .reverse) private var items: [ActionItem]
    @Binding var selectedMeetingID: PersistentIdentifier?
    @Binding var section: AppSection
    @State private var tab: Tab = .mine

    private func openMeeting(_ meeting: Meeting) {
        selectedMeetingID = meeting.persistentModelID
        section = .today
    }

    enum Tab: String, CaseIterable, Identifiable {
        case mine = "My items", others = "Assigned to others"
        var id: String { rawValue }
    }

    private var visible: [ActionItem] {
        switch tab {
        case .mine: items.filter { !$0.isDone }
        case .others: items.filter { !$0.isDone && $0.assignee != nil }
        }
    }

    private var groups: [(String, [ActionItem])] {
        let cal = Calendar.current
        let todayStart = cal.startOfDay(for: .now)
        var overdue: [ActionItem] = [], today: [ActionItem] = [], upcoming: [ActionItem] = [], noDate: [ActionItem] = []
        for item in visible {
            guard let due = item.dueDate else { noDate.append(item); continue }
            if due < todayStart { overdue.append(item) }
            else if cal.isDateInToday(due) { today.append(item) }
            else { upcoming.append(item) }
        }
        return [("Overdue", overdue), ("Today", today), ("Upcoming", upcoming), ("Inbox", noDate)]
            .filter { !$0.1.isEmpty }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Action items").font(.system(size: 22, weight: .semibold))
                Spacer()
            }
            .padding(.horizontal, 28).padding(.top, 24).padding(.bottom, 12)

            Picker("", selection: $tab) {
                ForEach(Tab.allCases) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)
            .fixedSize()
            .padding(.horizontal, 28)

            List {
                ForEach(groups, id: \.0) { group in
                    Section {
                        ForEach(group.1) { item in
                            UnifiedActionItemRow(item: item, onOpen: openMeeting) { context.delete(item) }
                        }
                    } header: {
                        HStack(spacing: 6) {
                            if group.0 == "Inbox" { Image(systemName: "tray") }
                            Text(group.0)
                            Text("\(group.1.count)").foregroundStyle(Theme.textTertiary)
                        }
                    }
                }
                if groups.isEmpty {
                    ContentUnavailableView("All clear", systemImage: "checkmark.circle",
                                           description: Text("No open action items."))
                }
            }
            .listStyle(.inset)
        }
    }
}

struct UnifiedActionItemRow: View {
    @Bindable var item: ActionItem
    var onOpen: (Meeting) -> Void = { _ in }
    var onDelete: () -> Void = {}
    @State private var hovering = false

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            ActionCheckbox(isDone: item.isDone) {
                item.isDone.toggle()
                item.completedAt = item.isDone ? .now : nil
            }

            VStack(alignment: .leading, spacing: 3) {
                Text(item.text.isEmpty ? "Untitled" : item.text)
                    .font(.system(size: 14))
                    .strikethrough(item.isDone, color: Theme.textTertiary)
                // Source / series line — click to jump to the source meeting (like Fellow).
                if let meeting = item.meeting {
                    Button { onOpen(meeting) } label: {
                        Text(meeting.title)
                            .font(.system(size: 11))
                            .foregroundStyle(hovering ? Theme.accent : Theme.textTertiary)
                            .underline(hovering)
                    }
                    .buttonStyle(.plain)
                    .help("Open “\(meeting.title)”")
                } else if hovering {
                    Text("No series")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.textTertiary)
                }
            }

            Spacer(minLength: 8)

            if let due = item.dueDate { DueDatePill(date: due) }
            if let assignee = item.assignee {
                AvatarView(person: assignee, size: 22)
            } else if hovering {
                Image(systemName: "person.crop.circle.badge.plus").foregroundStyle(Theme.textTertiary)
            }
            // ⋮ overflow only on hover; reserve its width otherwise to avoid layout jump.
            if hovering {
                RowMenu {
                    Button("Due today") { item.dueDate = Calendar.current.startOfDay(for: .now) }
                    Button("Due tomorrow") {
                        item.dueDate = Calendar.current.date(byAdding: .day, value: 1,
                                                             to: Calendar.current.startOfDay(for: .now))
                    }
                    if item.dueDate != nil { Button("Clear due date") { item.dueDate = nil } }
                    Divider()
                    Button("Delete", role: .destructive, action: onDelete)
                }
            } else {
                Color.clear.frame(width: 16, height: 1)
            }
        }
        .padding(.vertical, 6).padding(.horizontal, 10)
        .background(hovering ? Theme.hover : .clear, in: RoundedRectangle(cornerRadius: 8))
        .onHover { hovering = $0 }
        .animation(.easeInOut(duration: 0.18), value: hovering)
    }
}
