import { Search, Filter, ChevronRight } from 'lucide-react';

interface MeetingsArchiveProps {
  isDark: boolean;
  onSelectMeeting: (id: string) => void;
}

interface Meeting {
  id: string;
  title: string;
  date: string;
  time: string;
  color: string;
  attendees: string[];
  actionItemCount: number;
  hasOpenItems?: boolean;
}

interface WeekGroup {
  title: string;
  meetings: Meeting[];
}

export default function MeetingsArchive({ isDark, onSelectMeeting }: MeetingsArchiveProps) {
  const weeks: WeekGroup[] = [
    {
      title: 'This week — Jun 2–6',
      meetings: [
        {
          id: 'fos-1',
          title: 'FOS – Office hours',
          date: 'Tue, Jun 2',
          time: '10:00 AM',
          color: '#2563EB',
          attendees: ['MP', 'JD', 'SK'],
          actionItemCount: 2,
          hasOpenItems: true,
        },
        {
          id: 'design-review',
          title: 'Design review',
          date: 'Tue, Jun 2',
          time: '2:00 PM',
          color: '#EF4444',
          attendees: ['SK', 'AP'],
          actionItemCount: 1,
        },
        {
          id: 'team-sync',
          title: 'Team standup',
          date: 'Wed, Jun 3',
          time: '9:00 AM',
          color: '#22C55E',
          attendees: ['MP', 'JD', 'SK', 'AP'],
          actionItemCount: 0,
        },
        {
          id: 'ana-1on1',
          title: '1:1 with Ana',
          date: 'Thu, Jun 4',
          time: '4:00 PM',
          color: '#8B5CF6',
          attendees: ['AP'],
          actionItemCount: 3,
          hasOpenItems: true,
        },
      ],
    },
    {
      title: 'Last week — May 26–30',
      meetings: [
        {
          id: 'planning',
          title: 'Sprint planning',
          date: 'Mon, May 26',
          time: '2:00 PM',
          color: '#F59E0B',
          attendees: ['MP', 'JD'],
          actionItemCount: 5,
        },
        {
          id: 'retro',
          title: 'Team retrospective',
          date: 'Fri, May 30',
          time: '3:00 PM',
          color: '#06B6D4',
          attendees: ['MP', 'JD', 'SK', 'AP', 'DC'],
          actionItemCount: 2,
        },
      ],
    },
  ];

  return (
    <>
      {/* Sidebar Filter Panel */}
      <div className={`w-56 flex flex-col ${isDark ? 'bg-[#111827] border-r border-[#374151]' : 'bg-[#F9FAFB] border-r border-[#E5E7EB]'}`}>
        <div className="p-3 border-b border-[#E5E7EB] dark:border-[#374151]">
          <h3 className={`text-xs font-semibold mb-3 ${isDark ? 'text-[#9CA3AF]' : 'text-[#6B7280]'}`}>
            TIME PERIOD
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto">
          <button className={`w-full px-3 py-2 text-left text-xs font-medium bg-[#EFF6FF] dark:bg-[#1E3A8A] text-[#2563EB] dark:text-[#60A5FA]`}>
            This week
          </button>
          <button className={`w-full px-3 py-2 text-left text-xs font-medium hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] ${
            isDark ? 'text-[#F9FAFB]' : 'text-[#0F172A]'
          }`}>
            Past month
          </button>
          <button className={`w-full px-3 py-2 text-left text-xs font-medium hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] ${
            isDark ? 'text-[#F9FAFB]' : 'text-[#0F172A]'
          }`}>
            All notes
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 overflow-y-auto ${isDark ? 'bg-[#0F172A]' : 'bg-white'}`}>
        <div className="max-w-4xl mx-auto p-6">
          {/* Header */}
          <div className="mb-4">
            <h1 className={`text-xl font-semibold mb-4 ${isDark ? 'text-[#F9FAFB]' : 'text-[#0F172A]'}`}>
              Meetings
            </h1>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <button className={`px-2 py-1 rounded-md text-xs font-medium border ${
                  isDark
                    ? 'border-[#374151] text-[#F9FAFB] hover:bg-[#1F2937]'
                    : 'border-[#E5E7EB] text-[#0F172A] hover:bg-[#F9FAFB]'
                }`}>
                  All time
                </button>
                <button className={`px-2 py-1 rounded-md text-xs font-medium border ${
                  isDark
                    ? 'border-[#374151] text-[#F9FAFB] hover:bg-[#1F2937]'
                    : 'border-[#E5E7EB] text-[#0F172A] hover:bg-[#F9FAFB]'
                }`}>
                  All attendees
                </button>
              </div>

              <button className={`px-3 py-1 rounded-md text-xs font-medium border flex items-center gap-2 ${
                isDark
                  ? 'border-[#374151] text-[#F9FAFB] hover:bg-[#1F2937]'
                  : 'border-[#E5E7EB] text-[#0F172A] hover:bg-[#F9FAFB]'
              }`}>
                <Filter className="w-3 h-3" />
                Filters
              </button>

              <div className="relative ml-auto">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-[#9CA3AF]' : 'text-[#6B7280]'}`} />
                <input
                  type="text"
                  placeholder="Search meetings..."
                  className={`pl-9 pr-3 py-1.5 text-sm rounded-md w-64 ${
                    isDark
                      ? 'bg-[#111827] border-[#374151] text-[#F9FAFB] placeholder-[#9CA3AF]'
                      : 'bg-white border-[#E5E7EB] text-[#0F172A] placeholder-[#6B7280]'
                  } border focus:outline-none focus:ring-2 focus:ring-[#2563EB]`}
                />
              </div>
            </div>
          </div>

          {/* Meeting List */}
          <div className="space-y-6">
            {weeks.map((week) => (
              <div key={week.title}>
                <div className={`flex items-center gap-3 mb-3 pb-2 border-b ${
                  isDark ? 'border-[#374151]' : 'border-[#E5E7EB]'
                }`}>
                  <h3 className={`text-xs font-semibold ${
                    isDark ? 'text-[#9CA3AF]' : 'text-[#6B7280]'
                  }`}>
                    {week.title}
                  </h3>
                </div>

                <div className="space-y-1">
                  {week.meetings.map((meeting) => (
                    <button
                      key={meeting.id}
                      onClick={() => onSelectMeeting(meeting.id)}
                      className={`w-full px-3 py-2.5 rounded-md flex items-center gap-3 hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] text-left`}
                    >
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: meeting.color }}
                      />

                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium truncate ${
                          isDark ? 'text-[#F9FAFB]' : 'text-[#0F172A]'
                        }`}>
                          {meeting.title}
                        </div>
                      </div>

                      <div className={`text-xs whitespace-nowrap ${
                        isDark ? 'text-[#9CA3AF]' : 'text-[#6B7280]'
                      }`}>
                        {meeting.date} · {meeting.time}
                      </div>

                      <div className="flex items-center -space-x-1.5">
                        {meeting.attendees.slice(0, 3).map((initials, idx) => (
                          <div
                            key={idx}
                            className="w-5 h-5 rounded-full bg-[#2563EB] text-white text-[9px] font-semibold flex items-center justify-center border border-white dark:border-[#0F172A]"
                          >
                            {initials}
                          </div>
                        ))}
                      </div>

                      {meeting.actionItemCount > 0 && (
                        <div className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          meeting.hasOpenItems
                            ? 'bg-[#FEF3C7] text-[#92400E]'
                            : isDark
                            ? 'bg-[#374151] text-[#9CA3AF]'
                            : 'bg-[#F3F4F6] text-[#6B7280]'
                        }`}>
                          {meeting.actionItemCount} action items
                        </div>
                      )}

                      {meeting.hasOpenItems && (
                        <div className="w-2 h-2 rounded-full bg-[#F59E0B] flex-shrink-0" />
                      )}

                      <ChevronRight className={`w-4 h-4 flex-shrink-0 ${
                        isDark ? 'text-[#6B7280]' : 'text-[#9CA3AF]'
                      }`} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
