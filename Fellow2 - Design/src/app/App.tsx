import { useState } from 'react';
import { Calendar, Library, CheckSquare, MoreHorizontal, Search, Bell, HelpCircle, Star, ChevronLeft, ChevronRight, Users, FolderOpen } from 'lucide-react';
import CalendarView from './components/CalendarView';
import MeetingNote from './components/MeetingNote';
import ActionItems from './components/ActionItems';
import PeopleStream from './components/PeopleStream';
import PeopleDirectory from './components/PeopleDirectory';
import MeetingsArchive from './components/MeetingsArchive';
import CalendarPermissionModal from './components/CalendarPermissionModal';

type Tab = 'calendar' | 'library' | 'actions' | 'more';
type View = 'calendar' | 'actions' | 'people' | 'people-stream' | 'meetings';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('calendar');
  const [currentView, setCurrentView] = useState<View>('calendar');
  const [selectedMeeting, setSelectedMeeting] = useState<string | null>('fos-office-hours');
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  return (
    <div className={`size-full flex flex-col ${isDark ? 'dark bg-[#0F172A]' : 'bg-white'}`}>
      {/* Top Bar */}
      <div className={`h-12 flex items-center px-4 gap-3 border-b ${isDark ? 'border-[#374151] bg-[#111827]' : 'border-[#E5E7EB] bg-white'}`}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#2563EB] flex items-center justify-center text-white text-xs font-bold">
            DH
          </div>
          <span className={`text-sm font-medium ${isDark ? 'text-[#F9FAFB]' : 'text-[#0F172A]'}`}>
            Delivery Hero SE
          </span>
          <ChevronLeft className={`w-3 h-3 ${isDark ? 'text-[#9CA3AF]' : 'text-[#6B7280]'}`} />
        </div>

        {selectedMeeting && (
          <div className={`flex items-center gap-2 px-3 py-1 rounded-md ${isDark ? 'bg-[#1F2937]' : 'bg-[#F9FAFB]'}`}>
            <span className={`text-xs ${isDark ? 'text-[#F9FAFB]' : 'text-[#0F172A]'}`}>
              FOS – Office hours
            </span>
            <button className={`text-xs ${isDark ? 'text-[#9CA3AF] hover:text-[#F9FAFB]' : 'text-[#6B7280] hover:text-[#0F172A]'}`}>
              ✕
            </button>
          </div>
        )}

        <div className="flex items-center gap-3 ml-auto">
          <button className={`p-1 ${isDark ? 'text-[#9CA3AF] hover:text-[#F9FAFB]' : 'text-[#6B7280] hover:text-[#0F172A]'}`}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button className={`p-1 ${isDark ? 'text-[#9CA3AF] hover:text-[#F9FAFB]' : 'text-[#6B7280] hover:text-[#0F172A]'}`}>
            <ChevronRight className="w-4 h-4" />
          </button>
          <button className={`p-1 ${isDark ? 'text-[#9CA3AF] hover:text-[#F9FAFB]' : 'text-[#6B7280] hover:text-[#0F172A]'}`}>
            <Star className="w-4 h-4" />
          </button>
          <button className={`p-1 ${isDark ? 'text-[#9CA3AF] hover:text-[#F9FAFB]' : 'text-[#6B7280] hover:text-[#0F172A]'}`}>
            <Bell className="w-4 h-4" />
          </button>
          <button className={`p-1 ${isDark ? 'text-[#9CA3AF] hover:text-[#F9FAFB]' : 'text-[#6B7280] hover:text-[#0F172A]'}`}>
            <HelpCircle className="w-4 h-4" />
          </button>
          <div className="relative">
            <Search className={`absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 ${isDark ? 'text-[#9CA3AF]' : 'text-[#6B7280]'}`} />
            <input
              type="text"
              placeholder="Search..."
              className={`pl-7 pr-3 py-1 text-xs rounded-md w-48 ${
                isDark
                  ? 'bg-[#1F2937] border-[#374151] text-[#F9FAFB] placeholder-[#9CA3AF]'
                  : 'bg-[#F9FAFB] border-[#E5E7EB] text-[#0F172A] placeholder-[#6B7280]'
              } border focus:outline-none focus:ring-2 focus:ring-[#2563EB]`}
            />
          </div>
          <button className="px-3 py-1 bg-[#9333EA] hover:bg-[#7E22CE] text-white text-xs font-medium rounded-md">
            Ask Fellow
          </button>
          <button
            onClick={() => setIsDark(!isDark)}
            className={`p-1 text-xs ${isDark ? 'text-[#9CA3AF]' : 'text-[#6B7280]'}`}
            title="Toggle theme"
          >
            {isDark ? '☀️' : '🌙'}
          </button>
          <button
            onClick={() => setShowPermissionModal(true)}
            className={`p-1 text-xs ${isDark ? 'text-[#9CA3AF]' : 'text-[#6B7280]'}`}
            title="Calendar permissions"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Main Layout: Icon Rail + Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Icon Rail */}
        <div className={`w-16 flex flex-col items-center py-4 gap-4 ${isDark ? 'bg-[#111827] border-r border-[#374151]' : 'bg-[#F9FAFB] border-r border-[#E5E7EB]'}`}>
          <button
            onClick={() => {
              setActiveTab('calendar');
              setCurrentView('calendar');
            }}
            className={`flex flex-col items-center gap-1 ${
              activeTab === 'calendar' ? 'text-[#2563EB]' : isDark ? 'text-[#9CA3AF] hover:text-[#F9FAFB]' : 'text-[#6B7280] hover:text-[#0F172A]'
            }`}
          >
            <div className={`p-2 rounded-full ${activeTab === 'calendar' ? 'bg-[#EFF6FF]' : ''}`}>
              <div className="relative w-5 h-5">
                <Calendar className="w-5 h-5" />
                <span className={`absolute inset-0 flex items-center justify-center text-[9px] font-bold mt-1 ${
                  activeTab === 'calendar' ? 'text-[#2563EB]' : isDark ? 'text-[#9CA3AF]' : 'text-[#6B7280]'
                }`}>
                  2
                </span>
              </div>
            </div>
            <span className="text-[10px]">Calendar</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('actions');
              setCurrentView('actions');
            }}
            className={`flex flex-col items-center gap-1 ${
              activeTab === 'actions' ? 'text-[#2563EB]' : isDark ? 'text-[#9CA3AF] hover:text-[#F9FAFB]' : 'text-[#6B7280] hover:text-[#0F172A]'
            }`}
          >
            <div className={`p-2 rounded-full ${activeTab === 'actions' ? 'bg-[#EFF6FF]' : ''}`}>
              <CheckSquare className="w-5 h-5" />
            </div>
            <span className="text-[10px]">Actions</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('library');
              setCurrentView('people');
            }}
            className={`flex flex-col items-center gap-1 ${
              activeTab === 'library' ? 'text-[#2563EB]' : isDark ? 'text-[#9CA3AF] hover:text-[#F9FAFB]' : 'text-[#6B7280] hover:text-[#0F172A]'
            }`}
          >
            <div className={`p-2 rounded-full ${activeTab === 'library' ? 'bg-[#EFF6FF]' : ''}`}>
              <Users className="w-5 h-5" />
            </div>
            <span className="text-[10px]">People</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('more');
              setCurrentView('meetings');
            }}
            className={`flex flex-col items-center gap-1 ${
              activeTab === 'more' ? 'text-[#2563EB]' : isDark ? 'text-[#9CA3AF] hover:text-[#F9FAFB]' : 'text-[#6B7280] hover:text-[#0F172A]'
            }`}
          >
            <div className={`p-2 rounded-full ${activeTab === 'more' ? 'bg-[#EFF6FF]' : ''}`}>
              <FolderOpen className="w-5 h-5" />
            </div>
            <span className="text-[10px]">Meetings</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {currentView === 'calendar' && (
            <CalendarView
              isDark={isDark}
              selectedMeeting={selectedMeeting}
              onSelectMeeting={setSelectedMeeting}
            />
          )}
          {currentView === 'actions' && <ActionItems isDark={isDark} />}
          {currentView === 'people' && (
            <PeopleDirectory
              isDark={isDark}
              onSelectPerson={(id) => {
                setSelectedPerson(id);
                setCurrentView('people-stream');
              }}
            />
          )}
          {currentView === 'people-stream' && <PeopleStream isDark={isDark} />}
          {currentView === 'meetings' && (
            <MeetingsArchive
              isDark={isDark}
              onSelectMeeting={(id) => {
                setSelectedMeeting(id);
                setCurrentView('calendar');
                setActiveTab('calendar');
              }}
            />
          )}
        </div>
      </div>

      {/* Calendar Permission Modal */}
      {showPermissionModal && (
        <CalendarPermissionModal
          isDark={isDark}
          onConnect={() => setShowPermissionModal(false)}
          onManualSetup={() => setShowPermissionModal(false)}
        />
      )}
    </div>
  );
}