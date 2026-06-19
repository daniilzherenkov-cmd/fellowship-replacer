import SwiftUI
import AppKit

/// Fellow 2 design tokens — adaptive light/dark, matching the Figma design guide.
enum Theme {
    static let accent        = Color(light: "#2563EB", dark: "#60A5FA")  // primary
    static let accentSubtle  = Color(light: "#EFF6FF", dark: "#1E3A8A")  // active nav / selection tint
    static let ai            = Color(light: "#9333EA", dark: "#C084FC")  // "Ask Fellow" only
    static let due           = Color(light: "#F59E0B", dark: "#FBBF24")  // due-date pill
    static let now           = Color(light: "#22C55E", dark: "#4ADE80")  // now-line
    static let overdue       = Color(light: "#EF4444", dark: "#F87171")
    static let sidebar       = Color(light: "#F9FAFB", dark: "#111827")
    static let hover         = Color(light: "#F0F1F3", dark: "#1F2937")  // grey row-hover
    static let hairline      = Color(light: "#E5E7EB", dark: "#374151")
    static let textSecondary = Color(light: "#6B7280", dark: "#9CA3AF")
    static let textTertiary  = Color(light: "#9CA3AF", dark: "#6B7280")

    /// Stable per-person avatar tint.
    static let avatarPalette: [Color] = [
        Color(hex: "#2563EB"), Color(hex: "#9333EA"), Color(hex: "#F59E0B"),
        Color(hex: "#22C55E"), Color(hex: "#EF4444"), Color(hex: "#0EA5A5")
    ]
}

extension Color {
    init(hex: String) {
        self.init(nsColor: NSColor(hex: hex))
    }
    /// Adaptive color resolved per appearance (light vs dark).
    init(light: String, dark: String) {
        self.init(nsColor: NSColor(name: nil) { appearance in
            let isDark = appearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua
            return NSColor(hex: isDark ? dark : light)
        })
    }
}

extension NSColor {
    convenience init(hex: String) {
        let raw = hex.trimmingCharacters(in: CharacterSet(charactersIn: "# "))
        var value: UInt64 = 0
        Scanner(string: raw).scanHexInt64(&value)
        self.init(
            srgbRed: CGFloat((value >> 16) & 0xFF) / 255,
            green: CGFloat((value >> 8) & 0xFF) / 255,
            blue: CGFloat(value & 0xFF) / 255,
            alpha: 1
        )
    }
}

/// Small circular avatar with initials.
struct AvatarView: View {
    let person: Person
    var size: CGFloat = 24

    var body: some View {
        Circle()
            .fill(Color(hex: person.colorHex).gradient)
            .frame(width: size, height: size)
            .overlay(
                Text(person.initials)
                    .font(.system(size: size * 0.42, weight: .semibold))
                    .foregroundStyle(.white)
            )
    }
}

/// Fellow-style action-item checkbox: a larger rounded square that fills with colour
/// only when the cursor is over the box itself (no checkmark glyph on hover).
struct ActionCheckbox: View {
    let isDone: Bool
    var onToggle: () -> Void
    @State private var hovering = false

    private var fill: Color {
        if isDone { return Theme.accent }
        return hovering ? Theme.accent.opacity(0.18) : .clear
    }
    private var stroke: Color {
        if isDone { return Theme.accent }
        return hovering ? Theme.accent : Theme.textTertiary
    }

    var body: some View {
        Button(action: onToggle) {
            RoundedRectangle(cornerRadius: 5)
                .fill(fill)
                .frame(width: 18, height: 18)
                .overlay(RoundedRectangle(cornerRadius: 5).stroke(stroke, lineWidth: 1.5))
                .overlay {
                    if isDone {
                        Image(systemName: "checkmark")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(.white)
                    }
                }
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { hovering = $0 }
        .animation(.easeInOut(duration: 0.12), value: hovering)
    }
}

/// Orange due-date pill (overdue → red).
struct DueDatePill: View {
    let date: Date
    var body: some View {
        let overdue = date < Calendar.current.startOfDay(for: .now)
        Text(Self.format(date))
            .font(.system(size: 11, weight: .medium))
            .foregroundStyle(overdue ? Theme.overdue : Theme.due)
            .padding(.horizontal, 8)
            .padding(.vertical, 2)
            .background((overdue ? Theme.overdue : Theme.due).opacity(0.12), in: Capsule())
    }

    static func format(_ date: Date) -> String {
        let cal = Calendar.current
        if cal.isDateInToday(date) { return "Today" }
        if cal.isDateInTomorrow(date) { return "Tomorrow" }
        if cal.isDateInYesterday(date) { return "Yesterday" }
        let f = DateFormatter(); f.dateFormat = "MMM d"
        return f.string(from: date)
    }
}
