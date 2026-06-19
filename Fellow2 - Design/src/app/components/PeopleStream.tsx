import { useState } from 'react';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';

interface PeopleStreamProps {
  isDark: boolean;
}

interface Person {
  id: string;
  name: string;
  initials: string;
  role: string;
  lastMeeting: string;
  openTodos: number;
}

interface TimelineEntry {
  id: string;
  date: string;
  summary: string;
  expanded: boolean;
  talkingPoints: string[];
  actionItems: { text: string; completed: boolean }[];
  notes: string[];
}

export default function PeopleStream({ isDark }: PeopleStreamProps) {
  const [selectedPerson, setSelectedPerson] = useState<string>('ana');

  const people: Person[] = [
    { id: 'ana', name: 'Ana Popescu', initials: 'AP', role: 'Senior Engineer', lastMeeting: 'May 27', openTodos: 3 },
    { id: 'mikael', name: 'Mikael Petrov', initials: 'MP', role: 'Product Manager', lastMeeting: 'May 29', openTodos: 1 },
    { id: 'sarah', name: 'Sarah Kim', initials: 'SK', role: 'Designer', lastMeeting: 'May 24', openTodos: 2 },
    { id: 'jacob', name: 'Jacob Diaz', initials: 'JD', role: 'Engineering Lead', lastMeeting: 'May 30', openTodos: 0 },
  ];

  const [timeline, setTimeline] = useState<TimelineEntry[]>([
    {
      id: '1',
      date: 'Tue, May 27',
      summary: 'Discussed Q2 roadmap, 2 action items',
      expanded: true,
      talkingPoints: ['Q2 product priorities', 'Team capacity planning', 'Technical debt review'],
      actionItems: [
        { text: 'Review architecture proposal', completed: false },
        { text: 'Share capacity model with team', completed: false },
      ],
      notes: ['Team is enthusiastic about new features', 'Need to hire 2 more engineers'],
    },
    {
      id: '2',
      date: 'Tue, May 20',
      summary: 'Sprint planning and blockers, 1 action item',
      expanded: false,
      talkingPoints: [],
      actionItems: [],
      notes: [],
    },
    {
      id: '3',
      date: 'Tue, May 13',
      summary: 'Performance review preparation',
      expanded: false,
      talkingPoints: [],
      actionItems: [],
      notes: [],
    },
  ]);

  const toggleEntry = (id: string) => {
    setTimeline(timeline.map(entry =>
      entry.id === id ? { ...entry, expanded: !entry.expanded } : entry
    ));
  };

  const currentPerson = people.find(p => p.id === selectedPerson);

  return (
    <>
      {/* People List Panel */}
      <div className={`w-56 flex flex-col ${isDark ? 'bg-[#111827] border-r border-[#374151]' : 'bg-[#F9FAFB] border-r border-[#E5E7EB]'}`}>
        <div className="p-3 border-b border-[#E5E7EB] dark:border-[#374151]">
          <div className="relative">
            <Search className={`absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 ${isDark ? 'text-[#9CA3AF]' : 'text-[#6B7280]'}`} />
            <input
              type="text"
              placeholder="Search people..."
              className={`w-full pl-7 pr-2 py-1.5 text-xs rounded-md ${
                isDark
                  ? 'bg-[#1F2937] border-[#374151] text-[#F9FAFB] placeholder-[#9CA3AF]'
                  : 'bg-white border-[#E5E7EB] text-[#0F172A] placeholder-[#6B7280]'
              } border focus:outline-none focus:ring-2 focus:ring-[#2563EB]`}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {people.map((person) => (
            <button
              key={person.id}
              onClick={() => setSelectedPerson(person.id)}
              className={`w-full px-3 py-2.5 flex items-center gap-3 hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] ${
                selectedPerson === person.id
                  ? 'bg-[#EFF6FF] dark:bg-[#1E3A8A]'
                  : ''
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-[#2563EB] text-white text-xs font-semibold flex items-center justify-center flex-shrink-0">
                {person.initials}
              </div>
              <div className="flex-1 text-left">
                <div className={`text-xs font-medium ${
                  selectedPerson === person.id
                    ? 'text-[#2563EB]'
                    : isDark ? 'text-[#F9FAFB]' : 'text-[#0F172A]'
                }`}>
                  {person.name}
                </div>
                <div className={`text-[10px] ${isDark ? 'text-[#9CA3AF]' : 'text-[#6B7280]'}`}>
                  {person.lastMeeting}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Person Stream */}
      {currentPerson && (
        <div className={`flex-1 overflow-y-auto ${isDark ? 'bg-[#0F172A]' : 'bg-white'}`}>
          <div className="max-w-3xl mx-auto p-6">
            {/* Person Header */}
            <div className={`mb-4 p-5 rounded-lg ${isDark ? 'bg-[#1F2937] border border-[#374151]' : 'bg-[#F9FAFB] border border-[#E5E7EB]'}`}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#2563EB] text-white text-lg font-semibold flex items-center justify-center">
                  {currentPerson.initials}
                </div>
                <div className="flex-1">
                  <h2 className={`text-lg font-semibold ${isDark ? 'text-[#F9FAFB]' : 'text-[#0F172A]'}`}>
                    {currentPerson.name}
                  </h2>
                  <p className={`text-xs ${isDark ? 'text-[#9CA3AF]' : 'text-[#6B7280]'}`}>
                    {currentPerson.role}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="text-xs text-[#2563EB]">
                    Next 1:1: Thu 10:00
                  </div>
                  {currentPerson.openTodos > 0 && (
                    <div className={`text-[10px] px-2 py-0.5 rounded-full ${
                      isDark ? 'bg-[#374151] text-[#9CA3AF]' : 'bg-[#E5E7EB] text-[#6B7280]'
                    }`}>
                      {currentPerson.openTodos} open to-dos
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Carry Forward Strip */}
            {currentPerson.openTodos > 0 && (
              <div className="mb-4 px-4 py-2.5 rounded-lg bg-[#EFF6FF] dark:bg-[#1E3A8A] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[#2563EB] dark:text-[#60A5FA]">
                    {currentPerson.openTodos} items carried forward from last 1:1
                  </span>
                  <ChevronDown className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA]" />
                </div>
                <button className="text-xs text-[#2563EB] dark:text-[#60A5FA] hover:underline">
                  Dismiss
                </button>
              </div>
            )}

            {/* Start Next Meeting Button */}
            <button className="w-full mb-6 px-4 py-3 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-medium rounded-md">
              Start next 1:1
            </button>

            {/* Timeline */}
            <div className="space-y-2">
              <h3 className={`text-xs font-semibold mb-3 ${isDark ? 'text-[#9CA3AF]' : 'text-[#6B7280]'}`}>
                HISTORY
              </h3>

              {timeline.map((entry) => (
                <div
                  key={entry.id}
                  className={`rounded-lg border ${
                    isDark ? 'border-[#374151] bg-[#111827]' : 'border-[#E5E7EB] bg-white'
                  } overflow-hidden`}
                >
                  <button
                    onClick={() => toggleEntry(entry.id)}
                    className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-[#F9FAFB] dark:hover:bg-[#1F2937]`}
                  >
                    {entry.expanded ? (
                      <ChevronDown className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-[#9CA3AF]' : 'text-[#6B7280]'}`} />
                    ) : (
                      <ChevronRight className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-[#9CA3AF]' : 'text-[#6B7280]'}`} />
                    )}
                    <div className="flex-1 text-left">
                      <div className={`text-xs font-semibold ${isDark ? 'text-[#F9FAFB]' : 'text-[#0F172A]'}`}>
                        {entry.date}
                      </div>
                      <div className={`text-xs ${isDark ? 'text-[#9CA3AF]' : 'text-[#6B7280]'}`}>
                        {entry.summary}
                      </div>
                    </div>
                  </button>

                  {entry.expanded && (
                    <div className={`px-4 pb-4 space-y-4 border-t ${isDark ? 'border-[#374151]' : 'border-[#E5E7EB]'}`}>
                      {/* Talking Points */}
                      <div className="pt-3">
                        <h4 className={`text-xs font-semibold mb-2 ${isDark ? 'text-[#F9FAFB]' : 'text-[#0F172A]'}`}>
                          Talking Points
                        </h4>
                        <div className="space-y-1.5">
                          {entry.talkingPoints.map((point, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <div className="w-3 h-3 mt-0.5 rounded-full border border-[#2563EB] flex-shrink-0" />
                              <span className={`text-xs ${isDark ? 'text-[#F9FAFB]' : 'text-[#0F172A]'}`}>
                                {point}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Action Items */}
                      <div>
                        <h4 className={`text-xs font-semibold mb-2 ${isDark ? 'text-[#F9FAFB]' : 'text-[#0F172A]'}`}>
                          Action Items
                        </h4>
                        <div className="space-y-1.5">
                          {entry.actionItems.map((item, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <div className={`w-3 h-3 mt-0.5 rounded border flex-shrink-0 ${
                                item.completed
                                  ? 'bg-[#2563EB] border-[#2563EB]'
                                  : 'border-[#D1D5DB] dark:border-[#6B7280]'
                              }`}>
                                {item.completed && (
                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                              <span className={`text-xs ${
                                item.completed
                                  ? isDark ? 'text-[#6B7280] line-through' : 'text-[#9CA3AF] line-through'
                                  : isDark ? 'text-[#F9FAFB]' : 'text-[#0F172A]'
                              }`}>
                                {item.text}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Notes */}
                      <div>
                        <h4 className={`text-xs font-semibold mb-2 ${isDark ? 'text-[#F9FAFB]' : 'text-[#0F172A]'}`}>
                          Notepad
                        </h4>
                        <div className="space-y-1.5">
                          {entry.notes.map((note, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <div className={`w-1 h-1 mt-1.5 rounded-full flex-shrink-0 ${
                                isDark ? 'bg-[#9CA3AF]' : 'bg-[#6B7280]'
                              }`} />
                              <span className={`text-xs ${isDark ? 'text-[#F9FAFB]' : 'text-[#0F172A]'}`}>
                                {note}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
