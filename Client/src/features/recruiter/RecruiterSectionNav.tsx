import { NavLink } from 'react-router-dom';

type RecruiterSectionNavItem = {
  label: string;
  path: string;
  end?: boolean;
};

export const RECRUITER_PAGE_CONTENT_CLASS = 'w-full';

export const recruiterMarketplaceSectionItems: RecruiterSectionNavItem[] = [
  { label: 'Marketplace', path: '/dashboard/recruiter/marketplace', end: true },
  { label: 'Applications', path: '/dashboard/recruiter/applications', end: true },
];

export const recruiterDriveSectionItems: RecruiterSectionNavItem[] = [
  { label: 'Active Drives', path: '/dashboard/recruiter/drives', end: true },
  { label: 'Hiring Events', path: '/dashboard/recruiter/hiring-events', end: true },
  { label: 'Onboarding Tracker', path: '/dashboard/recruiter/onboarding', end: true },
];

export function RecruiterSectionNav({ items }: { items: RecruiterSectionNavItem[] }) {
  return (
    <div className="overflow-x-auto pb-1">
      <nav
        aria-label="Recruiter section navigation"
        className="inline-flex min-w-max items-center gap-1 rounded-full border border-slate-800 bg-slate-950 p-1"
      >
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end ?? true}
            className={({ isActive }) =>
              `inline-flex items-center rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition ${
                isActive
                  ? 'bg-cyan-400 text-slate-950 shadow-[0_0_0_1px_rgba(59,130,246,0.16)]'
                  : 'text-slate-300 hover:bg-slate-900 hover:text-white'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
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
