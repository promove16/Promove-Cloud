import { startTransition, useDeferredValue, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  Compass,
  MessageCircle,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { DashboardLayout } from "../components/DashboardLayout";
import {
  MarketplaceRole,
  MarketplaceUserItem,
  marketplaceApi,
  normalizeMarketplaceEntityType,
} from "../../api/marketplace.api";
import { useAuthStore } from "../../store/authStore";
import { UserRole } from "../../types/roles.types";

const filters: Array<{
  id: MarketplaceRole;
  label: string;
  eyebrow: string;
  description: string;
  icon: typeof Compass;
  accent: string;
  suggestions: string[];
}> = [
  {
    id: "mentor",
    label: "Mentors",
    eyebrow: "Guidance",
    description: "Connect with mentors who can sharpen product thinking, execution rhythm, and launch readiness.",
    icon: Compass,
    accent: "from-cyan-400/25 via-cyan-400/10 to-transparent",
    suggestions: ["Product strategy", "AI", "Go-to-market"],
  },
  {
    id: "investor",
    label: "Investors",
    eyebrow: "Capital",
    description: "Discover investors tracking student innovation, traction signals, and founder-market fit.",
    icon: Building2,
    accent: "from-emerald-400/25 via-emerald-400/10 to-transparent",
    suggestions: ["Fintech", "Seed", "Climate"],
  },
  {
    id: "recruiter",
    label: "HRs",
    eyebrow: "Hiring",
    description: "Browse hiring leaders with active roles, talent priorities, and innovation-aligned hiring needs.",
    icon: BriefcaseBusiness,
    accent: "from-amber-400/25 via-amber-400/10 to-transparent",
    suggestions: ["Campus hiring", "Internships", "Remote"],
  },
];

const formatCompactNumber = (value: number) =>
  new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);

const getDashboardRole = (role?: UserRole) => role ?? UserRole.STUDENT;

const getSearchText = (item: MarketplaceUserItem) =>
  [
    item.displayName,
    item.domain ?? "",
    item.bio ?? "",
    item.headline ?? "",
    item.location ?? "",
    item.skills?.map((skill) => skill.name).join(" ") ?? "",
    item.experienceHighlights?.map((experience) => `${experience.title} ${experience.company}`).join(" ") ?? "",
    item.portfolioHighlights?.map((project) => project.title).join(" ") ?? "",
  ]
    .join(" ")
    .toLowerCase();

const buildStats = (item: MarketplaceUserItem) => [
  { label: "Skills", value: String(item.insightCounts.skills) },
  { label: "Experience", value: String(item.insightCounts.experience) },
  {
    label: item.entityType === "recruiter" ? "Open Roles" : "Projects",
    value:
      item.entityType === "recruiter"
        ? String(item.relatedCounts.jobs)
        : String(item.insightCounts.portfolioProjects),
  },
  { label: "Startups", value: String(item.relatedCounts.startups) },
];

