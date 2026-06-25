import { useSearchParams } from 'react-router-dom';
import { BriefcaseBusiness, CalendarDays } from 'lucide-react';
import ActiveDrives from './ActiveDrives';
import HiringEvents from './HiringEvents';
import {
  RECRUITER_PAGE_CONTENT_CLASS,
  RecruiterSectionHeader,
  recruiterCampusSectionItems,
} from './RecruiterSectionNav';

type CampusMode = 'drives' | 'events';

const MODE_CONFIG: Record<CampusMode, { label: string; description: string; Icon: typeof BriefcaseBusiness }> = {
  drives: {
    label: 'Campus Drives',
    description: 'Open registration drives — students sign up, hackathon drives support submission scoring.',
    Icon: BriefcaseBusiness,
  },
  events: {
    label: 'Hiring Events',
    description: 'Job-linked scored assessments with composite rankings — push top candidates into your pipeline.',
    Icon: CalendarDays,
  },
};

export default function CampusActivities() {
  const [searchParams, setSearchParams] = useSearchParams();
  const mode: CampusMode = searchParams.get('mode') === 'events' ? 'events' : 'drives';

  const setMode = (next: CampusMode) => {
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      params.set('mode', next);
      // Clear event-specific params when switching modes
      if (next === 'drives') params.delete('eventId');
      return params;
    });
  };

  return (
    <div className={`${RECRUITER_PAGE_CONTENT_CLASS} space-y-6`}>
      <RecruiterSectionHeader
        eyebrow="Campus Hiring"
        title="Campus Activities"
        description="Manage campus drives and scored hiring events from one place."
        navItems={recruiterCampusSectionItems}
      />

      {/* Mode Toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-full border border-slate-800 bg-slate-950 p-1">
          {(Object.entries(MODE_CONFIG) as [CampusMode, (typeof MODE_CONFIG)[CampusMode]][]).map(
            ([key, { label, Icon }]) => (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition ${
                  mode === key
                    ? 'bg-slate-100 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ),
          )}
        </div>
        <p className="text-sm text-slate-500">{MODE_CONFIG[mode].description}</p>
      </div>

      {/* Mode content — embedded suppresses sub-headers */}
      {mode === 'drives' ? <ActiveDrives embedded /> : <HiringEvents embedded />}
    </div>
  );
}
