import { useEffect, useMemo, useState } from 'react';
import { X, MessageSquare, GraduationCap, TrendingUp, Building2, ChevronRight, Users } from 'lucide-react';
import { QueryType } from '../../api/dm.api';
import { getVisibleAssociationQueryTypes, isAssociationQueryType } from './queryTypeVisibility';

interface QueryTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (queryType: QueryType, customMessage?: string) => void;
  recipientName: string;
  recipientRole?: string;
  currentUserRole?: string;
  initialQueryType?: QueryType | null;
}

interface QueryTemplate {
  type: QueryType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  autoMessages: string[];
}

const queryTemplates: QueryTemplate[] = [
  {
    type: 'project_mentor',
    label: 'Project Mentor',
    description: 'Looking for guidance on your project',
    icon: <GraduationCap className="h-5 w-5" />,
    color: 'from-blue-500 to-cyan-500',
    autoMessages: [
      'Hi! I am working on a project and would love to get your guidance and mentorship. Would you be interested in helping me navigate the challenges?',
      'Hello! I came across your profile and I am impressed by your experience. I am looking for a mentor who can help me with my startup project. Would you have some time to connect?',
      'Hi! I believe your expertise would be valuable for my project. I am looking for a mentor who can provide insights and direction. Are you open to mentoring?',
    ],
  },
  {
    type: 'project_join',
    label: 'Project Join',
    description: 'Request to join their project or startup',
    icon: <Users className="h-5 w-5" />,
    color: 'from-fuchsia-500 to-indigo-500',
    autoMessages: [
      'Hi! I came across your work on ProMove and would love to join your project if you are open to collaborators.',
      'Hello! Your project looks interesting. I would like to contribute and explore joining your team.',
      'Hi! I am interested in joining your project and can contribute across execution, research, or product work. Would you be open to discussing it?',
    ],
  },
  {
    type: 'investor',
    label: 'Investor',
    description: 'Seeking investment for your startup',
    icon: <TrendingUp className="h-5 w-5" />,
    color: 'from-emerald-500 to-teal-500',
    autoMessages: [
      'Hi! I have an exciting startup that I believe has great potential. I would love to discuss investment opportunities with you.',
      'Hello! I noticed your interest in innovative projects. I am currently raising funds for my startup and would appreciate the opportunity to share our vision with you.',
      'Hi! I am looking for investors who share my passion for disruptive technology. Would you be interested in learning more about our venture?',
    ],
  },
  {
    type: 'recruiter',
    label: 'Recruiter',
    description: 'Exploring career opportunities',
    icon: <Building2 className="h-5 w-5" />,
    color: 'from-purple-500 to-pink-500',
    autoMessages: [
      'Hi! I am interested in career opportunities at your organization. I believe my skills and experience align well with your company culture.',
      'Hello! I came across your company and I am impressed by your work. I would love to discuss potential opportunities with your team.',
      'Hi! I am actively seeking new opportunities and I think your organization would be a great fit. Would you have time for a brief conversation?',
    ],
  },
  {
    type: 'hiring_event',
    label: 'Hiring Event',
    description: 'Organize a hiring event with a college',
    icon: <Building2 className="h-5 w-5" />,
    color: 'from-amber-500 to-orange-500',
    autoMessages: [
      'Hi! I would like to organize a hiring event with your college and explore student talent for open roles.',
      'Hello! I am planning a campus hiring event and would like to coordinate with your college placement team.',
      'Hi! I would like to discuss a hiring event for your college students. Could we connect on the event format and timeline?',
    ],
  },
  {
    type: 'mentorship_program',
    label: 'Mentorship Program',
    description: 'Request a school or college mentorship program',
    icon: <GraduationCap className="h-5 w-5" />,
    color: 'from-cyan-500 to-blue-500',
    autoMessages: [
      'Hi! I would like to support your students through a mentorship program. Could we discuss the format and schedule?',
      'Hello! I am available for a mentorship program with your institution and would like to understand your preferred topics.',
      'Hi! I would like to propose a mentorship session for your students. Could we coordinate the program request?',
    ],
  },
  {
    type: 'general',
    label: 'General Query',
    description: 'Start a general conversation',
    icon: <MessageSquare className="h-5 w-5" />,
    color: 'from-slate-500 to-gray-500',
    autoMessages: [
      'Hi! I wanted to reach out and connect with you.',
      'Hello! I hope this message finds you well. I would love to connect and learn more about your work.',
      'Hi! I am interested in getting to know you better and exploring potential collaboration opportunities.',
    ],
  },
];

