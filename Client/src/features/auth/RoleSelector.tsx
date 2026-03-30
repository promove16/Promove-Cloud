import {
  Briefcase,
  Building2,
  CheckCircle2,
  GraduationCap,
  Shield,
  TrendingUp,
  User,
  Users,
} from 'lucide-react';
import { UserRole } from '../../types/roles.types';

const roleOptions = [
  {
    role: UserRole.STUDENT,
    label: 'Student Innovator',
    subtitle: 'Build products, file patents, launch startups',
    icon: User,
  },
  {
    role: UserRole.SCHOOL,
    label: 'School',
    subtitle: 'Run innovation programs, track student projects',
    icon: Building2,
  },
  {
    role: UserRole.COLLEGE,
    label: 'College',
    subtitle: 'Operate incubation programs, mentor students',
    icon: GraduationCap,
  },
  {
    role: UserRole.MENTOR,
    label: 'Mentor',
    subtitle: 'Guide product development, review innovations',
    icon: Users,
  },
  {
    role: UserRole.INVESTOR,
    label: 'Investor',
    subtitle: 'Discover startups, fund student companies',
    icon: TrendingUp,
  },
  {
    role: UserRole.RECRUITER,
    label: 'Recruiter',
    subtitle: 'Source innovations, license technologies',
    icon: Briefcase,
  },
  {
    role: UserRole.ADMIN,
    label: 'Admin',
    subtitle: 'Manage platform, verify innovations',
    icon: Shield,
  },
] as const;

interface RoleSelectorProps {
  value: UserRole | null;
  onChange: (role: UserRole) => void;
  allowedRoles?: UserRole[];
}

export function RoleSelector({ value, onChange, allowedRoles }: RoleSelectorProps) {
  const visibleOptions = allowedRoles
    ? roleOptions.filter((option) => allowedRoles.includes(option.role))
    : roleOptions;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {visibleOptions.map((option) => (
        <button
          key={option.role}
          type="button"
          onClick={() => onChange(option.role)}
          className={`relative rounded-xl border-2 p-5 text-left transition-all ${
            value === option.role
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-slate-800 bg-slate-900 hover:border-slate-700'
          }`}
        >
          {value === option.role ? (
            <CheckCircle2 className="absolute right-4 top-4 h-5 w-5 text-blue-400" />
          ) : null}
          <option.icon
            className={`mb-4 h-9 w-9 ${
              value === option.role ? 'text-blue-400' : 'text-slate-400'
            }`}
          />
          <div className="mb-2 text-base font-bold text-white">{option.label}</div>
          <p className="text-sm text-slate-400">{option.subtitle}</p>
        </button>
      ))}
    </div>
  );
}
