import { ReactNode } from 'react';
import { ArrowRight, LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

type AuthMetric = {
  label: string;
  value: string;
};

type AuthPillar = {
  icon: LucideIcon;
  title: string;
  description: string;
};

interface AuthShellProps {
  formEyebrow: string;
  formTitle: string;
  formDescription: string;
  panelBadge: string;
  panelTitle: string;
  panelDescription: string;
  panelMetrics: AuthMetric[];
  panelPillars: AuthPillar[];
  topLink: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}

export function AuthShell({
  formEyebrow,
  formTitle,
  formDescription,
  panelBadge,
  panelTitle,
  panelDescription,
  panelMetrics,
  panelPillars,
  topLink,
  footer,
  children,
}: AuthShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(245,158,11,0.14),_transparent_22%),linear-gradient(135deg,_#f7fbff_0%,_#fcfaf4_50%,_#f4f8f5_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[8%] top-16 h-48 w-48 rounded-full bg-cyan-300/30 blur-3xl" />
        <div className="absolute bottom-12 right-[12%] h-56 w-56 rounded-full bg-amber-200/40 blur-3xl" />
        <div className="absolute left-1/2 top-10 h-24 w-24 -translate-x-1/2 rounded-full border border-slate-200/60" />
      </div>

      <div className="relative mx-auto max-w-7xl">
        <div className="grid gap-12 xl:min-h-[820px] xl:grid-cols-[1.04fr_0.96fr] xl:gap-16">
          <section className="relative overflow-hidden px-2 py-4 text-white sm:px-4 sm:py-8 lg:px-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(45,212,191,0.22),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(96,165,250,0.24),_transparent_34%)]" />
            <div className="relative flex h-full flex-col justify-between gap-12 rounded-[36px] bg-[linear-gradient(160deg,_#07111f_0%,_#0b1b31_55%,_#10345b_100%)] px-8 py-8 sm:px-10 sm:py-10 lg:px-12">
              <div>
                <Link to="/" className="inline-flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-[0_12px_32px_rgba(37,99,235,0.22)] ring-1 ring-white/20">
                    <img
                      src="/image/promoveLogo.png"
                      alt="ProMove logo"
                      className="h-full w-full object-cover"
                    />
                  </span>
                  <span>
                    <span className="block text-[1.7rem] font-black tracking-[-0.04em]">ProMove</span>
                    <span className="block text-xs uppercase tracking-[0.34em] text-cyan-100/75">
                      Innovation Cloud
                    </span>
                  </span>
                </Link>

                <div className="mt-10 inline-flex border-b border-cyan-200/25 pb-2 text-xs font-semibold uppercase tracking-[0.34em] text-cyan-100">
                  {panelBadge}
                </div>
                <h1 className="mt-6 max-w-xl text-4xl font-black leading-[1.02] tracking-[-0.05em] sm:text-5xl">
                  {panelTitle}
                </h1>
                <p className="mt-5 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
                  {panelDescription}
                </p>
              </div>

              <div className="border-t border-white/12 pt-8">
                <div className="text-xs uppercase tracking-[0.32em] text-cyan-100/70">
                  Guided Access
                </div>
                <div className="mt-4 max-w-xl text-2xl font-bold tracking-[-0.04em]">
                  One doorway for verified builders and institutions.
                </div>
                <div className="mt-6 flex flex-wrap gap-x-8 gap-y-4">
                  {panelMetrics.map((metric) => (
                    <div key={metric.label}>
                      <div className="text-[0.65rem] uppercase tracking-[0.3em] text-slate-300/70">
                        {metric.label}
                      </div>
                      <div className="mt-1 text-xl font-bold">{metric.value}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-10 grid gap-8 md:grid-cols-3">
                  {panelPillars.map((pillar) => (
                    <div key={pillar.title} className="border-l border-white/12 pl-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/8">
                        <pillar.icon className="h-4 w-4 text-cyan-100" />
                      </div>
                      <div className="mt-4 text-lg font-semibold tracking-[-0.03em]">
                        {pillar.title}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{pillar.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="relative px-2 py-4 text-slate-950 sm:px-4 sm:py-8 lg:px-2">
            <div className="absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.14),_transparent_70%)]" />
            <div className="relative mx-auto flex max-w-xl flex-col">
              <div className="mb-8 flex justify-end text-sm font-medium text-slate-500">{topLink}</div>
              <div className="mb-8">
                <div className="text-xs font-semibold uppercase tracking-[0.34em] text-sky-700">
                  {formEyebrow}
                </div>
                <h2 className="mt-4 text-4xl font-black tracking-[-0.05em] text-slate-950">
                  {formTitle}
                </h2>
                <p className="mt-4 max-w-lg text-base leading-7 text-slate-600">
                  {formDescription}
                </p>
              </div>

              <div>{children}</div>

              <div className="mt-8 flex items-center justify-between gap-4 border-t border-slate-200/80 pt-5 text-sm text-slate-600">
                <span>{footer}</span>
                <span className="inline-flex items-center gap-2 font-semibold text-sky-700">
                  Secure access
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
