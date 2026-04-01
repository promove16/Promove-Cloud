import { useDeferredValue, useMemo } from "react";
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
  Users,
} from "lucide-react";
import { DashboardLayout } from "../components/DashboardLayout";
import {
  MarketplaceDirectoryItem,
  MarketplaceEntityType,
  MarketplaceStartupItem,
  MarketplaceUserItem,
  marketplaceApi,
} from "../../api/marketplace.api";
import { useAuthStore } from "../../store/authStore";
import { UserRole } from "../../types/roles.types";

const tabs: Array<{
  id: MarketplaceEntityType;
  label: string;
  eyebrow: string;
  description: string;
  accent: string;
  icon: typeof Users;
}> = [
  {
    id: "mentor",
    label: "Mentors",
    eyebrow: "Guidance",
    description: "Find mentors who can sharpen product thinking, execution, and launch strategy.",
    accent: "from-cyan-400/20 via-cyan-400/5 to-transparent",
    icon: Compass,
  },
  {
    id: "investor",
    label: "Investors",
    eyebrow: "Capital",
    description: "Discover investors tracking student innovation, early traction, and venture readiness.",
    accent: "from-emerald-400/20 via-emerald-400/5 to-transparent",
    icon: Building2,
  },
  {
    id: "recruiter",
    label: "Recruiters",
    eyebrow: "Hiring",
    description: "Browse recruiters with active roles, score thresholds, and innovation-aligned hiring needs.",
    accent: "from-amber-400/20 via-amber-400/5 to-transparent",
    icon: BriefcaseBusiness,
  },
  {
    id: "startup",
    label: "Startups",
    eyebrow: "Launches",
    description: "Track live startups, founder teams, and project execution signals from across the platform.",
    accent: "from-fuchsia-400/20 via-fuchsia-400/5 to-transparent",
    icon: Sparkles,
  },
];

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const formatCompactNumber = (value: number) =>
  new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);

const formatRoleLabel = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const getDashboardRole = (role?: UserRole) => role ?? UserRole.STUDENT;

const isStartupItem = (item: MarketplaceDirectoryItem): item is MarketplaceStartupItem => item.entityType === "startup";

const getSearchText = (item: MarketplaceDirectoryItem) => {
  if (isStartupItem(item)) {
    return [
      item.name,
      item.tagline,
      item.category,
      item.stage,
      item.founders.map((founder) => founder.displayName).join(" "),
      item.launchTargets.join(" "),
      item.project?.title ?? "",
    ]
      .join(" ")
      .toLowerCase();
  }

  return [
    item.displayName,
    item.role,
    item.domain ?? "",
    item.bio ?? "",
    item.headline ?? "",
    item.location ?? "",
    item.skills?.map((skill) => skill.name).join(" ") ?? "",
  ]
    .join(" ")
    .toLowerCase();
};

const buildStatList = (item: MarketplaceDirectoryItem) => {
  if (isStartupItem(item)) {
    return [
      { label: "Score", value: String(item.innovationScoreAtLaunch) },
      { label: "Team", value: String(item.teamSize) },
      { label: "Products", value: String(item.activeProducts) },
      {
        label: "Funding",
        value: typeof item.fundingNeeded === "number" ? currency.format(item.fundingNeeded) : "Undisclosed",
      },
    ];
  }

  const userItem = item as MarketplaceUserItem;
  return [
    { label: "Skills", value: String(userItem.insightCounts.skills) },
    { label: "Experience", value: String(userItem.insightCounts.experience) },
    { label: "Projects", value: String(userItem.insightCounts.portfolioProjects) },
    {
      label: userItem.entityType === "recruiter" ? "Open Jobs" : "Startups",
      value:
        userItem.entityType === "recruiter"
          ? String(userItem.relatedCounts.jobs)
          : String(userItem.relatedCounts.startups),
    },
  ];
};

