import SwiftUI
import SwiftData

/// THE core screen — Fellow's fixed 3-block note template:
/// Talking Points (○) → Action Items (☐) → Notepad (•).
struct MeetingNoteView: View {
    @Environment(\.modelContext) private var context
    @Query(filter: #Predicate<Person> { $0.isMe }) private var mePeople: [Person]
    @Bindable var meeting: Meeting

    /// Assignee choices: "Me" first (self-assignment), then the meeting's other attendees.
    private var assigneeOptions: [Person] {
        let others = meeting.attendees.filter { !$0.isMe }
        if let me = mePeople.first { return [me] + others }
        return others
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                header

                // "Prep for this meeting" — hidden until the prep flow (pulls last meeting + briefs) exists.
                // Button {
                //     // placeholder: prep flow (pulls last meeting + briefs) — future
                // } label: {
                //     Label("Prep for this meeting", systemImage: "calendar")
                //         .font(.system(size: 12, weight: .medium))
                // }
                // .buttonStyle(.bordered)
                // .controlSize(.small)

                talkingPoints
                actionItems
                notepad
            }
            .padding(32)
            .frame(maxWidth: 760, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .center)
        }
        .background(Color(nsColor: .textBackgroundColor))
    }

    // MARK: Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                TextField("Untitled meeting", text: $meeting.title)
                    .textFieldStyle(.plain)
                    .font(.system(size: 22, weight: .semibold))
                if meeting.kind == .oneOnOne {
                    Text("1:1").font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Theme.accent)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(Theme.accentSubtle, in: Capsule())
                }
            }
            HStack(spacing: 10) {
                Text(Self.dateLabel(meeting.start))
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.textSecondary)
                if !meeting.attendees.isEmpty {
                    HStack(spacing: -6) {
                        ForEach(meeting.attendees) { person in
                            AvatarView(person: person, size: 22)
                                .overlay(Circle().stroke(Color(nsColor: .textBackgroundColor), lineWidth: 1.5))
                        }
                    }
                }
            }
        }
    }

    // MARK: Talking Points (○)

    private var talkingPoints: some View {
        NoteSection(title: "Talking Points", subtitle: "The things to talk about") {
            ForEach(meeting.talkingPoints.sorted { $0.order < $1.order }) { point in
                TalkingPointRow(point: point) { delete(point) }
            }
            AddRow(symbol: "circle", placeholder: "New talking point") {
                let tp = TalkingPoint(text: "", order: meeting.talkingPoints.count)
                tp.meeting = meeting
                context.insert(tp)
            }
        }
    }

    // MARK: Action Items (☐)

    private var actionItems: some View {
        NoteSection(title: "Action Items", subtitle: "What came out of this meeting? What are your next steps?") {
            ForEach(meeting.actionItems.sorted { $0.order < $1.order }) { item in
                ActionItemRow(item: item, people: assigneeOptions) { delete(item) }
            }
            AddRow(symbol: "square", placeholder: "New action item") {
                let ai = ActionItem(text: "", order: meeting.actionItems.count)
                ai.meeting = meeting
                context.insert(ai)
            }
        }
    }

    // MARK: Notepad (•)

    private var notepad: some View {
        NoteSection(title: "Notepad", subtitle: "Anything else to write down?") {
            TextEditor(text: $meeting.notepad)
                .font(.system(size: 14))
                .frame(minHeight: 120)
                .scrollContentBackground(.hidden)
                .overlay(alignment: .topLeading) {
                    if meeting.notepad.isEmpty {
                        Text("Start typing…")
                            .font(.system(size: 14))
                            .foregroundStyle(Theme.textTertiary)
                            .padding(.top, 8).padding(.leading, 5)
                            .allowsHitTesting(false)
                    }
                }
        }
    }

    private func delete<T: PersistentModel>(_ object: T) {
        context.delete(object)
    }

    static func dateLabel(_ date: Date) -> String {
        let f = DateFormatter(); f.dateFormat = "EEE, MMM d · h:mm a"
        return f.string(from: date)
    }
}

/// A titled note block (bold header + gray subtitle + content).
struct NoteSection<Content: View>: View {
    let title: String
    let subtitle: String
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.system(size: 16, weight: .semibold))
            Text(subtitle).font(.system(size: 13)).foregroundStyle(Theme.textSecondary)
            VStack(alignment: .leading, spacing: 4) { content }
                .padding(.top, 2)
        }
    }
}

struct TalkingPointRow: View {
    @Bindable var point: TalkingPoint
    var onDelete: () -> Void
    @State private var hovering = false

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Button { point.isCovered.toggle() } label: {
                // Hover fills the circle, mirroring Fellow's checkbox affordance.
                Image(systemName: point.isCovered ? "largecircle.fill.circle"
                                  : (hovering ? "smallcircle.filled.circle" : "circle"))
                    .foregroundStyle(point.isCovered ? Theme.accent
                                     : (hovering ? Theme.accent.opacity(0.5) : Theme.textTertiary))
            }
            .buttonStyle(.plain)
            TextField("Talking point", text: $point.text, axis: .vertical)
                .textFieldStyle(.plain)
                .font(.system(size: 14))
                .strikethrough(point.isCovered, color: Theme.textTertiary)
            Spacer(minLength: 0)
            if hovering {
                RowMenu {
                    Button(point.isCovered ? "Mark not covered" : "Mark covered") { point.isCovered.toggle() }
                    Divider()
                    Button("Delete", role: .destructive, action: onDelete)
                }
            }
        }
        .padding(.vertical, 3).padding(.horizontal, 6)
        .background(hovering ? Theme.hover : .clear, in: RoundedRectangle(cornerRadius: 6))
        .onHover { hovering = $0 }
        .animation(.easeInOut(duration: 0.18), value: hovering)
        .contextMenu { Button("Delete", role: .destructive, action: onDelete) }
    }
}

