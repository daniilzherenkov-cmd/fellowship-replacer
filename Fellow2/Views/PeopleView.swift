import SwiftUI
import SwiftData

/// People directory (middle) + per-person 1:1 Stream (detail).
struct PeopleView: View {
    @Query(filter: #Predicate<Person> { !$0.isMe }, sort: \Person.name) private var people: [Person]
    @Query(sort: \Meeting.start) private var meetings: [Meeting]
    @State private var selectedID: PersistentIdentifier?

    private var selected: Person? {
        people.first { $0.persistentModelID == selectedID } ?? people.first
    }

    var body: some View {
        NavigationSplitView {
            List(selection: $selectedID) {
                ForEach(people) { person in
                    HStack(spacing: 10) {
                        AvatarView(person: person, size: 30)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(person.name).font(.system(size: 13, weight: .medium))
                            if let role = person.role {
                                Text(role).font(.system(size: 11)).foregroundStyle(Theme.textSecondary)
                            }
                        }
                    }
                    .padding(.vertical, 2)
                    .tag(person.persistentModelID)
                }
            }
            .navigationSplitViewColumnWidth(min: 240, ideal: 280)
        } detail: {
            if let person = selected {
                PersonStreamView(person: person, allMeetings: meetings)
            } else {
                ContentUnavailableView("No people yet", systemImage: "person.2")
            }
        }
    }
}

/// The persistent 1:1 history for one person — Milena's #1 must-have.
struct PersonStreamView: View {
    let person: Person
    /// All meetings (from PeopleView's @Query) — used to find ones this person attended.
    let allMeetings: [Meeting]

    private var meetings: [Meeting] {
        let attended = allMeetings.filter { m in
            m.attendees.contains { $0.persistentModelID == person.persistentModelID }
        }
        let fromItems = person.assignedItems.compactMap(\.meeting)
        return (attended + fromItems)
            .uniqued()
            .sorted { $0.start > $1.start }
    }

    private var carriedForward: [ActionItem] {
        person.assignedItems.filter { !$0.isDone }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Person header
                HStack(spacing: 14) {
                    AvatarView(person: person, size: 56)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(person.name).font(.system(size: 22, weight: .semibold))
                        if let role = person.role {
                            Text(role).font(.system(size: 13)).foregroundStyle(Theme.textSecondary)
                        }
                        Text("\(carriedForward.count) open to-dos")
                            .font(.system(size: 12)).foregroundStyle(Theme.accent)
                    }
                    Spacer()
                    // "Start next 1:1" — hidden until the create-meeting flow exists.
                    // Button { } label: { Label("Start next 1:1", systemImage: "plus") }
                    //     .buttonStyle(.borderedProminent)
                }

                // Carry-forward strip
                if !carriedForward.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Carried forward (\(carriedForward.count))")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Theme.textSecondary)
                        ForEach(carriedForward) { item in
                            HStack(spacing: 8) {
                                Image(systemName: "square").foregroundStyle(Theme.textTertiary)
                                Text(item.text).font(.system(size: 13))
                                if let due = item.dueDate { DueDatePill(date: due) }
                            }
                        }
                    }
                    .padding(12)
                    .background(Theme.accentSubtle.opacity(0.5), in: RoundedRectangle(cornerRadius: 10))
                }

                // History timeline
                Text("History").font(.system(size: 16, weight: .semibold))
                if meetings.isEmpty {
                    Text("No past 1:1s yet.").font(.system(size: 13)).foregroundStyle(Theme.textSecondary)
                } else {
                    ForEach(meetings) { meeting in
                        StreamEntry(meeting: meeting)
                    }
                }
            }
            .padding(32)
            .frame(maxWidth: 760, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .center)
        }
        .background(Color(nsColor: .textBackgroundColor))
    }
}

struct StreamEntry: View {
    let meeting: Meeting
    @State private var expanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button { expanded.toggle() } label: {
                HStack {
                    Image(systemName: expanded ? "chevron.down" : "chevron.right")
                        .font(.system(size: 11)).foregroundStyle(Theme.textTertiary)
                    Text(MeetingNoteView.dateLabel(meeting.start)).font(.system(size: 13, weight: .medium))
                    Spacer()
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if expanded {
                if !meeting.talkingPoints.isEmpty {
                    Text("Talking points").font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.textSecondary)
                    ForEach(meeting.talkingPoints.sorted { $0.order < $1.order }) { tp in
                        Text("• \(tp.text)").font(.system(size: 13))
                    }
                }
                if !meeting.notepad.isEmpty {
                    Text(meeting.notepad).font(.system(size: 13)).foregroundStyle(.secondary)
                }
            }
        }
        .padding(12)
        .background(Theme.sidebar, in: RoundedRectangle(cornerRadius: 10))
    }
}

extension Array where Element == Meeting {
    /// De-dupe by identity while preserving order.
    func uniqued() -> [Meeting] {
        var seen = Set<PersistentIdentifier>()
        return filter { seen.insert($0.persistentModelID).inserted }
    }
}