export function QueryTypeModal({
  isOpen,
  onClose,
  onSelect,
  recipientName,
  recipientRole,
  currentUserRole,
  initialQueryType,
}: QueryTypeModalProps) {
  const [selectedType, setSelectedType] = useState<QueryTemplate | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const visibleAssociationTypes = useMemo(
    () => new Set(getVisibleAssociationQueryTypes(recipientRole, currentUserRole)),
    [currentUserRole, recipientRole],
  );
  const visibleTemplates = useMemo(
    () =>
      queryTemplates.filter((template) => {
        if (!isAssociationQueryType(template.type)) {
          return true;
        }

        return visibleAssociationTypes.has(template.type);
      }),
    [visibleAssociationTypes],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (initialQueryType) {
      const initialTemplate =
        visibleTemplates.find((template) => template.type === initialQueryType) ?? null;

      if (initialTemplate && selectedType?.type !== initialTemplate.type) {
        setSelectedType(initialTemplate);
        setShowCustomInput(true);
        setCustomMessage('');
        return;
      }
    }

    if (!initialQueryType) {
      setSelectedType(null);
      setShowCustomInput(false);
      setCustomMessage('');
    }
  }, [currentUserRole, initialQueryType, isOpen, recipientRole, selectedType?.type, visibleTemplates]);

  if (!isOpen) return null;

  const handleTypeSelect = (template: QueryTemplate) => {
    setSelectedType(template);
    setShowCustomInput(true);
  };

  const handleSend = (message: string) => {
    if (selectedType) {
      onSelect(selectedType.type, message);
      setSelectedType(null);
      setCustomMessage('');
      setShowCustomInput(false);
    }
  };

  const handleBack = () => {
    setSelectedType(null);
    setShowCustomInput(false);
    setCustomMessage('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 p-4">
          <div>
            <h2 className="text-lg font-bold text-white">Connect with {recipientName}</h2>
            <p className="text-sm text-slate-400">Send a conversation request. What would you like to discuss?</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4">
          {!showCustomInput ? (
            <div className="space-y-3">
              {visibleTemplates.map((template) => (
                <button
                  key={template.type}
                  onClick={() => handleTypeSelect(template)}
                  className="flex w-full items-center gap-4 rounded-xl border border-slate-700 bg-slate-800/50 p-4 text-left transition hover:border-slate-600 hover:bg-slate-800"
                >
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${template.color} text-white`}>
                    {template.icon}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-white">{template.label}</div>
                    <div className="text-sm text-slate-400">{template.description}</div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-500" />
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
              >
                Back
              </button>

              <div className={`flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/50 p-3`}>
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${selectedType?.color} text-white`}>
                  {selectedType?.icon}
                </div>
                <div>
                  <div className="font-semibold text-white">{selectedType?.label}</div>
                  <div className="text-xs text-slate-400">{selectedType?.description}</div>
                </div>
              </div>

              <div>
                <p className="mb-3 text-sm font-medium text-slate-300">Choose a message or write your own:</p>
                <div className="space-y-2">
                  {selectedType?.autoMessages.map((msg, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(msg)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-800/50 p-3 text-left text-sm text-slate-300 transition hover:border-cyan-500/50 hover:bg-slate-800"
                    >
                      {msg}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-700 pt-4">
                <p className="mb-2 text-sm font-medium text-slate-300">Or write your own message:</p>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Type your custom message here..."
                  rows={4}
                  className="w-full resize-none rounded-xl border border-slate-700 bg-slate-800 p-3 text-sm text-white outline-none transition focus:border-cyan-500 placeholder:text-slate-500"
                />
                <button
                  onClick={() => handleSend(customMessage)}
                  disabled={!customMessage.trim()}
                  className="mt-3 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                >
                  Send Request
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
