import type { ReactNode } from 'react';

export interface AdminHeaderStat {
  label: string;
  value: ReactNode;
  accent?: 'cyan' | 'amber' | 'violet' | 'emerald' | 'rose';
}

const STAT_DOT: Record<NonNullable<AdminHeaderStat['accent']>, string> = {
  cyan: 'bg-cyan-400',
  amber: 'bg-amber-400',
  violet: 'bg-violet-400',
  emerald: 'bg-emerald-400',
  rose: 'bg-rose-400',
};

/**
 * Shared "command band" header for admin workspace screens.
 * Mirrors the Admin Command Center hero so every admin page reads as one system:
 * grid texture, radial glow, a live status pulse, and Space Grotesk display type.
 */
export function AdminPageHeader({
  eyebrow,
  title,
  description,
  stats,
  actions,
  live = true,
  status,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  stats?: AdminHeaderStat[];
  actions?: ReactNode;
  live?: boolean;
  status?: string;
  children?: ReactNode;
}) {
  return (
    <section className="relative min-w-0 overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-950">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(34,211,238,0.12),transparent_42%),radial-gradient(circle_at_100%_0%,rgba(167,139,250,0.1),transparent_38%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(148,163,184,0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.6) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />
      <div className="relative px-6 py-6 lg:px-8 lg:py-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 max-w-2xl">
            <div className="flex items-center gap-2.5">
              {live ? (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
              ) : null}
              <span className="text-[11px] font-medium uppercase tracking-[0.34em] text-cyan-300">{eyebrow}</span>
            </div>
            <h1 className="font-heading mt-3 text-[1.75rem] font-semibold leading-[1.05] tracking-tight text-white sm:text-[2.25rem]">
              {title}
            </h1>
            {description ? <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p> : null}
            {status ? (
              <div className="mt-4 text-xs text-slate-500">{status}</div>
            ) : null}
          </div>

          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div> : null}
        </div>

        {stats && stats.length > 0 ? (
          <div className="mt-7 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="min-w-0 rounded-2xl border border-slate-800/80 bg-slate-900/50 px-4 py-3.5"
              >
                <div className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STAT_DOT[stat.accent ?? 'cyan']}`} />
                  <span className="truncate text-[10px] font-medium uppercase tracking-[0.24em] text-slate-500">
                    {stat.label}
                  </span>
                </div>
                <div className="font-heading mt-2 text-2xl font-semibold leading-none text-white tabular-nums">
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {children ? <div className="mt-6 min-w-0">{children}</div> : null}
      </div>
    </section>
  );
}
