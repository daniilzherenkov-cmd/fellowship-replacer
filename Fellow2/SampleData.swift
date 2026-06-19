import Foundation
import SwiftData

/// Seeds a realistic demo dataset on first launch so the app looks alive even before
/// calendar access is granted. No-op once any meeting exists.
enum SampleData {
    @MainActor
    static func seedIfNeeded(_ context: ModelContext) {
        let existing = (try? context.fetchCount(FetchDescriptor<Meeting>())) ?? 0
        guard existing == 0 else { return }

        let cal = Calendar.current
        let today = cal.startOfDay(for: .now)
        func at(_ hour: Int, _ minute: Int = 0, dayOffset: Int = 0) -> Date {
            cal.date(byAdding: .day, value: dayOffset,
                     to: cal.date(bySettingHour: hour, minute: minute, second: 0, of: today)!)!
        }

        // People
        let ana = Person(name: "Ana Pereira", role: "Senior Engineer", colorHex: "#2D6BE6")
        let bo = Person(name: "Bo Karlsson", role: "Product Manager", colorHex: "#6E56CF")
        let sofia = Person(name: "Sofia Abholen", role: "Designer", colorHex: "#E8910C")
        [ana, bo, sofia].forEach(context.insert)

        // 1:1 Streams
        let anaStream = MeetingStream(title: "1:1 with Ana", kind: .oneOnOne, person: ana)
        let boStream = MeetingStream(title: "1:1 with Bo", kind: .oneOnOne, person: bo)
        [anaStream, boStream].forEach(context.insert)

        // --- Today: 1:1 with Ana ---
        let m1 = Meeting(title: "1:1 with Ana", start: at(9), end: at(9, 30), kind: .oneOnOne)
        m1.attendees = [ana]
        m1.stream = anaStream
        m1.notepad = "Discussed the Q3 roadmap and her growth goals."
        context.insert(m1)
        addTalkingPoints(["How is the IDP migration going?", "Career growth — staff path"], to: m1, context)
        addActionItems([
            ("Share the staff-engineer rubric with Ana", ana, at(0, 0, dayOffset: 1)),
            ("Review Ana's RFC draft", nil, nil)
        ], to: m1, context)

        // --- Today: Team meeting ---
        let m2 = Meeting(title: "Shops Science standup", start: at(10), end: at(10, 15), kind: .team)
        m2.attendees = [ana, bo, sofia]
        context.insert(m2)
        addTalkingPoints(["Blockers", "Sprint demo prep"], to: m2, context)
        addActionItems([("Unblock the data pipeline ticket", bo, at(0, 0, dayOffset: 2))], to: m2, context)

        // --- Earlier 1:1 with Ana (history in the stream) ---
        let m0 = Meeting(title: "1:1 with Ana", start: at(9, 0, dayOffset: -7), end: at(9, 30, dayOffset: -7), kind: .oneOnOne)
        m0.attendees = [ana]
        m0.stream = anaStream
        m0.notepad = "Talked about onboarding the new hire."
        context.insert(m0)
        addActionItems([("Set up onboarding buddy for new hire", ana, at(0, 0, dayOffset: -2))], to: m0, context)

        // --- 1:1 with Bo ---
        let m3 = Meeting(title: "1:1 with Bo", start: at(14), end: at(14, 30), kind: .oneOnOne)
        m3.attendees = [bo]
        m3.stream = boStream
        context.insert(m3)
        addTalkingPoints(["Roadmap priorities", "Hiring plan"], to: m3, context)
        addActionItems([("Draft the hiring plan doc", bo, nil)], to: m3, context)

        try? context.save()
    }

    @MainActor
    private static func addTalkingPoints(_ texts: [String], to meeting: Meeting, _ context: ModelContext) {
        for (i, t) in texts.enumerated() {
            let tp = TalkingPoint(text: t, order: i)
            tp.meeting = meeting
            context.insert(tp)
        }
    }

    @MainActor
    private static func addActionItems(_ items: [(String, Person?, Date?)], to meeting: Meeting, _ context: ModelContext) {
        for (i, item) in items.enumerated() {
            let ai = ActionItem(text: item.0, dueDate: item.2, order: i)
            ai.assignee = item.1
            ai.meeting = meeting
            context.insert(ai)
        }
    }
}
