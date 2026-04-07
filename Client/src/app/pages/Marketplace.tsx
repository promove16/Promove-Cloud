import { useDeferredValue, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  Compass,
  GraduationCap,
  MapPin,
  MessageCircle,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { DashboardLayout } from "../components/DashboardLayout";
import { RecruiterMarketplace } from "../../features/recruiter/RecruiterMarketplace";
import { getMarketplaceDetailPath } from "../../features/marketplace/navigation";
import {
  MarketplaceDirectoryItem,
  MarketplaceEntityType,
  MarketplaceStartupItem,
  MarketplaceUserItem,
  marketplaceApi,
} from "../../api/marketplace.api";
import { useAuthStore } from "../../store/authStore";
import { UserRole } from "../../types/roles.types";

const allTabs: Array<{
  id: MarketplaceEntityType;
  label: string;
  filterLabel: string;
  description: string;
  icon: typeof Users;
}> = [
  {
    id: "student",
    label: "Students",
    filterLabel: "Talent",
    description: "Find student builders by domain, skills, profile proof, and active startup participation.",
    icon: Users,
  },
  {
    id: "school",
    label: "Schools",
    filterLabel: "Mentorship programs",
    description: "Find schools requesting mentorship programs and innovation support.",
    icon: GraduationCap,
  },
  {
    id: "college",
    label: "Colleges",
    filterLabel: "Hiring events",
    description: "Find colleges for hiring events, placement conversations, and student discovery.",
    icon: Building2,
  },
  {
    id: "mentor",
    label: "Mentors",
    filterLabel: "Guidance",
    description: "Find mentors who can sharpen product thinking, execution, and launch strategy.",
    icon: Compass,
  },
  {
    id: "investor",
    label: "Investors",
    filterLabel: "Capital",
    description: "Discover investors tracking student innovation, early traction, and venture readiness.",
    icon: Building2,
  },
  {
    id: "recruiter",
    label: "Recruiters",
    filterLabel: "Hiring",
    description: "Browse recruiters with active roles, score thresholds, and innovation-aligned hiring needs.",
    icon: BriefcaseBusiness,
  },
  {
    id: "startup",
    label: "Startups",
    filterLabel: "Launches",
    description: "Track live startups, founder teams, and project execution signals from across the platform.",
    icon: Sparkles,
  },
];

const roleLaneIds: Partial<Record<UserRole, MarketplaceEntityType[]>> = {
  [UserRole.STUDENT]: ["recruiter", "mentor", "investor", "startup"],
  [UserRole.SCHOOL]: ["student", "mentor", "investor", "startup"],
  [UserRole.COLLEGE]: ["student", "recruiter", "mentor", "investor", "startup"],
  [UserRole.MENTOR]: ["student", "college", "school"],
  [UserRole.INVESTOR]: ["startup", "college", "school", "student"],
};

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const formatCompactNumber = (value: number) =>
  new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);

const formatRoleLabel = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const getDashboardRole = (role?: UserRole) => role ?? UserRole.STUDENT;

const getTabsForRole = (role: UserRole) => {
  const laneIds = roleLaneIds[role] ?? roleLaneIds[UserRole.STUDENT]!;
  return laneIds
    .map((id) => allTabs.find((tab) => tab.id === id))
    .filter((tab): tab is (typeof allTabs)[number] => Boolean(tab));
};

const isStartupItem = (item?: MarketplaceDirectoryItem | null): item is MarketplaceStartupItem =>
  item?.entityType === "startup";

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

const getTitle = (item: MarketplaceDirectoryItem) => (isStartupItem(item) ? item.name : item.displayName);

const getSubtitle = (item: MarketplaceDirectoryItem) =>
  isStartupItem(item)
    ? `${item.category} - ${item.stage}`
    : `${formatRoleLabel(item.entityType)}${item.headline ? ` - ${item.headline}` : ""}`;

const getDescription = (item: MarketplaceDirectoryItem) =>
  isStartupItem(item)
    ? item.tagline
    : item.bio ?? "Public profile details will appear here as more marketplace members complete their profiles.";

const getDetailChips = (item: MarketplaceDirectoryItem) =>
  isStartupItem(item)
    ? [
        item.category,
        item.stage,
        ...item.launchTargets,
        item.project?.title ?? "",
        ...item.founders.map((founder) => founder.displayName),
      ]
    : [item.domain ?? "", item.location ?? "", ...(item.skills ?? []).slice(0, 4).map((skill) => skill.name)];

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
  const authUser = useAuthStore((state) => state.user);
  const dashboardRole = getDashboardRole(authUser?.role);

  return dashboardRole === UserRole.RECRUITER ? (
    <RecruiterMarketplace dashboardRole={dashboardRole} />
  ) : (
    <GeneralMarketplace dashboardRole={dashboardRole} />
  );
}

