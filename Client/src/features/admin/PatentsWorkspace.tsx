import { Outlet, useLocation } from 'react-router-dom';
import { AdminSectionTabs, getActiveAdminSection } from './AdminSectionTabs';
import { ADMIN_PATENTS_SECTION_LINKS } from './patentsNavigation';

export default function PatentsWorkspace() {
  const location = useLocation();
  const activeSection = getActiveAdminSection(location.pathname, ADMIN_PATENTS_SECTION_LINKS);

  return (
    <div className="space-y-8">
      <section className="border-b border-slate-800/80 pb-3">
        <div className="px-1 pb-6">
          <div className="min-w-0 max-w-4xl">
            <div className="text-[11px] uppercase tracking-[0.35em] text-cyan-300">Admin Patents</div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{activeSection.label}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{activeSection.description}</p>
          </div>
        </div>

        <AdminSectionTabs links={ADMIN_PATENTS_SECTION_LINKS} />
      </section>

      <Outlet />
    </div>
  );
}
