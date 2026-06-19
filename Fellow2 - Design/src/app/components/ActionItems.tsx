import { useState } from 'react';
import { Plus, Filter, Search } from 'lucide-react';

interface ActionItemsProps {
  isDark: boolean;
}

interface Task {
  id: string;
  text: string;
  completed: boolean;
  assignee: string;
  dueDate?: string;
  meetingLink?: string;
}

interface TaskGroup {
  id: string;
  name: string;
  icon?: string;
  tasks: Task[];
  special?: boolean;
}

export default function ActionItems({ isDark }: ActionItemsProps) {
  const [activeTab, setActiveTab] = useState<'my-items' | 'assigned'>('my-items');

  const [groups, setGroups] = useState<TaskGroup[]>([
    {
      id: 'inbox',
      name: '📥 Inbox',
      special: true,
      tasks: [
        { id: '1', text: 'Follow up on Q2 report', completed: false, assignee: 'MP', dueDate: 'Tomorrow' },
        { id: '2', text: 'Review PR for onboarding flow', completed: false, assignee: 'JD' },
      ],
    },
    {
      id: 'priority',
      name: 'Top priority',
      tasks: [
        { id: '3', text: 'Define OKRs for H2', completed: false, assignee: 'MP', dueDate: 'Today' },
        { id: '4', text: 'Send weekly update', completed: true, assignee: 'MP' },
      ],
    },
    {
      id: 'week',
      name: 'This week',
      tasks: [
        { id: '5', text: 'Update documentation', completed: false, assignee: 'SK', dueDate: 'Thu', meetingLink: 'FOS – Office hours' },
        { id: '6', text: 'Schedule team retrospective', completed: false, assignee: 'AP', dueDate: 'Fri' },
        { id: '7', text: 'Review design mockups', completed: false, assignee: 'MP', meetingLink: 'Design review' },
      ],
    },
  ]);

  const toggleTask = (groupId: string, taskId: string) => {
    setGroups(groups.map(group => {
      if (group.id === groupId) {
        return {
          ...group,
          tasks: group.tasks.map(task =>
            task.id === taskId ? { ...task, completed: !task.completed } : task
          ),
        };
      }
      return group;
    }));
  };

  const getDueDateColor = (dueDate?: string) => {
    if (!dueDate) return null;
    if (dueDate === 'Today') return 'bg-[#FEF3C7] text-[#92400E]';
    if (dueDate === 'Tomorrow') return 'bg-[#FEF3C7] text-[#92400E]';
    return 'bg-[#F3F4F6] dark:bg-[#374151] text-[#6B7280] dark:text-[#9CA3AF]';
  };

  return (
    <div className={`flex-1 overflow-y-auto ${isDark ? 'bg-[#0F172A]' : 'bg-white'}`}>
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className={`text-xl font-semibold ${isDark ? 'text-[#F9FAFB]' : 'text-[#0F172A]'}`}>
            Action items
          </h1>
          <button className="px-3 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-medium rounded-md flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New action item
          </button>
        </div>

        {/* Tabs and Filters */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setActiveTab('my-items')}
              className={`pb-2 text-sm font-medium border-b-2 ${
                activeTab === 'my-items'
                  ? 'border-[#2563EB] text-[#2563EB]'
                  : isDark
                  ? 'border-transparent text-[#9CA3AF] hover:text-[#F9FAFB]'
                  : 'border-transparent text-[#6B7280] hover:text-[#0F172A]'
              }`}
            >
              My items
            </button>
            <button
              onClick={() => setActiveTab('assigned')}
              className={`pb-2 text-sm font-medium border-b-2 ${
                activeTab === 'assigned'
                  ? 'border-[#2563EB] text-[#2563EB]'
                  : isDark
                  ? 'border-transparent text-[#9CA3AF] hover:text-[#F9FAFB]'
                  : 'border-transparent text-[#6B7280] hover:text-[#0F172A]'
              }`}
            >
              Assigned to others
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button className={`px-3 py-1.5 rounded-md text-sm font-medium border flex items-center gap-2 ${
              isDark
                ? 'border-[#374151] text-[#F9FAFB] hover:bg-[#1F2937]'
                : 'border-[#E5E7EB] text-[#0F172A] hover:bg-[#F9FAFB]'
            }`}>
              <Filter className="w-4 h-4" />
              Filters
            </button>

            <div className="relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-[#9CA3AF]' : 'text-[#6B7280]'}`} />
              <input
                type="text"
                placeholder="Search for items..."
                className={`pl-9 pr-3 py-1.5 text-sm rounded-md w-64 ${
                  isDark
                    ? 'bg-[#111827] border-[#374151] text-[#F9FAFB] placeholder-[#9CA3AF]'
                    : 'bg-white border-[#E5E7EB] text-[#0F172A] placeholder-[#6B7280]'
                } border focus:outline-none focus:ring-2 focus:ring-[#2563EB]`}
              />
            </div>
          </div>
        </div>

        {/* Task Groups */}
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.id}>
              <h3 className={`text-xs font-semibold mb-3 ${
                isDark ? 'text-[#9CA3AF]' : 'text-[#6B7280]'
              }`}>
                {group.name}
              </h3>

              <div className="space-y-1">
                {group.tasks.map((task) => (
                  <div key={task.id}>
                    <div
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] ${
                        task.completed ? 'opacity-60' : ''
                      }`}
                    >
                      <button
                        onClick={() => toggleTask(group.id, task.id)}
                        className={`w-5 h-5 flex-shrink-0 rounded border-2 flex items-center justify-center ${
                          task.completed
                            ? 'bg-[#2563EB] border-[#2563EB]'
                            : 'border-[#D1D5DB] dark:border-[#6B7280] hover:border-[#2563EB]'
                        }`}
                      >
                        {task.completed && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>

                      <span className={`flex-1 ${
                        task.completed
                          ? isDark ? 'text-[#6B7280] line-through' : 'text-[#9CA3AF] line-through'
                          : isDark ? 'text-[#F9FAFB]' : 'text-[#0F172A]'
                      }`}>
                        {task.text}
                      </span>

                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#2563EB] text-white text-[10px] font-semibold flex items-center justify-center">
                          {task.assignee}
                        </div>

                        {task.dueDate && (
                          <div className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${getDueDateColor(task.dueDate)}`}>
                            {task.dueDate}
                          </div>
                        )}
                      </div>
                    </div>

                    {task.meetingLink && (
                      <div className="ml-11 mt-1">
                        <a
                          href="#"
                          className={`text-[10px] flex items-center gap-1 ${
                            isDark ? 'text-[#9CA3AF] hover:text-[#60A5FA]' : 'text-[#6B7280] hover:text-[#2563EB]'
                          }`}
                        >
                          <span>↗</span> {task.meetingLink}
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* New Group Button */}
          <button className={`text-xs font-medium ${
            isDark ? 'text-[#9CA3AF] hover:text-[#F9FAFB]' : 'text-[#6B7280] hover:text-[#0F172A]'
          }`}>
            + New group
          </button>
        </div>
      </div>
    </div>
  );
}
