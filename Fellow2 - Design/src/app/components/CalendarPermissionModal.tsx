import { Calendar, Check } from 'lucide-react';

interface CalendarPermissionModalProps {
  isDark: boolean;
  onConnect: () => void;
  onManualSetup: () => void;
}

export default function CalendarPermissionModal({
  isDark,
  onConnect,
  onManualSetup,
}: CalendarPermissionModalProps) {
  const permissions = [
    'View calendar events',
    'Read attendee lists',
    'Create events on your behalf (for new meetings)',
  ];

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className={`w-full max-w-md rounded-xl shadow-2xl p-8 ${
          isDark ? 'bg-[#111827]' : 'bg-white'
        }`}
        style={{ boxShadow: '0 24px 48px rgba(0,0,0,0.16)' }}
      >
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-[#EFF6FF] dark:bg-[#1E3A8A] flex items-center justify-center">
            <Calendar className="w-6 h-6 text-[#2563EB] dark:text-[#60A5FA]" />
          </div>
        </div>

        {/* Title */}
        <h2
          className={`text-xl font-semibold text-center mb-3 ${
            isDark ? 'text-[#F9FAFB]' : 'text-[#0F172A]'
          }`}
        >
          Connect your calendar
        </h2>

        {/* Body Text */}
        <p
          className={`text-sm text-center mb-6 ${
            isDark ? 'text-[#9CA3AF]' : 'text-[#6B7280]'
          }`}
        >
          Fellow 2 reads your Google Calendar to show meetings and create note
          workspaces automatically. We never modify your events without asking.
        </p>

        {/* Permissions List */}
        <div className="mb-6 space-y-2.5">
          {permissions.map((permission, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <div className="mt-0.5 w-4 h-4 rounded-full bg-[#2563EB] flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 text-white" strokeWidth={3} />
              </div>
              <span
                className={`text-xs ${
                  isDark ? 'text-[#F9FAFB]' : 'text-[#0F172A]'
                }`}
              >
                {permission}
              </span>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div className="space-y-2 mb-4">
          <button
            onClick={onConnect}
            className="w-full px-4 py-3 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-medium rounded-lg transition-colors"
          >
            Connect Google Calendar
          </button>
          <button
            onClick={onManualSetup}
            className={`w-full px-4 py-3 border rounded-lg text-sm font-medium transition-colors ${
              isDark
                ? 'border-[#374151] text-[#F9FAFB] hover:bg-[#1F2937]'
                : 'border-[#E5E7EB] text-[#0F172A] hover:bg-[#F9FAFB]'
            }`}
          >
            Set up manually
          </button>
        </div>

        {/* Footer Text */}
        <p
          className={`text-[10px] text-center ${
            isDark ? 'text-[#6B7280]' : 'text-[#9CA3AF]'
          }`}
        >
          You can change permissions in Settings at any time.
        </p>
      </div>
    </div>
  );
}
