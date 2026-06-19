import Foundation
import EventKit
import SwiftData

/// Reads the Mac's connected calendars via EventKit (works with any account added to
/// macOS Calendar — Google/Exchange/iCloud). v1 is read-only import. See docs/03 §2.
@Observable
@MainActor
final class CalendarService {
    let store = EKEventStore()
    var authorized = false
    var lastError: String?

    /// Current system authorization, read WITHOUT prompting. Drives the access banner so
    /// we can tell "never asked" apart from "actively denied". Refreshed on app focus.
    var status: EKAuthorizationStatus = EKEventStore.authorizationStatus(for: .event)

    /// Re-read the system status (e.g. after the user returns from System Settings).
    func refreshStatus() { status = EKEventStore.authorizationStatus(for: .event) }

    /// True unless we hold full read access — covers both not-yet-asked and denied.
    var needsAccess: Bool { status != .fullAccess }

    /// User actively denied/restricted access, or granted only write-only (which can't
    /// read events) — distinct from simply never having been asked. macOS won't re-prompt
    /// in this state, so the UI must send them to System Settings.
    var accessDenied: Bool {
        switch status {
        case .denied, .restricted, .writeOnly: return true
        default: return false
        }
    }

    /// macOS 14+ full-access API.
    func requestAccess() async {
        do {
            authorized = try await store.requestFullAccessToEvents()
        } catch {
            lastError = error.localizedDescription
            authorized = false
        }
        status = EKEventStore.authorizationStatus(for: .event)
    }

    /// Imports events in a window around today into SwiftData, deduping by event id.
    /// Also maps each event's attendees → `Person` records so the People tab fills from
    /// the calendar (find-or-create by email; the current user is skipped).
    func sync(into context: ModelContext, daysBack: Int = 90, daysAhead: Int = 90) {
        guard authorized else { return }
        let cal = Calendar.current
        guard let start = cal.date(byAdding: .day, value: -daysBack, to: .now),
              let end = cal.date(byAdding: .day, value: daysAhead, to: .now) else { return }

        let predicate = store.predicateForEvents(withStart: start, end: end, calendars: nil)
        let events = store.events(matching: predicate)

        for ev in events where ev.eventIdentifier != nil {
            // Recurring events share ONE identifier across every occurrence, so include the
            // occurrence start for them — otherwise all instances after the first are skipped.
            let baseID = ev.eventIdentifier ?? ""
            let id = ev.hasRecurrenceRules
                ? "\(baseID)@\(Int(ev.startDate.timeIntervalSinceReferenceDate))"
                : baseID
            let descriptor = FetchDescriptor<Meeting>(
                predicate: #Predicate { $0.ekEventIdentifier == id }
            )
            let existing = (try? context.fetch(descriptor)) ?? []

            let meeting: Meeting
            if let found = existing.first {
                meeting = found
            } else {
                meeting = Meeting(
                    title: ev.title ?? "Untitled",
                    start: ev.startDate,
                    end: ev.endDate
                )
                meeting.ekEventIdentifier = id
                context.insert(meeting)
            }

            // Populate (or backfill) the OTHER attendees if not already linked.
            if meeting.attendees.isEmpty {
                meeting.attendees = people(from: ev, into: context)
            }
            // Include the current user ("Me") among attendees, if they're on this event.
            let all = (ev.attendees ?? []) + [ev.organizer].compactMap { $0 }
            if let mePart = all.first(where: { $0.isCurrentUser }),
               let me = ensureMe(from: mePart, into: context),
               !meeting.attendees.contains(where: { $0.isMe }) {
                meeting.attendees.append(me)
            }
            // 1:1 = exactly ONE *other* attendee (excluding Me).
            meeting.kind = meeting.attendees.filter { !$0.isMe }.count == 1 ? .oneOnOne : .team
        }
        try? context.save()
    }