function GeneralMarketplace({ dashboardRole }: { dashboardRole: UserRole }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const availableTabs = useMemo(() => getTabsForRole(dashboardRole), [dashboardRole]);
  const requestedEntityType = searchParams.get("role") as MarketplaceEntityType | null;
  const fallbackEntityType = availableTabs[0]?.id ?? "student";
  const entityType = availableTabs.some((tab) => tab.id === requestedEntityType)
    ? requestedEntityType!
    : fallbackEntityType;
  const query = searchParams.get("q") ?? "";
  const sort = searchParams.get("sort") ?? "recommended";
  const deferredQuery = useDeferredValue(query);
  const activeTab = availableTabs.find((tab) => tab.id === entityType) ?? availableTabs[0]!;

  const updateSearchParams = (next: { role?: MarketplaceEntityType; q?: string; sort?: string }) => {
    const nextQuery = next.q ?? query;
    const nextSort = next.sort ?? sort;

    setSearchParams({
      role: next.role ?? entityType,
      ...(nextQuery ? { q: nextQuery } : {}),
      ...(nextSort !== "recommended" ? { sort: nextSort } : {}),
    });
  };

  const listQuery = useQuery({
    queryKey: ["marketplace", entityType, deferredQuery],
    queryFn: () =>
      marketplaceApi.list(entityType, {
        domain: deferredQuery || undefined,
        limit: entityType === "startup" ? 48 : 36,
      }),
  });

  const items = useMemo(() => {
    const source = listQuery.data?.filter((item): item is MarketplaceDirectoryItem => Boolean(item)) ?? [];
    const filtered = deferredQuery
      ? source.filter((item) => getSearchText(item).includes(deferredQuery.toLowerCase()))
      : source;
    const sorted = [...filtered];

    if (sort === "name") {
      sorted.sort((left, right) => getTitle(left).localeCompare(getTitle(right)));
    }

    if (sort === "signal") {
      sorted.sort((left, right) => {
        const leftSignal = isStartupItem(left)
          ? left.innovationScoreAtLaunch
          : (left as MarketplaceUserItem).insightCounts.portfolioProjects;
        const rightSignal = isStartupItem(right)
          ? right.innovationScoreAtLaunch
          : (right as MarketplaceUserItem).insightCounts.portfolioProjects;
        return rightSignal - leftSignal;
      });
    }

    return sorted;
  }, [deferredQuery, listQuery.data, sort]);

  const totalCount = items.length;
  const filterPreview = availableTabs.map((tab) => ({
    ...tab,
    checked: tab.id === entityType,
  }));

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
        <div className="flex flex-wrap items-center gap-2">
          {item.primaryFounderId ? (
            <button
              onClick={() => handleMessage(item.primaryFounderId!)}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <MessageCircle className="h-4 w-4" />
              Message founder
            </button>
          ) : null}
            <button
              onClick={() => navigate(getMarketplaceDetailPath(dashboardRole, "startup", item._id))}
              className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
            >
            View startup
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => handleMessage(item._id)}
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          <MessageCircle className="h-4 w-4" />
          Message
        </button>
        <button
          onClick={() => navigate(getMarketplaceDetailPath(dashboardRole, item.entityType, item._id))}
          className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
        >
          View details
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  };

  return (
    <DashboardLayout role={dashboardRole}>
      <div className="-mx-4 -my-6 min-h-[calc(100vh-7rem)] bg-[#f4f5f8] px-4 py-5 text-slate-950 lg:-mx-8 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-5 xl:grid-cols-[280px,minmax(0,1fr)]">
          <aside className="h-max rounded-lg border border-slate-200 bg-white px-6 py-6 shadow-sm">
            <div className="text-lg font-semibold text-slate-950">All Filters</div>
            <div className="mt-5 border-t border-slate-200 pt-5">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold text-slate-950">Marketplace type</div>
                <span className="text-xs text-violet-600">Active</span>
              </div>
              <div className="mt-4 space-y-3">
                {filterPreview.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <label key={tab.id} className="flex cursor-pointer items-start gap-3 text-sm text-slate-700">
                      <input
                        type="radio"
                        name="marketplace-type"
                        checked={tab.checked}
                        onChange={() => updateSearchParams({ role: tab.id, q: query, sort })}
                        className="mt-1 h-4 w-4 border-slate-300 text-violet-600 focus:ring-violet-500"
                      />
                      <span className="flex min-w-0 flex-1 gap-3">
                        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span>
                          <span className="block font-medium text-slate-900">{tab.label}</span>
                          <span className="block text-xs leading-5 text-slate-500">{tab.filterLabel}</span>
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 border-t border-slate-200 pt-5">
              <div className="font-semibold text-slate-950">Search</div>
              <label className="relative mt-3 block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => updateSearchParams({ q: event.target.value })}
                  placeholder="Role, skill, domain"
                  className="h-11 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                />
              </label>
            </div>

            <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Current lens</div>
              <p className="mt-2 text-sm leading-6 text-slate-700">{activeTab.description}</p>
            </div>
          </aside>

          <main className="min-w-0">
            <div className="mb-4 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="text-sm text-slate-700">
                  {totalCount > 0 ? `1 - ${totalCount}` : "0"} of {formatCompactNumber(totalCount)}{" "}
                  <span className="font-semibold text-slate-950">{activeTab.label}</span>
                </div>
                <h1 className="mt-1 truncate text-xl font-semibold text-slate-950">{activeTab.label} marketplace</h1>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="rounded-md border border-violet-100 bg-violet-50 px-3 py-2 font-medium text-violet-700">
                  Matches refresh with filters
                </span>
                <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-slate-600">
                  Sort by:
                  <select
                    value={sort}
                    onChange={(event) => updateSearchParams({ sort: event.target.value })}
                    className="bg-transparent font-medium text-slate-950 outline-none"
                  >
                    <option value="recommended">Recommended</option>
                    <option value="signal">Profile signal</option>
                    <option value="name">Name</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="space-y-4">
              {listQuery.isLoading ? (
                <div className="rounded-lg border border-slate-200 bg-white px-6 py-10 text-sm text-slate-500 shadow-sm">
                  Loading marketplace results...
                </div>
              ) : null}

              {listQuery.isError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-6 py-5 text-sm text-rose-700 shadow-sm">
                  Unable to load marketplace items right now.
                </div>
              ) : null}

              {!listQuery.isLoading && !listQuery.isError && items.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-white px-6 py-10 shadow-sm">
                  <div className="text-sm font-semibold text-violet-700">No matches</div>
                  <h2 className="mt-2 text-xl font-semibold text-slate-950">Nothing matched this search yet</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    Try another keyword, switch marketplace type, or clear the current search input.
                  </p>
                </div>
              ) : null}

              {items.map((item) => {
                const stats = buildStatList(item);
                const title = getTitle(item);
                const subtitle = getSubtitle(item);
                const description = getDescription(item);
                const chips = getDetailChips(item).filter(Boolean).slice(0, 6);
                const avatarLabel = title.slice(0, 1).toUpperCase();

                return (
                  <article key={`${item.entityType}-${item._id}`} className="rounded-lg border border-slate-200 bg-white px-6 py-5 shadow-sm">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-violet-50 text-xl font-semibold text-violet-600 ring-1 ring-violet-100">
                            {!isStartupItem(item) && item.avatar ? (
                              <img src={item.avatar} alt={item.displayName} className="h-12 w-12 object-cover" />
                            ) : (
                              avatarLabel
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h2 className="truncate text-lg font-semibold text-slate-950">{title}</h2>
                            <p className="mt-1 truncate text-sm font-medium text-slate-700">{subtitle}</p>
                            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
                              {isStartupItem(item) ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <Sparkles className="h-4 w-4 text-slate-400" />
                                  {item.launchTargets.join(", ") || "Marketplace"}
                                </span>
                              ) : item.location ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <MapPin className="h-4 w-4 text-slate-400" />
                                  {item.location}
                                </span>
                              ) : null}
                              {stats.map((stat) => (
                                <span key={`${item._id}-${stat.label}`}>
                                  {stat.value} {stat.label.toLowerCase()}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-700">{description}</p>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {chips.map((chip) => (
                            <span key={`${item._id}-${chip}`} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                              {chip}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="shrink-0 lg:pt-1">{renderActions(item)}</div>
                    </div>
                  </article>
                );
              })}
            </div>
          </main>
        </div>
      </div>
    </DashboardLayout>
  );
}
