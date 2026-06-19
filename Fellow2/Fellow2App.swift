import SwiftUI
import SwiftData

@main
struct Fellow2App: App {
    let container: ModelContainer

    init() {
        do {
            container = try ModelContainer(
                for: Meeting.self, Person.self, TalkingPoint.self,
                ActionItem.self, MeetingStream.self
            )
        } catch {
            fatalError("Failed to create ModelContainer: \(error)")
        }
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .frame(minWidth: 1040, minHeight: 660)
                // Sample data seeding removed — the app starts empty and fills from the
                // calendar. (SampleData.swift is kept but no longer called; safe to delete.)
        }
        .modelContainer(container)
        .windowToolbarStyle(.unified)
    }
}