export function Marketplace() {
  const navigate = useNavigate();
  const authUser = useAuthStore((state) => state.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const entityType = (searchParams.get("role") as MarketplaceEntityType | null) ?? "mentor";
  const query = searchParams.get("q") ?? "";
  const deferredQuery = useDeferredValue(query);

  const activeTab = tabs.find((tab) => tab.id === entityType) ?? tabs[0];

  const listQuery = useQuery({
    queryKey: ["marketplace", entityType, deferredQuery],
    queryFn: () =>
      marketplaceApi.list(entityType, {
        domain: deferredQuery || undefined,
        limit: entityType === "startup" ? 48 : 36,
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
  const totalCount = items.length;
  const highlightedStat = isStartupItem(spotlight)
    ? `${spotlight.launchTargets.length || 1} discovery lanes`
    : spotlight
      ? `${spotlight.insightCounts.portfolioProjects} projects`
      : "0 projects";

  const handleMessage = (targetId: string) => {
    const storageKey = `dm_first_contact_${targetId}`;
    if (!localStorage.getItem(storageKey)) {
      localStorage.setItem(storageKey, "true");
    }
    navigate(`/dashboard/messages/${targetId}`);
  };

  const renderActions = (item: MarketplaceDirectoryItem) => {
    if (isStartupItem(item)) {
      return (
        <div className="flex flex-wrap items-center gap-3">
          {item.primaryFounderId ? (
            <button
              onClick={() => handleMessage(item.primaryFounderId!)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/10"
            >
              <MessageCircle className="h-4 w-4" />
              Message Founder
            </button>
          ) : null}
          <button
            onClick={() => navigate(`/marketplace/view/startup/${item._id}`)}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
          >
            View Startup
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => handleMessage(item._id)}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/10"
        >
          <MessageCircle className="h-4 w-4" />
          Message
        </button>
        <button
          onClick={() => navigate(`/marketplace/view/${item.entityType}/${item._id}`)}
          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
        >
          View Details
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  };

  return (
    <DashboardLayout role={getDashboardRole(authUser?.role)}>
      <div className="space-y-8">
        <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#070816] px-6 py-7 shadow-[0_30px_120px_rgba(15,23,42,0.45)] sm:px-8">
          <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${activeTab.accent}`} />
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_60%)] lg:block" />
          <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.1fr),380px] lg:items-end">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100">
                Student Marketplace
              </div>
              <div className="max-w-3xl space-y-3">
                <p className="text-sm font-medium uppercase tracking-[0.35em] text-slate-400">{activeTab.eyebrow}</p>
                <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                  Explore {activeTab.label.toLowerCase()} and active startup launches
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-300">{activeTab.description}</p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-slate-300">
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                  <span className="text-white">{formatCompactNumber(totalCount)}</span> live results
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                  <span className="text-white">{highlightedStat}</span> in the current view
                </div>
                {spotlight ? (
                  <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                    Spotlight:{" "}
                    <span className="text-white">{isStartupItem(spotlight) ? spotlight.name : spotlight.displayName}</span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-black/20 p-4 backdrop-blur">
              <div className="mb-3 text-sm font-medium text-slate-300">Search the current directory</div>
              <label className="relative block">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                <input
                  value={query}
                  onChange={(event) =>
                    setSearchParams({
                      role: entityType,
                      ...(event.target.value ? { q: event.target.value } : {}),
                    })
                  }
                  placeholder="Search people, startups, skills, jobs, or domains"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 py-3 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50"
                />
              </label>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[280px,minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-[28px] border border-white/10 bg-[#0a0d1d]">
            <div className="border-b border-white/10 px-5 py-5">
              <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Browse by type</div>
              <div className="mt-2 text-lg font-semibold text-white">Marketplace lanes</div>
            </div>
            <div className="p-3">
              <div className="space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = tab.id === entityType;

                  return (
                    <button
                      key={tab.id}
                      onClick={() =>
                        setSearchParams({
                          role: tab.id,
                          ...(query ? { q: query } : {}),
                        })
                      }
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
                          <span className="block text-sm font-semibold">{tab.label}</span>
                          <span className="block text-xs leading-5 text-slate-400">{tab.eyebrow}</span>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 rounded-[22px] border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Current lens</div>
                <div className="mt-2 text-sm leading-6 text-slate-300">{activeTab.description}</div>
              </div>
            </div>
          </aside>

          <div className="space-y-4">
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
                <h2 className="mt-3 text-2xl font-semibold text-white">Nothing matched this search yet</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  Try another keyword, switch marketplace lanes, or clear the current search input.
                </p>
              </div>
            ) : null}

            {items.map((item) => {
              const stats = buildStatList(item);
              const title = isStartupItem(item) ? item.name : item.displayName;
              const subtitle = isStartupItem(item)
                ? `${item.category} - ${item.stage}`
                : `${formatRoleLabel(item.entityType)}${item.headline ? ` - ${item.headline}` : ""}`;
              const description = isStartupItem(item)
                ? item.tagline
                : item.bio ?? "Public profile details will appear here as more marketplace members complete their profiles.";
              const chipValues = isStartupItem(item)
                ? [
                    item.category,
                    item.stage,
                    ...item.launchTargets,
                    item.project?.title ?? "",
                    ...item.founders.map((founder) => founder.displayName),
                  ]
                : [
                    item.domain ?? "",
                    item.location ?? "",
                    ...(item.skills ?? []).slice(0, 3).map((skill) => skill.name),
                  ];

              return (
                <article
                  key={`${item.entityType}-${item._id}`}
                  className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#090d1b] px-6 py-6 shadow-[0_24px_80px_rgba(2,6,23,0.35)]"
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                  <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 space-y-4">
                      <div className="flex items-start gap-4">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] bg-gradient-to-br from-cyan-500/25 via-sky-500/10 to-fuchsia-500/20 text-xl font-semibold text-white ring-1 ring-white/10">
                          {isStartupItem(item) ? (
                            item.name.slice(0, 1).toUpperCase()
                          ) : item.avatar ? (
                            <img
                              src={item.avatar}
                              alt={item.displayName}
                              className="h-16 w-16 rounded-[22px] object-cover"
                            />
                          ) : (
                            item.displayName.slice(0, 1).toUpperCase()
                          )}
                        </div>

                        <div className="min-w-0 space-y-2">
                          <div>
                            <div className="text-xs uppercase tracking-[0.32em] text-slate-500">
                              {isStartupItem(item) ? "Startup" : formatRoleLabel(item.entityType)}
                            </div>
                            <h2 className="truncate text-2xl font-semibold text-white">{title}</h2>
                            <p className="mt-1 text-sm text-cyan-200">{subtitle}</p>
                          </div>
                          <p className="max-w-3xl text-sm leading-7 text-slate-300">{description}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {chipValues
                          .filter(Boolean)
                          .slice(0, 6)
                          .map((chip) => (
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

                    <div className="flex shrink-0 xl:justify-end">{renderActions(item)}</div>
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
