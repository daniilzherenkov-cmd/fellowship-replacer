import SwiftUI
import SwiftData

/// Global search (⌘F) across meetings, people, and action items.
struct SearchView: View {
    @Environment(\.dismiss) private var dismiss
    @Query private var meetings: [Meeting]
    @Query private var people: [Person]
    @Query private var actions: [ActionItem]
    @Binding var selectedMeetingID: PersistentIdentifier?
    @Binding var section: AppSection
    @State private var query = ""

    private var q: String { query.trimmingCharacters(in: .whitespaces).lowercased() }

    private var matchedMeetings: [Meeting] {
        q.isEmpty ? [] : meetings.filter { $0.title.lowercased().contains(q) || $0.notepad.lowercased().contains(q) }
    }
    private var matchedPeople: [Person] {
        q.isEmpty ? [] : people.filter { $0.name.lowercased().contains(q) || ($0.role ?? "").lowercased().contains(q) }
    }
    private var matchedActions: [ActionItem] {
        q.isEmpty ? [] : actions.filter { $0.text.lowercased().contains(q) }
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass").foregroundStyle(Theme.textSecondary)
                TextField("Search notes, people, to-dos…", text: $query)
                    .textFieldStyle(.plain)
                    .font(.system(size: 15))
                Button("Done") { dismiss() }.buttonStyle(.plain).foregroundStyle(Theme.textSecondary)
            }
            .padding(12)
            Divider()

            if q.isEmpty {
                ContentUnavailableView("Search Fellow 2", systemImage: "magnifyingglass",
                                       description: Text("Find meetings, people, and action items."))
                    .frame(maxHeight: .infinity)
            } else {
                List {
                    if !matchedMeetings.isEmpty {
                        Section("Meetings") {
                            ForEach(matchedMeetings) { m in
                                Button { openMeeting(m.persistentModelID) } label: {
                                    Label(m.title, systemImage: "calendar")
                                }.buttonStyle(.plain)
                            }
                        }
                    }
                    if !matchedPeople.isEmpty {
                        Section("People") {
                            ForEach(matchedPeople) { p in
                                Button { section = .people; dismiss() } label: {
                                    HStack(spacing: 8) { AvatarView(person: p, size: 20); Text(p.name) }
                                }.buttonStyle(.plain)
                            }
                        }
                    }
                    if !matchedActions.isEmpty {
                        Section("Action items") {
                            ForEach(matchedActions) { a in
                                Button {
                                    if let mid = a.meeting?.persistentModelID { openMeeting(mid) }
                                    else { section = .actionItems; dismiss() }
                                } label: {
                                    Label(a.text.isEmpty ? "Untitled" : a.text, systemImage: "checkmark.square")
                                }.buttonStyle(.plain)
                            }
                        }
                    }
                    if matchedMeetings.isEmpty && matchedPeople.isEmpty && matchedActions.isEmpty {
                        ContentUnavailableView.search(text: query)
                    }
                }
            }
        }
        .frame(width: 540, height: 460)
    }

    private func openMeeting(_ id: PersistentIdentifier) {
        selectedMeetingID = id
        section = .today
        dismiss()
    }
}
