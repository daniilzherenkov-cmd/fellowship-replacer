import Foundation
import SwiftData

#if canImport(GoogleSignIn) && canImport(GoogleAPIClientForREST_Calendar)
import GoogleSignIn
import GoogleAPIClientForREST_Calendar
import AppKit

/// Sendable snapshot of a calendar event, built inside the GTLR callback so no
/// non-Sendable GTLR object crosses an async boundary (Swift 6 strict concurrency).
private struct GEvent: Sendable {
    let id: String
    let title: String
    let start: Date
    let end: Date
    let attendeeCount: Int
}

/// Direct Google Calendar integration via OAuth (no macOS-Calendar dependency).
/// Requires: the GoogleSignIn + GoogleAPIClientForREST packages, a `GIDClientID` in
/// Info.plist, and the reversed-client-id URL scheme. See docs/07-integrations-and-sync.md.
@Observable
@MainActor
final class GoogleCalendarService {
    var isConnected = GIDSignIn.sharedInstance.currentUser != nil
    var lastError: String?

    private let scope = "https://www.googleapis.com/auth/calendar.readonly"

    func connect() async {
        guard let window = NSApplication.shared.keyWindow ?? NSApplication.shared.windows.first else {
            lastError = "No window available to present Google sign-in."
            return
        }
        do {
            let result = try await GIDSignIn.sharedInstance.signIn(
                withPresenting: window,
                hint: nil,
                additionalScopes: [scope]
            )
            isConnected = result.user.grantedScopes?.contains(scope) ?? true
            lastError = nil
        } catch {
            lastError = error.localizedDescription
            isConnected = false
        }
    }

    func sync(into context: ModelContext, daysBack: Int = 90, daysAhead: Int = 90) async {
        guard let user = GIDSignIn.sharedInstance.currentUser else {
            lastError = "Connect Google Calendar first."
            return
        }
        let service = GTLRCalendarService()
        service.authorizer = user.fetcherAuthorizer

        let cal = Calendar.current
        guard let start = cal.date(byAdding: .day, value: -daysBack, to: .now),
              let end = cal.date(byAdding: .day, value: daysAhead, to: .now) else { return }

        let query = GTLRCalendarQuery_EventsList.query(withCalendarId: "primary")
        query.timeMin = GTLRDateTime(date: start)
        query.timeMax = GTLRDateTime(date: end)
        query.singleEvents = true
        query.orderBy = "startTime"

        do {
            // Map to Sendable DTOs INSIDE the callback so nothing non-Sendable crosses out.
            let mapped: [GEvent] = try await withCheckedThrowingContinuation { cont in
                service.executeQuery(query) { _, result, error in
                    if let error { cont.resume(throwing: error); return }
                    let items = (result as? GTLRCalendar_Events)?.items ?? []
                    let dtos: [GEvent] = items.compactMap { ev in
                        guard let id = ev.identifier else { return nil }
                        let s = ev.start?.dateTime?.date ?? ev.start?.date?.date ?? Date()
                        let e = ev.end?.dateTime?.date ?? ev.end?.date?.date ?? s
                        return GEvent(id: id, title: ev.summary ?? "Untitled",
                                      start: s, end: e, attendeeCount: ev.attendees?.count ?? 0)
                    }
                    cont.resume(returning: dtos)
                }
            }
            for g in mapped {
                let id = g.id
                let descriptor = FetchDescriptor<Meeting>(predicate: #Predicate { $0.ekEventIdentifier == id })
                if let existing = try? context.fetch(descriptor), !existing.isEmpty { continue }
                let meeting = Meeting(title: g.title, start: g.start, end: g.end,
                                      kind: g.attendeeCount == 2 ? .oneOnOne : .team)  // user + 1 other
                meeting.ekEventIdentifier = id   // reused as the external event id (dedupe key)
                context.insert(meeting)
            }
            try? context.save()
            isConnected = true
            lastError = nil
        } catch {
            lastError = error.localizedDescription
        }
    }
}

#else

/// Fallback used until the Google packages are added. Keeps the app building & running on
/// EventKit; "Connect Google Calendar" points to the setup doc.
@Observable
@MainActor
final class GoogleCalendarService {
    var isConnected = false
    var lastError: String?

    func connect() async {
        lastError = "Google Calendar isn't configured yet — see docs/07-integrations-and-sync.md (add packages + OAuth client ID)."
    }

    func sync(into context: ModelContext, daysBack: Int = 90, daysAhead: Int = 90) async {}
}
#endif
