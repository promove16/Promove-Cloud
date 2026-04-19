import { type ReactNode } from 'react';
import { InstitutionWorkspaceMenu } from './InstitutionWorkspaceMenu';

type InstitutionWorkspaceHeaderProps = {
  mode: 'school' | 'college';
  eyebrow: string;
  title?: string;
  description?: string;
  headerAction?: ReactNode;
  tabsAction?: ReactNode;
  showMenu?: boolean;
};

export function InstitutionWorkspaceHeader({
  mode,
  eyebrow,
  title,
  description,
  headerAction,
  tabsAction,
  showMenu = true,
}: InstitutionWorkspaceHeaderProps) {
  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.35em] text-cyan-300">{eyebrow}</div>
          {title ? <h1 className="mt-2 text-3xl font-bold text-white md:text-4xl">{title}</h1> : null}
          {description ? <p className="mt-2 max-w-3xl text-slate-400">{description}</p> : null}
        </div>
        {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
      </div>

      {showMenu || tabsAction ? (
        <div
          className={`flex flex-col gap-4 border-b border-slate-800 pb-4 ${
            showMenu
              ? 'xl:flex-row xl:items-end xl:justify-between'
              : 'xl:items-end'
          }`}
        >
          {showMenu ? (
            <InstitutionWorkspaceMenu mode={mode} className="min-w-0 flex-1" />
          ) : null}
          {tabsAction ? (
            <div className={showMenu ? 'shrink-0' : 'flex justify-end'}>{tabsAction}</div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
