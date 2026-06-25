import {
  BriefcaseBusiness,
  ClipboardList,
  Files,
  type LucideIcon,
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  getOptionTabClassName,
  getOptionTabsListClassName,
} from '../../components/ui/OptionTabs';

type RecruiterSectionNavItem = {
  label: string;
  path: string;
  end?: boolean;
  icon?: LucideIcon;
  matchPrefixes?: string[];
};

export const RECRUITER_PAGE_CONTENT_CLASS = 'w-full';

export const recruiterMarketplaceSectionItems: RecruiterSectionNavItem[] = [
  {
    label: 'Talent Pool',
    path: '/dashboard/recruiter/marketplace',
    end: true,
    icon: BriefcaseBusiness,
  },
  {
    label: 'Applications',
    path: '/dashboard/recruiter/applications',
    end: true,
    icon: Files,
  },
];

export const recruiterCampusSectionItems: RecruiterSectionNavItem[] = [
  {
    label: 'Campus Drives',
    path: '/dashboard/recruiter/campus',
    end: true,
    icon: BriefcaseBusiness,
    matchPrefixes: [
      '/dashboard/recruiter/campus',
      '/dashboard/recruiter/drives',
      '/dashboard/recruiter/hiring-events',
    ],
  },
  {
    label: 'Onboarding Tracker',
    path: '/dashboard/recruiter/onboarding',
    end: true,
    icon: ClipboardList,
  },
];

export const recruiterDriveSectionItems = recruiterCampusSectionItems;

export function RecruiterSectionNav({ items }: { items: RecruiterSectionNavItem[] }) {
  const location = useLocation();

  return (
    <div className="overflow-x-auto">
      <nav aria-label="Recruiter section navigation" className={getOptionTabsListClassName()}>
        {items.map((item) => {
          const isPrefixMatch = (item.matchPrefixes ?? []).some((prefix) =>
            location.pathname === prefix || location.pathname.startsWith(`${prefix}/`),
          );
          const isActive =
            isPrefixMatch ||
            location.pathname === item.path ||
            (!(item.end ?? true) && location.pathname.startsWith(`${item.path}/`));
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end ?? true}
              className={getOptionTabClassName({ active: isActive })}
            >
              {Icon ? (
                <span
                  className={
                    isActive
                      ? 'text-cyan-300'
                      : 'text-slate-500 group-hover:text-slate-300'
                  }
                >
                  <Icon className="h-4 w-4" />
                </span>
              ) : null}
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}

export function RecruiterSectionHeader({
  eyebrow,
  title,
  description,
  navItems,
}: {
  eyebrow: string;
  title: string;
  description: string;
  navItems: RecruiterSectionNavItem[];
}) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950 px-5 py-5 sm:px-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl space-y-2">
          <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">{eyebrow}</div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h1>
          <p className="text-sm leading-6 text-slate-400">{description}</p>
        </div>

        <div className="xl:pl-6">
          <RecruiterSectionNav items={navItems} />
        </div>
      </div>
    </section>
  );
}
