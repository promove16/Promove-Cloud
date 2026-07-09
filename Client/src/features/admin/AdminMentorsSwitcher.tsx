import { NavLink, useLocation } from 'react-router-dom';
import { GraduationCap, Award } from 'lucide-react';

const MENTORS_SECTION_LINKS = [
  {
    label: 'Mentorship',
    icon: GraduationCap,
    path: '/dashboard/admin/mentors/mentorship',
  },
  {
    label: 'Mentor Scores',
    icon: Award,
    path: '/dashboard/admin/mentors/scores',
  },
];

export function AdminMentorsSwitcher() {
  const location = useLocation();

  return (
    <div className="bg-slate-950/80 border border-slate-800 p-1 rounded-xl flex items-center gap-1 shadow-inner shrink-0">
      {MENTORS_SECTION_LINKS.map((link) => {
        const Icon = link.icon;
        const isActive = location.pathname.startsWith(link.path);
        return (
          <NavLink
            key={link.path}
            to={link.path}
            className={`inline-flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 ${
              isActive
                ? 'bg-violet-600/90 text-white shadow shadow-violet-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{link.label}</span>
          </NavLink>
        );
      })}
    </div>
  );
}