    /// Find-or-create the single "Me" person (isMe == true), named from the current user's
    /// calendar identity. Reused across all meetings.
    @discardableResult
    private func ensureMe(from participant: EKParticipant, into context: ModelContext) -> Person? {
        let d = FetchDescriptor<Person>(predicate: #Predicate { $0.isMe == true })
        if let found = try? context.fetch(d), let me = found.first { return me }
        let email = Self.email(from: participant)
        let name = Self.displayName(name: participant.name, email: email)
        let me = Person(name: name.isEmpty ? "Me" : name, email: email?.lowercased(), colorHex: "#2D6BE6")
        me.isMe = true
        context.insert(me)
        return me
    }

    /// Clears calendar-imported meetings that have NO user content, then re-syncs. Fixes stale
    /// duplicates (e.g. old recurring keys) without touching meetings you've written notes in.
    func reimport(into context: ModelContext) async {
        await requestAccess()
        guard authorized else { return }
        let descriptor = FetchDescriptor<Meeting>(predicate: #Predicate { $0.ekEventIdentifier != nil })
        if let imported = try? context.fetch(descriptor) {
            for m in imported where m.talkingPoints.isEmpty && m.actionItems.isEmpty && m.notepad.isEmpty {
                context.delete(m)
            }
            try? context.save()
        }
        sync(into: context)
    }

    // MARK: - Attendee → Person mapping

    /// Maps an event's organizer + attendees to `Person` records, find-or-creating by email
    /// and skipping the current user. Deduped per event.
    private func people(from event: EKEvent, into context: ModelContext) -> [Person] {
        var participants = event.attendees ?? []
        if let organizer = event.organizer { participants.append(organizer) }

        var result: [Person] = []
        var seen = Set<String>()
        for p in participants where !p.isCurrentUser {
            let email = Self.email(from: p)
            let key = (email ?? p.name ?? "").lowercased()
            guard !key.isEmpty, seen.insert(key).inserted else { continue }
            if let person = findOrCreatePerson(email: email, name: p.name, into: context) {
                result.append(person)
            }
        }
        return result
    }

    private func findOrCreatePerson(email: String?, name: String?, into context: ModelContext) -> Person? {
        let cleanEmail = email?.lowercased()
        if let e = cleanEmail, !e.isEmpty {
            let d = FetchDescriptor<Person>(predicate: #Predicate { $0.email == e })
            if let found = try? context.fetch(d), let p = found.first { return p }
        }
        let display = Self.displayName(name: name, email: cleanEmail)
        guard !display.isEmpty else { return nil }
        let person = Person(name: display, email: cleanEmail,
                            colorHex: Self.avatarColor(for: cleanEmail ?? display))
        context.insert(person)
        return person
    }

    /// EKParticipant exposes the address as `url`, typically `mailto:foo@bar.com`.
    private static func email(from participant: EKParticipant) -> String? {
        let s = participant.url.absoluteString
        if s.lowercased().hasPrefix("mailto:") { return String(s.dropFirst("mailto:".count)) }
        return s.contains("@") ? s : nil
    }

    /// Prefer the real display name; otherwise title-case the email's local part
    /// ("ana.pereira@dh.com" → "Ana Pereira").
    private static func displayName(name: String?, email: String?) -> String {
        let n = (name ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if !n.isEmpty && n.lowercased() != (email ?? "").lowercased() { return n }
        if let local = email?.split(separator: "@").first {
            return local.split(whereSeparator: { $0 == "." || $0 == "_" || $0 == "-" })
                .map { $0.prefix(1).uppercased() + $0.dropFirst() }
                .joined(separator: " ")
        }
        return n
    }

    private static let palette = ["#2D6BE6", "#6E56CF", "#E8910C", "#0E9F6E",
                                  "#D6336C", "#1098AD", "#E8590C", "#7048E8"]
    /// Deterministic palette pick (stable across launches, unlike `hashValue`).
    private static func avatarColor(for key: String) -> String {
        let sum = key.unicodeScalars.reduce(0) { $0 + Int($1.value) }
        return palette[sum % palette.count]
    }
}
