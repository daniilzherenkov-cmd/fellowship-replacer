import { useState } from 'react';
import { Search, Plus, ChevronDown } from 'lucide-react';
import MeetingNote from './MeetingNote';

interface Meeting {
  id: string;
  time: string;
  title: string;
  isPast: boolean;
}

interface CalendarViewProps {
  isDark: boolean;
  selectedMeeting: string | null;
  onSelectMeeting: (id: string | null) => void;
}

const meetings: Meeting[] = [
  { id: 'standup', time: '9:00 AM', title: 'Team standup', isPast: true },
  { id: 'fos-office-hours', time: '10:00 AM', title: 'FOS – Office hours', isPast: false },
  { id: 'design-review', time: '2:00 PM', title: 'Design review', isPast: false },
  { id: 'ana-1on1', time: '4:00 PM', title: '1:1 with Ana', isPast: false },
];

const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const weekDates = [30, 31, 1, 2, 3, 4, 5];

export default function CalendarView({ isDark, selectedMeeting, onSelectMeeting }: CalendarViewProps) {
  const [viewMode, setViewMode] = useState<'today' | 'week'>('today');

  return (
    <>
      {/* Day Agenda Panel */}
      <div className={`w-56 flex flex-col ${isDark ? 'bg-[#111827] border-r border-[#374151]' : 'bg-[#F9FAFB] border-r border-[#E5E7EB]'}`}>
        <div className="p-3 border-b border-[#E5E7EB] dark:border-[#374151]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1">
              <span className={`text-sm font-semibold ${isDark ? 'text-[#F9FAFB]' : 'text-[#0F172A]'}`}>
                Tue, Jun 2
              </span>
              <ChevronDown className={`w-3 h-3 ${isDark ? 'text-[#9CA3AF]' : 'text-[#6B7280]'}`} />
            </div>
          </div>
          <div className={`flex rounded-md ${isDark ? 'bg-[#1F2937]' : 'bg-[#E5E7EB]'} p-0.5`}>
            <button
              onClick={() => setViewMode('today')}
              className={`flex-1 px-2 py-1 text-xs font-medium rounded ${
                viewMode === 'today'
                  ? isDark
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-white text-[#0F172A]'
                  : isDark
                  ? 'text-[#9CA3AF]'
                  : 'text-[#6B7280]'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`flex-1 px-2 py-1 text-xs font-medium rounded ${
                viewMode === 'week'
                  ? isDark
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-white text-[#0F172A]'
                  : isDark
                  ? 'text-[#9CA3AF]'
                  : 'text-[#6B7280]'
              }`}
            >
              Week
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {meetings.map((meeting, idx) => (
            <div key={meeting.id}>
              {idx === 1 && (
                <div className="flex items-center gap-2 px-3 py-2 border-b border-[#22C55E]">
                  <div className="h-px flex-1 bg-[#22C55E]" />
                  <span className="text-[10px] font-medium text-[#22C55E]">Now</span>
                  <div className="h-px flex-1 bg-[#22C55E]" />
                </div>
              )}
              <button
                onClick={() => onSelectMeeting(meeting.id)}
                className={`w-full px-3 py-2.5 flex items-center gap-3 hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] ${
                  selectedMeeting === meeting.id
                    ? 'bg-[#EFF6FF] dark:bg-[#1E3A8A]'
                    : ''
                }`}
              >
                <span className={`text-[11px] font-medium w-12 text-left ${
                  isDark ? 'text-[#9CA3AF]' : 'text-[#6B7280]'
                } ${meeting.isPast ? 'opacity-60' : ''}`}>
                  {meeting.time}
                </span>
                <span className={`text-xs font-medium flex-1 text-left ${
                  selectedMeeting === meeting.id
                    ? 'text-[#2563EB]'
                    : isDark
                    ? 'text-[#F9FAFB]'
                    : 'text-[#0F172A]'
                } ${meeting.isPast ? 'opacity-60' : ''}`}>
                  {meeting.title}
                </span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content: Week Grid or Meeting Note */}
      {selectedMeeting ? (
        <MeetingNote isDark={isDark} />
      ) : (
        <div className={`flex-1 p-4 overflow-y-auto ${isDark ? 'bg-[#0F172A]' : 'bg-white'}`}>
          {/* Week Grid Header */}
          <div className="mb-4 flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-[#9CA3AF]' : 'text-[#6B7280]'}`} />
              <input
                type="text"
                placeholder="Meet with..."
                className={`w-full pl-9 pr-3 py-2 text-sm rounded-md ${
                  isDark
                    ? 'bg-[#111827] border-[#374151] text-[#F9FAFB] placeholder-[#9CA3AF]'
                    : 'bg-white border-[#E5E7EB] text-[#0F172A] placeholder-[#6B7280]'
                } border focus:outline-none focus:ring-2 focus:ring-[#2563EB]`}
              />
            </div>
            <button className="px-3 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-medium rounded-md flex items-center gap-2">
              <Plus className="w-4 h-4" />
              New
            </button>
          </div>

          {/* Week Grid */}
          <div className="grid grid-cols-7 gap-px bg-[#E5E7EB] dark:bg-[#374151] border border-[#E5E7EB] dark:border-[#374151] rounded-lg overflow-hidden">
            {weekDays.map((day, idx) => (
              <div
                key={day}
                className={`p-3 ${
                  idx === 2
                    ? isDark
                      ? 'bg-[#1E3A8A]'
                      : 'bg-[#EFF6FF]'
                    : isDark
                    ? 'bg-[#111827]'
                    : 'bg-white'
                }`}
              >
                <div className={`text-xs font-semibold mb-1 ${
                  idx === 2 ? 'text-[#2563EB]' : isDark ? 'text-[#F9FAFB]' : 'text-[#0F172A]'
                }`}>
                  {day}
                </div>
                <div className={`text-[10px] ${
                  idx === 2 ? 'text-[#2563EB]' : isDark ? 'text-[#9CA3AF]' : 'text-[#6B7280]'
                }`}>
                  {weekDates[idx]}
                </div>

                {/* Location chip */}
                {idx >= 1 && idx <= 5 && (
                  <div className={`mt-2 px-2 py-0.5 rounded-full text-[10px] font-medium inline-block ${
                    idx === 2 || idx === 3
                      ? 'bg-[#DBEAFE] text-[#1E40AF]'
                      : idx === 1
                      ? 'bg-[#FEF3C7] text-[#92400E]'
                      : 'bg-[#D1FAE5] text-[#065F46]'
                  }`}>
                    {idx === 1 ? 'Car' : idx === 2 || idx === 3 ? 'Office' : 'Home'}
                  </div>
                )}

                {/* Sample Events */}
                {idx === 2 && (
                  <div className="mt-3 space-y-2">
                    <div className="bg-[#DBEAFE] dark:bg-[#1E3A8A] border-l-2 border-[#2563EB] rounded px-2 py-1.5">
                      <div className="text-[10px] font-medium text-[#1E40AF] dark:text-[#60A5FA]">
                        10:00 AM
                      </div>
                      <div className="text-[11px] font-medium text-[#0F172A] dark:text-[#F9FAFB] mt-0.5">
                        FOS – Office hours
                      </div>
                    </div>
                    <div className="bg-[#FEE2E2] dark:bg-[#7F1D1D] border-l-2 border-[#EF4444] rounded px-2 py-1.5">
                      <div className="text-[10px] font-medium text-[#991B1B] dark:text-[#FCA5A5]">
                        2:00 PM
                      </div>
                      <div className="text-[11px] font-medium text-[#0F172A] dark:text-[#F9FAFB] mt-0.5">
                        Design review
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Current time line indicator */}
          <div className="relative mt-4">
            <div className="absolute left-0 right-0 flex items-center">
              <div className="h-px flex-1 bg-[#22C55E]" />
              <span className="px-2 text-[10px] font-medium text-[#22C55E]">10:30 AM</span>
              <div className="h-px flex-1 bg-[#22C55E]" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
