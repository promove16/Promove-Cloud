import { NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import { STARTUP_LAUNCH_SECTION_LINKS } from './navigation';

interface StartupSectionTabsProps {
  className?: string;
}

export function StartupSectionTabs({ className }: StartupSectionTabsProps) {
  const location = useLocation();

  return (
    <div className={twMerge(clsx('overflow-x-auto', className))}>
      <div className="flex min-w-max items-stretch gap-6 border-b border-slate-800/80 pb-1">
        {STARTUP_LAUNCH_SECTION_LINKS.map((section) => {
          const isActive = location.pathname === section.path || location.pathname.startsWith(`${section.path}/`);
          const Icon = section.icon;

          return (
            <NavLink
              key={section.path}
              to={section.path}
              className={`group relative flex min-w-[9rem] flex-col gap-2 pb-4 pr-2 text-sm transition ${
                isActive ? 'text-white' : 'text-slate-500 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                    isActive
                      ? 'bg-cyan-400/12 text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,0.15)]'
                      : 'bg-transparent text-slate-600 group-hover:text-slate-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="font-semibold">{section.shortLabel}</span>
              </div>
              <span
                className={`absolute bottom-0 left-0 h-[2px] rounded-full transition-all duration-300 ${
                  isActive
                    ? 'w-full bg-gradient-to-r from-cyan-300 via-sky-400 to-indigo-400'
                    : 'w-0 bg-slate-500/70 group-hover:w-full'
                }`}
              />
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}
