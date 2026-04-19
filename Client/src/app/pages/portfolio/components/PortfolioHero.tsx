interface PreviousEntry {
  company: string;
  role: string;
}

interface HeroDetail {
  label: string;
  value: string | number;
}

interface HeroStat {
  label: string;
  value: string | number;
}

interface PortfolioHeroProps {
  initials: string;
  avatarUrl?: string;
  name?: string;
  primaryRole: string;
  title: string;
  previousEntries?: PreviousEntry[];
  detailsLabel?: string;
  details?: HeroDetail[];
  stats?: HeroStat[];
  innovationScore?: number;
}

export function PortfolioHero({
  initials,
  avatarUrl,
  name,
  primaryRole,
  title,
  previousEntries = [],
  detailsLabel,
  details = [],
  stats = [],
  innovationScore,
}: PortfolioHeroProps) {
  const visibleEntries = previousEntries.slice(0, 3);
  const visibleDetails = details.filter((detail) => String(detail.value).trim().length > 0).slice(0, 3);
  const visibleStats = stats.filter((stat) => String(stat.value).trim().length > 0).slice(0, 4);
  const hasInnovationScoreStat = visibleStats.some((stat) => stat.label === "Innovation Score");

  return (
    <section className="border-b border-slate-800 pb-8">
      <div className="grid gap-6 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-start sm:gap-8">
        <div className="mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-slate-700 bg-black text-3xl font-semibold text-white sm:h-32 sm:w-32 sm:text-4xl">
          {avatarUrl ? (
            <img src={avatarUrl} alt={name ?? title} className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </div>

        <div className="text-slate-300">
          {name ? (
            <div className="text-2xl font-semibold leading-tight text-slate-100 sm:text-[2rem]">
              {name}
            </div>
          ) : null}

          <div className={`flex flex-wrap items-center gap-2 font-medium text-slate-100 ${name ? "mt-2 text-base sm:text-lg" : "text-base sm:text-lg"}`}>
            <span>{primaryRole}</span>
            <span className="text-slate-500">-</span>
            <span className="text-sm text-slate-400 sm:text-base">{title}</span>
          </div>

          {visibleDetails.length > 0 ? (
            <div className="mt-4 border-t border-slate-800 pt-4">
              {detailsLabel ? (
                <div className="text-[10px] uppercase tracking-[0.35em] text-slate-500">{detailsLabel}</div>
              ) : null}
              <div className="mt-3 space-y-1.5 text-xs sm:text-sm">
                {visibleDetails.map((detail) => (
                  <div key={detail.label} className="grid gap-1 sm:grid-cols-[minmax(0,130px)_minmax(0,1fr)] sm:gap-3">
                    <span className="font-medium text-slate-200">{detail.label}</span>
                    <span className="text-slate-400">{detail.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : visibleEntries.length > 0 ? (
            <div className="mt-4 border-t border-slate-800 pt-4">
              <div className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Previously</div>
              <div className="mt-3 space-y-1.5 text-xs sm:text-sm">
                {visibleEntries.map((entry) => (
                  <div key={`${entry.company}-${entry.role}`} className="grid gap-1 sm:grid-cols-[minmax(0,130px)_minmax(0,1fr)] sm:gap-3">
                    <span className="font-medium text-slate-200">{entry.company}</span>
                    <span className="text-slate-400">{entry.role}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {innovationScore !== undefined && !hasInnovationScoreStat ? (
            <div className="mt-4 border-t border-slate-800 pt-4 text-base font-semibold text-slate-100 sm:text-lg">
              Innovation Score <span className="text-[#48a9e6]">{innovationScore}</span>
            </div>
          ) : null}

          {visibleStats.length > 0 ? (
            <div className="mt-4 border-t border-slate-800 pt-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {visibleStats.map((stat) => (
                  <div key={stat.label} className="border-l border-slate-800 pl-3 first:border-l-0 first:pl-0">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{stat.label}</div>
                    <div className="mt-1 text-lg font-semibold text-white">{stat.value}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
