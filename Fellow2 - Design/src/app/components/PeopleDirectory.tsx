import { Search } from 'lucide-react';

interface PeopleDirectoryProps {
  isDark: boolean;
  onSelectPerson: (id: string) => void;
}

interface PersonCard {
  id: string;
  name: string;
  initials: string;
  role: string;
  lastMeeting: string;
  openTodos: number;
}

export default function PeopleDirectory({ isDark, onSelectPerson }: PeopleDirectoryProps) {
  const people: PersonCard[] = [
    { id: 'ana', name: 'Ana Popescu', initials: 'AP', role: 'Senior Engineer', lastMeeting: 'May 27', openTodos: 3 },
    { id: 'mikael', name: 'Mikael Petrov', initials: 'MP', role: 'Product Manager', lastMeeting: 'May 29', openTodos: 1 },
    { id: 'sarah', name: 'Sarah Kim', initials: 'SK', role: 'Designer', lastMeeting: 'May 24', openTodos: 2 },
    { id: 'jacob', name: 'Jacob Diaz', initials: 'JD', role: 'Engineering Lead', lastMeeting: 'May 30', openTodos: 0 },
    { id: 'elena', name: 'Elena Rodriguez', initials: 'ER', role: 'Product Designer', lastMeeting: 'May 28', openTodos: 1 },
    { id: 'david', name: 'David Chen', initials: 'DC', role: 'Backend Engineer', lastMeeting: 'May 26', openTodos: 4 },
  ];

  return (
    <div className={`flex-1 overflow-y-auto ${isDark ? 'bg-[#0F172A]' : 'bg-white'}`}>
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className={`text-xl font-semibold ${isDark ? 'text-[#F9FAFB]' : 'text-[#0F172A]'}`}>
            People
          </h1>
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-[#9CA3AF]' : 'text-[#6B7280]'}`} />
            <input
              type="text"
              placeholder="Search people..."
              className={`pl-9 pr-3 py-2 text-sm rounded-md w-64 ${
                isDark
                  ? 'bg-[#111827] border-[#374151] text-[#F9FAFB] placeholder-[#9CA3AF]'
                  : 'bg-white border-[#E5E7EB] text-[#0F172A] placeholder-[#6B7280]'
              } border focus:outline-none focus:ring-2 focus:ring-[#2563EB]`}
            />
          </div>
        </div>

        {/* People Grid */}
        <div className="grid grid-cols-3 gap-4">
          {people.map((person) => (
            <button
              key={person.id}
              onClick={() => onSelectPerson(person.id)}
              className={`p-4 rounded-lg border text-left transition-all hover:shadow-lg hover:border-[#2563EB] ${
                isDark
                  ? 'bg-[#111827] border-[#374151] hover:bg-[#1F2937]'
                  : 'bg-white border-[#E5E7EB] hover:bg-[#F9FAFB]'
              }`}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-[#2563EB] text-white text-base font-semibold flex items-center justify-center flex-shrink-0">
                  {person.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold mb-0.5 truncate ${
                    isDark ? 'text-[#F9FAFB]' : 'text-[#0F172A]'
                  }`}>
                    {person.name}
                  </div>
                  <div className={`text-xs truncate ${
                    isDark ? 'text-[#9CA3AF]' : 'text-[#6B7280]'
                  }`}>
                    {person.role}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className={`text-[10px] ${
                  isDark ? 'text-[#6B7280]' : 'text-[#9CA3AF]'
                }`}>
                  Last 1:1: {person.lastMeeting}
                </div>
                {person.openTodos > 0 && (
                  <div className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#FEF3C7] text-[#92400E]">
                    {person.openTodos} open to-dos
                  </div>
                )}
              </div>
            </button>
          ))}

          {/* Empty State Card */}
          <div className={`p-4 rounded-lg border border-dashed flex flex-col items-center justify-center min-h-[140px] ${
            isDark
              ? 'border-[#374151] bg-[#111827]/50'
              : 'border-[#E5E7EB] bg-[#F9FAFB]/50'
          }`}>
            <svg
              className={`w-10 h-10 mb-2 ${isDark ? 'text-[#6B7280]' : 'text-[#9CA3AF]'}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
            <div className={`text-sm font-medium mb-1 ${
              isDark ? 'text-[#F9FAFB]' : 'text-[#0F172A]'
            }`}>
              No people yet
            </div>
            <div className={`text-xs text-center ${
              isDark ? 'text-[#9CA3AF]' : 'text-[#6B7280]'
            }`}>
              Meetings with participants will appear here automatically
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
