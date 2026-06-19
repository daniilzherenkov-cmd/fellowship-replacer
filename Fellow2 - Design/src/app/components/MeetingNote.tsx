import { useState } from 'react';
import { GripVertical, Star, MoreVertical, Plus, Video } from 'lucide-react';

interface MeetingNoteProps {
  isDark: boolean;
}

interface TalkingPoint {
  id: string;
  text: string;
}

interface ActionItem {
  id: string;
  text: string;
  completed: boolean;
  assignee?: string;
  dueDate?: string;
}

interface NoteItem {
  id: string;
  text: string;
}

export default function MeetingNote({ isDark }: MeetingNoteProps) {
  const [talkingPoints, setTalkingPoints] = useState<TalkingPoint[]>([
    { id: '1', text: 'Q2 hiring plan' },
    { id: '2', text: 'Blockers this week' },
    { id: '3', text: 'New talking point' },
  ]);

  const [actionItems, setActionItems] = useState<ActionItem[]>([
    { id: '1', text: 'Review architecture proposal', completed: false, assignee: 'MP', dueDate: 'Tomorrow' },
    { id: '2', text: 'Send weekly update', completed: true, assignee: 'AP' },
    { id: '3', text: 'New action item', completed: false },
  ]);

  const [notes, setNotes] = useState<NoteItem[]>([
    { id: '1', text: 'Discussed new feature requirements' },
    { id: '2', text: 'Team capacity looks good for next sprint' },
  ]);

  const toggleActionItem = (id: string) => {
    setActionItems(items =>
      items.map(item =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const attendees = ['MP', 'JD', 'SK'];

  return (
    <div className={`flex-1 overflow-y-auto ${isDark ? 'bg-[#0F172A]' : 'bg-white'}`}>
      <div className="max-w-3xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <GripVertical className={`w-5 h-5 ${isDark ? 'text-[#6B7280]' : 'text-[#9CA3AF]'} cursor-move`} />

          <input
            type="text"
            defaultValue="FOS – Office hours"
            className={`text-xl font-semibold flex-1 bg-transparent border-none outline-none ${
              isDark ? 'text-[#F9FAFB]' : 'text-[#0F172A]'
            }`}
          />

          <button className={`p-1.5 ${isDark ? 'text-[#9CA3AF] hover:text-[#F9FAFB]' : 'text-[#6B7280] hover:text-[#0F172A]'}`}>
            <Star className="w-5 h-5" />
          </button>

          <div className={`px-2 py-1 rounded-full text-[11px] font-medium ${
            isDark ? 'bg-[#374151] text-[#9CA3AF]' : 'bg-[#F3F4F6] text-[#6B7280]'
          }`}>
            ⏱ 50m left
          </div>

          <div className="px-2 py-1 rounded-full text-[11px] font-medium bg-[#DCFCE7] text-[#166534] flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-[#22C55E]" />
            Google Meet
          </div>

          <div className="flex items-center -space-x-2">
            {attendees.map((initials, idx) => (
              <div
                key={idx}
                className="w-8 h-8 rounded-full bg-[#2563EB] text-white text-xs font-semibold flex items-center justify-center border-2 border-white dark:border-[#0F172A]"
              >
                {initials}
              </div>
            ))}
            <button className="w-8 h-8 rounded-full bg-[#F3F4F6] dark:bg-[#374151] text-[#6B7280] dark:text-[#9CA3AF] text-lg flex items-center justify-center border-2 border-white dark:border-[#0F172A]">
              +
            </button>
          </div>

          <button className={`px-3 py-1.5 rounded-md text-sm font-medium border ${
            isDark
              ? 'border-[#374151] text-[#F9FAFB] hover:bg-[#1F2937]'
              : 'border-[#E5E7EB] text-[#0F172A] hover:bg-[#F9FAFB]'
          }`}>
            Share
          </button>

          <button className={`p-1.5 ${isDark ? 'text-[#9CA3AF] hover:text-[#F9FAFB]' : 'text-[#6B7280] hover:text-[#0F172A]'}`}>
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>

        {/* Prep Button */}
        <button className={`w-full mb-6 px-4 py-2.5 rounded-md text-sm font-medium border flex items-center justify-center gap-2 ${
          isDark
            ? 'border-[#374151] text-[#F9FAFB] hover:bg-[#1F2937]'
            : 'border-[#E5E7EB] text-[#0F172A] hover:bg-[#F9FAFB]'
        }`}>
          📅 Prep for this meeting
        </button>

        {/* Section 1: Talking Points */}
        <div className="mb-8">
          <div className="mb-3">
            <h2 className={`text-base font-semibold mb-1 ${isDark ? 'text-[#F9FAFB]' : 'text-[#0F172A]'}`}>
              Talking Points
            </h2>
            <p className={`text-xs ${isDark ? 'text-[#9CA3AF]' : 'text-[#6B7280]'}`}>
              The things to talk about
            </p>
          </div>

          <div className="space-y-2">
            {talkingPoints.map((point) => (
              <div key={point.id} className="flex items-start gap-3">
                <div className="w-4 h-4 mt-0.5 rounded-full border-2 border-[#2563EB] flex-shrink-0" />
                <input
                  type="text"
                  value={point.text}
                  onChange={(e) => {
                    setTalkingPoints(points =>
                      points.map(p => p.id === point.id ? { ...p, text: e.target.value } : p)
                    );
                  }}
                  className={`flex-1 bg-transparent border-none outline-none ${
                    point.text === 'New talking point'
                      ? isDark ? 'text-[#6B7280]' : 'text-[#9CA3AF]'
                      : isDark ? 'text-[#F9FAFB]' : 'text-[#0F172A]'
                  }`}
                />
              </div>
            ))}
            <button
              onClick={() => {
                setTalkingPoints([...talkingPoints, { id: Date.now().toString(), text: 'New talking point' }]);
              }}
              className={`flex items-center gap-3 w-full ${isDark ? 'text-[#9CA3AF] hover:text-[#F9FAFB]' : 'text-[#6B7280] hover:text-[#0F172A]'}`}
            >
              <div className="w-4 h-4 rounded-full border-2 border-current flex-shrink-0" />
              <span>Add talking point</span>
            </button>
          </div>
        </div>

        {/* Section 2: Action Items */}
        <div className="mb-8">
          <div className="mb-3">
            <h2 className={`text-base font-semibold mb-1 ${isDark ? 'text-[#F9FAFB]' : 'text-[#0F172A]'}`}>
              Action Items
            </h2>
            <p className={`text-xs ${isDark ? 'text-[#9CA3AF]' : 'text-[#6B7280]'}`}>
              What came out of this meeting? What are your next steps?
            </p>
          </div>

          <div className="space-y-2">
            {actionItems.map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <button
                  onClick={() => toggleActionItem(item.id)}
                  className={`w-5 h-5 flex-shrink-0 rounded border-2 flex items-center justify-center ${
                    item.completed
                      ? 'bg-[#2563EB] border-[#2563EB]'
                      : 'border-[#D1D5DB] dark:border-[#6B7280]'
                  }`}
                >
                  {item.completed && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                <input
                  type="text"
                  value={item.text}
                  onChange={(e) => {
                    setActionItems(items =>
                      items.map(i => i.id === item.id ? { ...i, text: e.target.value } : i)
                    );
                  }}
                  className={`flex-1 bg-transparent border-none outline-none ${
                    item.completed
                      ? isDark ? 'text-[#6B7280] line-through' : 'text-[#9CA3AF] line-through'
                      : item.text === 'New action item'
                      ? isDark ? 'text-[#6B7280]' : 'text-[#9CA3AF]'
                      : isDark ? 'text-[#F9FAFB]' : 'text-[#0F172A]'
                  }`}
                />

                {item.assignee && (
                  <div className="w-6 h-6 rounded-full bg-[#2563EB] text-white text-[10px] font-semibold flex items-center justify-center flex-shrink-0">
                    {item.assignee}
                  </div>
                )}

                {item.dueDate && (
                  <div className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#FEF3C7] text-[#92400E] flex-shrink-0">
                    {item.dueDate}
                  </div>
                )}
              </div>
            ))}
            <button
              onClick={() => {
                setActionItems([...actionItems, { id: Date.now().toString(), text: 'New action item', completed: false }]);
              }}
              className={`flex items-center gap-3 w-full ${isDark ? 'text-[#9CA3AF] hover:text-[#F9FAFB]' : 'text-[#6B7280] hover:text-[#0F172A]'}`}
            >
              <div className="w-5 h-5 rounded border-2 border-current flex-shrink-0" />
              <span>Add action item</span>
            </button>
          </div>
        </div>

        {/* Section 3: Notepad */}
        <div>
          <div className="mb-3">
            <h2 className={`text-base font-semibold mb-1 ${isDark ? 'text-[#F9FAFB]' : 'text-[#0F172A]'}`}>
              Notepad
            </h2>
            <p className={`text-xs ${isDark ? 'text-[#9CA3AF]' : 'text-[#6B7280]'}`}>
              Anything else to write down?
            </p>
          </div>

          <div className="space-y-2">
            {notes.map((note) => (
              <div key={note.id} className="flex items-start gap-3">
                <div className={`w-1 h-1 mt-2 rounded-full flex-shrink-0 ${
                  isDark ? 'bg-[#9CA3AF]' : 'bg-[#6B7280]'
                }`} />
                <input
                  type="text"
                  value={note.text}
                  onChange={(e) => {
                    setNotes(items =>
                      items.map(n => n.id === note.id ? { ...n, text: e.target.value } : n)
                    );
                  }}
                  className={`flex-1 bg-transparent border-none outline-none ${
                    isDark ? 'text-[#F9FAFB]' : 'text-[#0F172A]'
                  }`}
                />
              </div>
            ))}
            <button
              onClick={() => {
                setNotes([...notes, { id: Date.now().toString(), text: 'New note' }]);
              }}
              className={`flex items-center gap-3 w-full ${isDark ? 'text-[#9CA3AF] hover:text-[#F9FAFB]' : 'text-[#6B7280] hover:text-[#0F172A]'}`}
            >
              <div className={`w-1 h-1 rounded-full flex-shrink-0 ${isDark ? 'bg-[#9CA3AF]' : 'bg-[#6B7280]'}`} />
              <span>Add note</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
