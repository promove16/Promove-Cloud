import { type ReactNode } from 'react';

type InvestorWorkspaceLayoutProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  headerAction?: ReactNode;
  tabsAction?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
};

export function InvestorWorkspaceLayout({
  title,
  description,
  eyebrow = 'Investor Workspace',
  headerAction,
  tabsAction,
  children,
  contentClassName,
}: InvestorWorkspaceLayoutProps) {
  return (
    <div className="space-y-6 px-4 pb-6 sm:px-6">
      <section className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.35em] text-cyan-300">{eyebrow}</div>
            <h1 className="mt-2 text-3xl font-bold text-white md:text-4xl">{title}</h1>
            {description ? <p className="mt-2 max-w-3xl text-slate-400">{description}</p> : null}
          </div>
          {headerAction ? <div className="w-full shrink-0 lg:w-auto">{headerAction}</div> : null}
        </div>

        {tabsAction ? <div className="flex justify-end border-b border-slate-800 pb-4">{tabsAction}</div> : null}
      </section>

      <div className={contentClassName}>{children}</div>
    </div>
  );
}