struct ActionItemRow: View {
    @Bindable var item: ActionItem
    var people: [Person]
    var onDelete: () -> Void
    @State private var hovering = false
    @State private var showPicker = false
    /// Non-nil while an "@…" mention is being typed; holds the query after the "@".
    @State private var mentionQuery: String? = nil

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            ActionCheckbox(isDone: item.isDone) { toggle() }

            TextField("Action item", text: $item.text, axis: .vertical)
                .textFieldStyle(.plain)
                .font(.system(size: 14))
                .strikethrough(item.isDone, color: Theme.textTertiary)
                .foregroundStyle(item.isDone ? Theme.textTertiary : .primary)
                .onChange(of: item.text) { _, _ in detectMention() }

            Spacer(minLength: 8)

            if let due = item.dueDate { DueDatePill(date: due) }

            Button {
                mentionQuery = nil
                showPicker = true
            } label: {
                if let a = item.assignee {
                    AvatarView(person: a, size: 22)
                } else {
                    Image(systemName: "person.crop.circle.badge.plus")
                        .font(.system(size: 18))
                        .foregroundStyle(hovering ? Theme.textSecondary : Theme.textTertiary)
                }
            }
            .buttonStyle(.plain)
            .popover(isPresented: $showPicker, arrowEdge: .bottom) {
                AssigneePicker(people: people, current: item.assignee,
                               filter: mentionQuery ?? "") { picked in assign(picked) }
            }

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
            }
        }
        .padding(.vertical, 3).padding(.horizontal, 6)
        .background(hovering ? Theme.hover : .clear, in: RoundedRectangle(cornerRadius: 6))
        .onHover { hovering = $0 }
        .animation(.easeInOut(duration: 0.18), value: hovering)
        .contextMenu {
            Button(item.dueDate == nil ? "Set due today" : "Clear due date") {
                item.dueDate = item.dueDate == nil ? Calendar.current.startOfDay(for: .now) : nil
            }
            Button("Delete", role: .destructive, action: onDelete)
        }
    }

    private func toggle() {
        item.isDone.toggle()
        item.completedAt = item.isDone ? .now : nil
    }

    /// Detects an in-progress "@mention" at the caret and opens the assignee picker.
    private func detectMention() {
        if let at = item.text.lastIndex(of: "@") {
            let after = item.text[item.text.index(after: at)...]
            if !after.contains(where: { $0 == " " || $0 == "\n" }) {
                mentionQuery = String(after)
                showPicker = true
                return
            }
        }
        if mentionQuery != nil {   // the mention ended (space typed / "@" removed)
            mentionQuery = nil
            showPicker = false
        }
    }

    /// Assigns the picked person and, if this came from an "@mention", strips the token.
    private func assign(_ person: Person?) {
        item.assignee = person
        if mentionQuery != nil, let at = item.text.lastIndex(of: "@") {
            item.text.removeSubrange(at..<item.text.endIndex)
        }
        mentionQuery = nil
        showPicker = false
    }
}

/// Single-select assignee picker shown in a popover (click the avatar, or type "@").
struct AssigneePicker: View {
    let people: [Person]
    let current: Person?
    var filter: String = ""
    var onPick: (Person?) -> Void

    private var filtered: [Person] {
        guard !filter.isEmpty else { return people }
        return people.filter { $0.name.localizedCaseInsensitiveContains(filter) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            PickerRow(systemImage: "person.crop.circle.badge.xmark", title: "Unassigned",
                      selected: current == nil) { onPick(nil) }
            if !filtered.isEmpty { Divider().padding(.vertical, 2) }
            ForEach(filtered) { p in
                Button { onPick(p) } label: {
                    HStack(spacing: 8) {
                        AvatarView(person: p, size: 22)
                        Text(p.isMe ? "\(p.name) (You)" : p.name).font(.system(size: 13))
                        Spacer(minLength: 8)
                        if p.persistentModelID == current?.persistentModelID {
                            Image(systemName: "checkmark").foregroundStyle(Theme.accent)
                        }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
            if filtered.isEmpty {
                Text(filter.isEmpty ? "No attendees on this meeting" : "No matches")
                    .font(.system(size: 12)).foregroundStyle(Theme.textTertiary)
                    .padding(.vertical, 4)
            }
        }
        .padding(8)
        .frame(width: 248)
    }
}

private struct PickerRow: View {
    let systemImage: String
    let title: String
    let selected: Bool
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: systemImage).foregroundStyle(Theme.textSecondary).frame(width: 22)
                Text(title).font(.system(size: 13))
                Spacer(minLength: 8)
                if selected { Image(systemName: "checkmark").foregroundStyle(Theme.accent) }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// Compact "⋯" overflow menu revealed on row hover.
struct RowMenu<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        Menu {
            content
        } label: {
            Image(systemName: "ellipsis").foregroundStyle(Theme.textTertiary)
        }
        .menuStyle(.borderlessButton)
        .menuIndicator(.hidden)
        .fixedSize()
    }
}

/// "+ New …" affordance at the end of a block.
struct AddRow: View {
    let symbol: String
    let placeholder: String
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: symbol).foregroundStyle(Theme.textTertiary)
                Text(placeholder).font(.system(size: 14)).foregroundStyle(Theme.textTertiary)
                Spacer(minLength: 0)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .padding(.vertical, 2)
    }
}
