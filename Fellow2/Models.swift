import Foundation
import SwiftData

/// Kind of meeting. Drives the 1:1-vs-team behavior (e.g. per-person Streams).
enum MeetingKind: String, Codable, CaseIterable {
    case oneOnOne, team, manual

    var label: String {
        switch self {
        case .oneOnOne: "1:1"
        case .team: "Team"
        case .manual: "Note"
        }
    }
}

@Model
final class Person {
    var name: String
    var email: String?
    var role: String?
    /// Hex seed used to tint the avatar.
    var colorHex: String
    /// True for the single record representing the current user (enables self-assignment).
    var isMe: Bool = false

    @Relationship(deleteRule: .nullify, inverse: \ActionItem.assignee)
    var assignedItems: [ActionItem] = []

    /// Meetings this person attends — inverse of `Meeting.attendees`. Required for the
    /// attendees relationship to persist (SwiftData drops to-many relationships with no inverse).
    var meetings: [Meeting] = []

    init(name: String, email: String? = nil, role: String? = nil, colorHex: String = "#2D6BE6") {
        self.name = name
        self.email = email
        self.role = role
        self.colorHex = colorHex
    }

    /// "Ana P." → "AP"
    var initials: String {
        let parts = name.split(separator: " ").prefix(2)
        return parts.compactMap { $0.first.map(String.init) }.joined().uppercased()
    }
}

/// A persistent thread that gives 1:1s continuity over time (Fellow's "Stream").
@Model
final class MeetingStream {
    var title: String
    var kindRaw: String

    @Relationship(deleteRule: .nullify)
    var person: Person?

    @Relationship(deleteRule: .nullify, inverse: \Meeting.stream)
    var meetings: [Meeting] = []

    init(title: String, kind: MeetingKind = .oneOnOne, person: Person? = nil) {
        self.title = title
        self.kindRaw = kind.rawValue
        self.person = person
    }

    var kind: MeetingKind {
        get { MeetingKind(rawValue: kindRaw) ?? .oneOnOne }
        set { kindRaw = newValue.rawValue }
    }
}

@Model
final class Meeting {
    var title: String
    var start: Date
    var end: Date
    var kindRaw: String
    /// Set when imported from EventKit so we can dedupe on re-sync.
    var ekEventIdentifier: String?
    /// The free-text "Notepad" block of the fixed note template.
    var notepad: String

    @Relationship(deleteRule: .cascade, inverse: \TalkingPoint.meeting)
    var talkingPoints: [TalkingPoint] = []

    @Relationship(deleteRule: .cascade, inverse: \ActionItem.meeting)
    var actionItems: [ActionItem] = []

    @Relationship(deleteRule: .nullify, inverse: \Person.meetings)
    var attendees: [Person] = []

    var stream: MeetingStream?

    init(title: String, start: Date, end: Date, kind: MeetingKind = .manual, notepad: String = "") {
        self.title = title
        self.start = start
        self.end = end
        self.kindRaw = kind.rawValue
        self.notepad = notepad
    }

    var kind: MeetingKind {
        get { MeetingKind(rawValue: kindRaw) ?? .manual }
        set { kindRaw = newValue.rawValue }
    }
}

/// "Talking Points" block — circle bullets.
@Model
final class TalkingPoint {
    var text: String
    var isCovered: Bool
    var order: Int
    var meeting: Meeting?

    init(text: String, isCovered: Bool = false, order: Int = 0) {
        self.text = text
        self.isCovered = isCovered
        self.order = order
    }
}

/// "Action Items" block — checkboxes. Also the unit of the unified "My To-dos" list.
@Model
final class ActionItem {
    var text: String
    var isDone: Bool
    var dueDate: Date?
    var createdAt: Date
    var completedAt: Date?
    var order: Int

    /// Who it's assigned to.
    var assignee: Person?
    /// Back-link to the meeting it came from (powers the unified list's "jump to source").
    var meeting: Meeting?

    init(text: String, isDone: Bool = false, dueDate: Date? = nil, order: Int = 0) {
        self.text = text
        self.isDone = isDone
        self.dueDate = dueDate
        self.createdAt = .now
        self.order = order
    }
}