export function Marketplace() {
  const navigate = useNavigate();
  const authUser = useAuthStore((state) => state.user);
  const [searchParams, setSearchParams] = useSearchParams();

  const requestedRole = normalizeMarketplaceEntityType(searchParams.get("role"));
  const activeFilter = filters.find((filter) => filter.id === requestedRole) ?? filters[0];
  const query = searchParams.get("q") ?? "";
  const deferredQuery = useDeferredValue(query.trim());

  const listQuery = useQuery({
    queryKey: ["marketplace", "directory", activeFilter.id, deferredQuery],
    queryFn: () =>
      marketplaceApi.list(activeFilter.id, {
        search: deferredQuery || undefined,
        limit: 48,
      }),
  });

  const items = useMemo(() => {
    const source = listQuery.data ?? [];

    if (!deferredQuery) {
      return source;
    }

    const needle = deferredQuery.toLowerCase();
    return source.filter((item) => getSearchText(item).includes(needle));
  }, [deferredQuery, listQuery.data]);

  const spotlight = items[0];
  const totalRoleCount = items.length;
  const totalSkills = items.reduce((count, item) => count + item.insightCounts.skills, 0);
  const totalOpenings = items.reduce((count, item) => count + item.relatedCounts.jobs, 0);

  const updateParams = (nextRole: MarketplaceRole, nextQuery: string) => {
    const normalizedQuery = nextQuery.trim();
    startTransition(() => {
      setSearchParams({
        role: nextRole,
        ...(normalizedQuery ? { q: normalizedQuery } : {}),
      });
    });
  };

  const handleMessage = (targetId: string) => {
    const storageKey = `dm_first_contact_${targetId}`;
    if (!localStorage.getItem(storageKey)) {
      localStorage.setItem(storageKey, "true");
    }
    navigate(`/dashboard/messages/${targetId}`);
  };

  return (
    <DashboardLayout role={getDashboardRole(authUser?.role)}>
      <div className="space-y-8">
        <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#070816] px-6 py-7 shadow-[0_30px_120px_rgba(15,23,42,0.45)] sm:px-8">
          <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${activeFilter.accent}`} />
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_60%)] lg:block" />
          <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.15fr),400px] lg:items-end">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100">
                Shared Marketplace
              </div>
              <div className="max-w-3xl space-y-3">
                <p className="text-sm font-medium uppercase tracking-[0.35em] text-slate-400">{activeFilter.eyebrow}</p>
                <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                  Search investors, mentors, and HR leaders from one dashboard lane
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-300">{activeFilter.description}</p>
              </div>

              <div className="flex flex-wrap gap-3 text-sm text-slate-300">
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                  <span className="text-white">{formatCompactNumber(totalRoleCount)}</span> live results
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                  <span className="text-white">{formatCompactNumber(totalSkills)}</span> listed skills
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                  <span className="text-white">{formatCompactNumber(totalOpenings)}</span> active HR roles
                </div>
                {spotlight ? (
                  <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                    Spotlight: <span className="text-white">{spotlight.displayName}</span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-black/20 p-4 backdrop-blur">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-200">Search the active lane</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.28em] text-slate-500">
                    Names, domains, skills, locations, and profile headlines
                  </div>
                </div>
                {query ? (
                  <button
                    type="button"
                    onClick={() => updateParams(activeFilter.id, "")}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-white/20 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                    Clear
                  </button>
                ) : null}
              </div>

              <label className="relative block">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                <input
                  value={query}
                  onChange={(event) => updateParams(activeFilter.id, event.target.value)}
                  placeholder={`Search ${activeFilter.label.toLowerCase()} by name, skill, or domain`}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 py-3 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50"
                />
              </label>

              <div className="mt-4 flex flex-wrap gap-2">
                {activeFilter.suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => updateParams(activeFilter.id, suggestion)}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-white"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[320px,minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-[28px] border border-white/10 bg-[#0a0d1d]">
            <div className="border-b border-white/10 px-5 py-5">
              <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Marketplace filters</div>
              <div className="mt-2 text-lg font-semibold text-white">Browse by audience</div>
            </div>
            <div className="space-y-3 p-3">
              {filters.map((filter) => {
                const Icon = filter.icon;
                const isActive = filter.id === activeFilter.id;

                return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => updateParams(filter.id, query)}
                    className={`w-full rounded-[22px] border px-4 py-4 text-left transition ${
                      isActive
                        ? "border-cyan-400/30 bg-cyan-400/10 text-white"
                        : "border-transparent bg-transparent text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-2xl ${
                          isActive ? "bg-white/10 text-cyan-200" : "bg-white/5 text-slate-300"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="space-y-1">
                        <span className="block text-sm font-semibold">{filter.label}</span>
                        <span className="block text-xs uppercase tracking-[0.24em] text-slate-500">{filter.eyebrow}</span>
                        <span className="block text-xs leading-5 text-slate-400">{filter.description}</span>
                      </span>
                    </div>
                  </button>
                );
              })}

              <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-slate-500">
                  <Sparkles className="h-4 w-4" />
                  Search guidance
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Use role-specific keywords like hiring, seed, AI, campus, fintech, design systems, or growth to narrow the directory faster.
                </p>
              </div>
            </div>
          </aside>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-[#090d1b] px-5 py-4">
              <div>
                <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Results</div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {totalRoleCount} {activeFilter.label.toLowerCase()} {totalRoleCount === 1 ? "match" : "matches"}
                </div>
              </div>
              <div className="text-sm text-slate-400">
                {deferredQuery ? (
                  <>
                    Search term: <span className="font-medium text-white">{deferredQuery}</span>
                  </>
                ) : (
                  "Search is optional. Start browsing or type to narrow the directory."
                )}
              </div>
            </div>

            {listQuery.isLoading ? (
              <div className="rounded-[28px] border border-white/10 bg-[#0a0d1d] px-6 py-10 text-sm text-slate-400">
                Loading marketplace results...
              </div>
            ) : null}

            {listQuery.isError ? (
              <div className="rounded-[28px] border border-rose-500/20 bg-rose-500/10 px-6 py-5 text-sm text-rose-100">
                Unable to load marketplace items right now.
              </div>
            ) : null}

            {!listQuery.isLoading && !listQuery.isError && items.length === 0 ? (
              <div className="rounded-[28px] border border-white/10 bg-[#0a0d1d] px-6 py-10">
                <div className="text-xs uppercase tracking-[0.28em] text-slate-500">No matches</div>
                <h2 className="mt-3 text-2xl font-semibold text-white">No profiles matched this search</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  Try another keyword, switch from {activeFilter.label.toLowerCase()} to a different filter, or clear the search box to browse the full directory.
                </p>
              </div>
            ) : null}

            {items.map((item) => {
              const stats = buildStats(item);
              const chips = [
                item.domain ?? "",
                item.location ?? "",
                ...(item.skills ?? []).slice(0, 4).map((skill) => skill.name),
              ].filter(Boolean);

              return (
                <article
                  key={`${item.entityType}-${item._id}`}
                  className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#090d1b] px-6 py-6 shadow-[0_24px_80px_rgba(2,6,23,0.35)]"
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                  <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 space-y-4">
                      <div className="flex items-start gap-4">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[22px] bg-gradient-to-br from-cyan-500/25 via-sky-500/10 to-fuchsia-500/20 text-xl font-semibold text-white ring-1 ring-white/10">
                          {item.avatar ? (
                            <img src={item.avatar} alt={item.displayName} className="h-16 w-16 object-cover" />
                          ) : (
                            item.displayName.slice(0, 1).toUpperCase()
                          )}
                        </div>

                        <div className="min-w-0 space-y-2">
                          <div>
                            <div className="text-xs uppercase tracking-[0.32em] text-slate-500">
                              {filters.find((filter) => filter.id === item.entityType)?.label ?? item.entityType}
                            </div>
                            <h2 className="truncate text-2xl font-semibold text-white">{item.displayName}</h2>
                            <p className="mt-1 text-sm text-cyan-200">
                              {item.headline ?? item.domain ?? "Public marketplace profile"}
                            </p>
                          </div>
                          <p className="max-w-3xl text-sm leading-7 text-slate-300">
                            {item.bio ?? "This public profile is active in the marketplace. Open the detail view for skills, experience, and connected work."}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {chips.slice(0, 6).map((chip) => (
                          <span
                            key={`${item._id}-${chip}`}
                            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300"
                          >
                            {chip}
                          </span>
                        ))}
                      </div>

                      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {stats.map((stat) => (
                          <div key={`${item._id}-${stat.label}`} className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-3">
                            <dt className="text-xs uppercase tracking-[0.25em] text-slate-500">{stat.label}</dt>
                            <dd className="mt-2 text-lg font-semibold text-white">{stat.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-3 xl:justify-end">
                      <button
                        type="button"
                        onClick={() => handleMessage(item._id)}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/10"
                      >
                        <MessageCircle className="h-4 w-4" />
                        Message
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/marketplace/view/${item.entityType}/${item._id}`)}
                        className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                      >
                        View details
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
