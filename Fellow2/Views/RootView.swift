import SwiftUI
import SwiftData

enum AppSection: String, CaseIterable, Identifiable {
    case today, actionItems, people, meetings
    var id: String { rawValue }

    var title: String {
        switch self {
        case .today: "Calendar"
        case .actionItems: "Actions"
        case .people: "People"
        case .meetings: "Meetings"
        }
    }

    var symbol: String {
        switch self {
        case .today: "calendar"
        case .actionItems: "checkmark.square"
        case .people: "person.2"
        case .meetings: "folder"
        }
    }

    /// ⌘1–⌘4
    var shortcut: Character {
        switch self {
        case .today: "1"
        case .actionItems: "2"
        case .people: "3"
        case .meetings: "4"
        }
    }
}

struct RootView: View {
    @State private var section: AppSection = .today
    @State private var isDark = false
    @State private var showSearch = false
    @State private var selectedMeetingID: PersistentIdentifier?
    @State private var calColumns: NavigationSplitViewVisibility = .all

    var body: some View {
        VStack(spacing: 0) {
            TopBar(isDark: $isDark, showSearch: $showSearch)
            Divider()
            HStack(spacing: 0) {
                IconRailView(section: $section, onSelect: handleSelect)
                Divider()
                Group {
                    switch section {
                    case .today:
                        CalendarSectionView(selectedMeetingID: $selectedMeetingID,
                                            columnVisibility: $calColumns)
                    case .actionItems:
                        ActionItemsView(selectedMeetingID: $selectedMeetingID, section: $section)
                    case .people:
                        PeopleView()
                    case .meetings:
                        MeetingsArchiveView(selectedMeetingID: $selectedMeetingID, section: $section)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .preferredColorScheme(isDark ? .dark : .light)
        .sheet(isPresented: $showSearch) {
            SearchView(selectedMeetingID: $selectedMeetingID, section: $section)
        }
    }

    /// Re-tapping the active Calendar tab toggles the agenda panel (smooth slide).
    private func handleSelect(_ item: AppSection) {
        if item == .today && section == .today {
            withAnimation(.easeInOut(duration: 0.25)) {
                calColumns = (calColumns == .detailOnly) ? .all : .detailOnly
            }
        } else {
            section = item
        }
    }
}

/// Top window bar: workspace switcher · search · light/dark toggle.
struct TopBar: View {
    @Binding var isDark: Bool
    @Binding var showSearch: Bool

    var body: some View {
        HStack(spacing: 12) {
            HStack(spacing: 8) {
                RoundedRectangle(cornerRadius: 6)
                    .fill(Theme.accent)
                    .frame(width: 24, height: 24)
                    .overlay(Text("DH").font(.system(size: 11, weight: .bold)).foregroundStyle(.white))
                Text("Delivery Hero SE").font(.system(size: 13, weight: .medium))
                Image(systemName: "chevron.down").font(.system(size: 9)).foregroundStyle(Theme.textSecondary)
            }

            Spacer()

            Button { showSearch = true } label: {
                HStack(spacing: 6) {
                    Image(systemName: "magnifyingglass")
                    Text("Search…").font(.system(size: 12))
                }
                .foregroundStyle(Theme.textSecondary)
                .padding(.horizontal, 10).padding(.vertical, 4)
                .background(Theme.sidebar, in: RoundedRectangle(cornerRadius: 6))
            }
            .buttonStyle(.plain)
            .keyboardShortcut("f", modifiers: .command)

            Button { isDark.toggle() } label: {
                Image(systemName: isDark ? "sun.max" : "moon")
            }
            .buttonStyle(.plain)
            .foregroundStyle(Theme.textSecondary)
            .help("Toggle light / dark")
        }
        .padding(.horizontal, 14)
        .frame(height: 48)
        .background(Color(nsColor: .windowBackgroundColor))
    }
}

/// The ultra-thin left icon rail (Fellow's primary nav).
struct IconRailView: View {
    @Binding var section: AppSection
    var onSelect: (AppSection) -> Void

    var body: some View {
        VStack(spacing: 8) {
            ForEach(AppSection.allCases) { item in
                Button {
                    onSelect(item)
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: item.symbol)
                            .font(.system(size: 17, weight: .regular))
                        Text(item.title)
                            .font(.system(size: 10, weight: .medium))
                    }
                    .frame(width: 56, height: 50)
                    .background(
                        section == item ? Theme.accentSubtle : Color.clear,
                        in: RoundedRectangle(cornerRadius: 10)
                    )
                    .foregroundStyle(section == item ? Theme.accent : Theme.textSecondary)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .keyboardShortcut(KeyEquivalent(item.shortcut), modifiers: .command)
            }
            Spacer()
        }
        .padding(.top, 14)
        .frame(width: 64)
        .frame(maxHeight: .infinity)
        .background(Theme.sidebar)
    }
}
