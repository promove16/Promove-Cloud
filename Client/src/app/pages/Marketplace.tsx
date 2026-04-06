import { isAxiosError } from "axios";
import { useDeferredValue, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  Compass,
  MapPin,
  MessageCircle,
  Search,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { DashboardLayout } from "../components/DashboardLayout";
import {
  MarketplaceDirectoryItem,
  MarketplaceEntityType,
  MarketplaceStartupItem,
  marketplaceApi,
} from "../../api/marketplace.api";
import { useAuthStore } from "../../store/authStore";
import { UserRole } from "../../types/roles.types";

type FilterSectionId = "role" | "score" | "domain" | "location" | "profile";
type ProfileDepthKey = "skills" | "experience" | "projects";

const marketplaceTabs: Array<{
  id: MarketplaceEntityType;
  label: string;
  icon: typeof Users;
}> = [
  { id: "student", label: "Students", icon: Users },
  { id: "mentor", label: "Mentors", icon: Compass },
  { id: "investor", label: "Investors", icon: Building2 },
  { id: "recruiter", label: "Recruiters", icon: Zap },
  { id: "startup", label: "Startups", icon: Sparkles },
];

const roleCopy: Record<MarketplaceEntityType, { title: string; description: string }> = {
  student: {
    title: "Student talent directory",
    description: "Scan student builders by score, skills, location, and visible execution proof.",
  },
  mentor: {
    title: "Mentor directory",
    description: "Find mentors with domain expertise, public experience, and portfolio context.",
  },
  investor: {
    title: "Investor directory",
    description: "Review investors by sector alignment, public footprint, and startup exposure.",
  },
  recruiter: {
    title: "Recruiter directory",
    description: "Browse recruiter profiles, hiring context, and active innovation-linked discovery signals.",
  },
  startup: {
    title: "Startup directory",
    description: "Track active startup launches, founder teams, and live project momentum across ProMove.",
  },
};

const scoreMarks = [0, 250, 500, 750, 1000];
const scoreRangeMin = scoreMarks[0];
const scoreRangeMax = scoreMarks[scoreMarks.length - 1];

const getDashboardRole = (role?: UserRole) => role ?? UserRole.STUDENT;

const isStartupItem = (item: MarketplaceDirectoryItem): item is MarketplaceStartupItem =>
  item.entityType === "startup";

const getQueryTypeForRole = (role?: string | null) => {
  if (role === UserRole.MENTOR) return "project_mentor" as const;
  if (role === UserRole.INVESTOR) return "investor" as const;
  if (role === UserRole.RECRUITER) return "recruiter" as const;
  if (role === UserRole.STUDENT) return "project_join" as const;
  return "general" as const;
};

const roleLabel = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

function FilterSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-white/10 pt-5 first:border-t-0 first:pt-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-[1.05rem] font-semibold text-white">{title}</span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>
      {open ? <div className="pt-4">{children}</div> : null}
    </section>
  );
}

function CheckboxRow({
  checked,
  label,
  helper,
  onToggle,
}: {
  checked: boolean;
  label: string;
  helper?: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left transition hover:bg-white/5"
    >
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-md border transition ${
          checked
            ? "border-cyan-400 bg-cyan-400 text-slate-950"
            : "border-white/20 bg-transparent text-transparent"
        }`}
      >
        <Check className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1 text-sm text-slate-200">
        <span className="truncate">{label}</span>
        {helper ? <span className="ml-1 text-slate-500">({helper})</span> : null}
      </span>
    </button>
  );
}

export function Marketplace() {
  const navigate = useNavigate();
  const authUser = useAuthStore((state) => state.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const isRecruiter = authUser?.role === UserRole.RECRUITER;
  const requestedRole = (searchParams.get("role") as MarketplaceEntityType | null) ?? "student";
  const entityType = isRecruiter ? "student" : requestedRole;
  const query = searchParams.get("q") ?? "";
  const deferredQuery = useDeferredValue(query);

  const [openSections, setOpenSections] = useState<Record<FilterSectionId, boolean>>({
    role: !isRecruiter,
    score: true,
    domain: true,
    location: true,
    profile: true,
  });
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedDepth, setSelectedDepth] = useState<ProfileDepthKey[]>([]);
  const [minScore, setMinScore] = useState(0);
  const [maxScore, setMaxScore] = useState(1000);

  const listQuery = useQuery({
    queryKey: ["marketplace", entityType, deferredQuery, isRecruiter],
    queryFn: () =>
      marketplaceApi.list(entityType, {
        domain: deferredQuery || undefined,
        limit: entityType === "startup" ? 72 : 60,
      }),
  });

  const rawItems = listQuery.data ?? [];
  const listErrorMessage =
    isAxiosError(listQuery.error) &&
    listQuery.error.response?.data &&
    typeof listQuery.error.response.data === "object" &&
    "error" in listQuery.error.response.data &&
    listQuery.error.response.data.error &&
    typeof listQuery.error.response.data.error === "object" &&
    "message" in listQuery.error.response.data.error &&
    typeof listQuery.error.response.data.error.message === "string"
      ? listQuery.error.response.data.error.message
      : "Unable to load marketplace items right now.";

  const availableDomains = useMemo(() => {
    const map = new Map<string, number>();
    rawItems.forEach((item) => {
      if (isStartupItem(item)) {
        if (item.category) {
          map.set(item.category, (map.get(item.category) ?? 0) + 1);
        }
        return;
      }

      if (item.domain) {
        map.set(item.domain, (map.get(item.domain) ?? 0) + 1);
      }
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [rawItems]);

  const availableLocations = useMemo(() => {
    const map = new Map<string, number>();
    rawItems.forEach((item) => {
      if (!isStartupItem(item) && item.location) {
        map.set(item.location, (map.get(item.location) ?? 0) + 1);
      }
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [rawItems]);

  const filteredItems = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();

    return rawItems.filter((item) => {
      const searchText = isStartupItem(item)
        ? [
            item.name,
            item.tagline,
            item.category,
            item.stage,
            item.founders.map((founder) => founder.displayName).join(" "),
          ]
            .join(" ")
            .toLowerCase()
        : [
            item.displayName,
            item.headline ?? "",
            item.domain ?? "",
            item.location ?? "",
            item.bio ?? "",
            item.skills?.map((skill) => skill.name).join(" ") ?? "",
          ]
            .join(" ")
            .toLowerCase();

      if (needle && !searchText.includes(needle)) {
        return false;
      }

      if (selectedDomains.length > 0) {
        const domainValue = isStartupItem(item) ? item.category : item.domain ?? "";
        if (!selectedDomains.includes(domainValue)) {
          return false;
        }
      }

      if (selectedLocations.length > 0) {
        const locationValue = isStartupItem(item) ? "" : item.location ?? "";
        if (!selectedLocations.includes(locationValue)) {
          return false;
        }
      }

      if (!isStartupItem(item)) {
        const score = item.innovationScore ?? 0;
        if (score < minScore || score > maxScore) {
          return false;
        }

        if (selectedDepth.includes("skills") && item.insightCounts.skills === 0) {
          return false;
        }
        if (selectedDepth.includes("experience") && item.insightCounts.experience === 0) {
          return false;
        }
        if (selectedDepth.includes("projects") && item.insightCounts.portfolioProjects === 0) {
          return false;
        }
      }

      return true;
    });
  }, [deferredQuery, maxScore, minScore, rawItems, selectedDepth, selectedDomains, selectedLocations]);

  const activeMeta = roleCopy[entityType];

  const toggleMultiSelect = (
    value: string,
    current: string[],
    setValue: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    setValue((prev) =>
      prev.includes(value) ? prev.filter((entry) => entry !== value) : [...prev, value],
    );
  };

  const toggleDepth = (value: ProfileDepthKey) => {
    setSelectedDepth((prev) =>
      prev.includes(value) ? prev.filter((entry) => entry !== value) : [...prev, value],
    );
  };

  const openMessages = (targetId: string, queryType?: string) => {
    const nextPath = queryType
      ? `/dashboard/messages/${targetId}?queryType=${encodeURIComponent(queryType)}`
      : `/dashboard/messages/${targetId}`;
    navigate(nextPath);
  };

  const clearFilters = () => {
    setSelectedDomains([]);
    setSelectedLocations([]);
    setSelectedDepth([]);
    setMinScore(0);
    setMaxScore(1000);
  };

  const hasFilters =
    selectedDomains.length > 0 ||
    selectedLocations.length > 0 ||
    selectedDepth.length > 0 ||
    minScore > 0 ||
    maxScore < 1000;
  const minScorePercent = ((minScore - scoreRangeMin) / (scoreRangeMax - scoreRangeMin)) * 100;
  const maxScorePercent = ((maxScore - scoreRangeMin) / (scoreRangeMax - scoreRangeMin)) * 100;

  return (
    <DashboardLayout role={getDashboardRole(authUser?.role)}>
      <div className="min-h-full bg-[#04060f] px-0 py-0 text-white">
        <div className="border-b border-white/10 bg-[#080b16]">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 py-8 lg:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300/70">
                  ProMove Marketplace
                </div>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  {isRecruiter ? "Browse student talent only" : activeMeta.title}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                  {isRecruiter
                    ? "Recruiter access is limited to student profiles so this view behaves like a focused talent search with stronger filtering."
                    : activeMeta.description}
                </p>
              </div>

              <div className="w-full max-w-xl">
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
                    placeholder={
                      isRecruiter
                        ? "Search students by name, skill, domain, or location"
                        : "Search people, startups, skills, domains, or locations"
                    }
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] py-3.5 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:bg-white/[0.05]"
                  />
                </label>
              </div>
            </div>

            {!isRecruiter ? (
              <div className="flex flex-wrap gap-2">
                {marketplaceTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = tab.id === entityType;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() =>
                        setSearchParams({
                          role: tab.id,
                          ...(query ? { q: query } : {}),
                        })
                      }
                      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
                        isActive
                          ? "border-cyan-400 bg-cyan-400 text-slate-950"
                          : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-6 lg:grid-cols-[340px,minmax(0,1fr)] lg:px-8">
          <aside className="self-start rounded-[24px] border border-white/10 bg-[#0b1020] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between">
              <h2 className="text-[1.75rem] font-semibold text-white">All Filters</h2>
              {hasFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-sm font-medium text-cyan-300 hover:text-cyan-200"
                >
                  Clear
                </button>
              ) : null}
            </div>

            <div className="mt-6 space-y-6">
              {!isRecruiter ? (
                <FilterSection
                  title="Directory"
                  open={openSections.role}
                  onToggle={() => setOpenSections((prev) => ({ ...prev, role: !prev.role }))}
                >
                  <div className="space-y-1">
                    {marketplaceTabs.map((tab) => (
                      <CheckboxRow
                        key={tab.id}
                        checked={tab.id === entityType}
                        label={tab.label}
                        onToggle={() =>
                          setSearchParams({
                            role: tab.id,
                            ...(query ? { q: query } : {}),
                          })
                        }
                      />
                    ))}
                  </div>
                </FilterSection>
              ) : null}

              <FilterSection
                title="Innovation score"
                open={openSections.score}
                onToggle={() => setOpenSections((prev) => ({ ...prev, score: !prev.score }))}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm text-slate-400">
                    <span>{minScore}</span>
                    <span>{maxScore}</span>
                  </div>
                  <div className="relative h-8">
                    <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/15" />
                    <div
                      className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-cyan-400"
                      style={{
                        left: `${minScorePercent}%`,
                        width: `${Math.max(maxScorePercent - minScorePercent, 0)}%`,
                      }}
                    />
                    <input
                      type="range"
                      min={scoreRangeMin}
                      max={scoreRangeMax}
                      value={minScore}
                      onChange={(event) =>
                        setMinScore(Math.min(Number(event.target.value), maxScore))
                      }
                      className="pointer-events-none absolute left-0 top-1/2 h-8 w-full -translate-y-1/2 appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:mt-[-6px] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#04060f] [&::-webkit-slider-thumb]:bg-cyan-400 [&::-moz-range-track]:h-1.5 [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[#04060f] [&::-moz-range-thumb]:bg-cyan-400"
                    />
                    <input
                      type="range"
                      min={scoreRangeMin}
                      max={scoreRangeMax}
                      value={maxScore}
                      onChange={(event) =>
                        setMaxScore(Math.max(Number(event.target.value), minScore))
                      }
                      className="pointer-events-none absolute left-0 top-1/2 h-8 w-full -translate-y-1/2 appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:mt-[-6px] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#04060f] [&::-webkit-slider-thumb]:bg-cyan-400 [&::-moz-range-track]:h-1.5 [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[#04060f] [&::-moz-range-thumb]:bg-cyan-400"
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    {scoreMarks.map((mark) => (
                      <span key={mark}>{mark}</span>
                    ))}
                  </div>
                </div>
              </FilterSection>

              <FilterSection
                title="Domain"
                open={openSections.domain}
                onToggle={() => setOpenSections((prev) => ({ ...prev, domain: !prev.domain }))}
              >
                <div className="space-y-1">
                  {availableDomains.length > 0 ? (
                    availableDomains.map(([domain, count]) => (
                      <CheckboxRow
                        key={domain}
                        checked={selectedDomains.includes(domain)}
                        label={domain}
                        helper={String(count)}
                        onToggle={() => toggleMultiSelect(domain, selectedDomains, setSelectedDomains)}
                      />
                    ))
                  ) : (
                    <div className="text-sm text-slate-500">No domain filters available.</div>
                  )}
                </div>
              </FilterSection>

              <FilterSection
                title="Location"
                open={openSections.location}
                onToggle={() => setOpenSections((prev) => ({ ...prev, location: !prev.location }))}
              >
                <div className="space-y-1">
                  {availableLocations.length > 0 ? (
                    availableLocations.map(([location, count]) => (
                      <CheckboxRow
                        key={location}
                        checked={selectedLocations.includes(location)}
                        label={location}
                        helper={String(count)}
                        onToggle={() =>
                          toggleMultiSelect(location, selectedLocations, setSelectedLocations)
                        }
                      />
                    ))
                  ) : (
                    <div className="text-sm text-slate-500">No location filters available.</div>
                  )}
                </div>
              </FilterSection>

              <FilterSection
                title="Profile depth"
                open={openSections.profile}
                onToggle={() => setOpenSections((prev) => ({ ...prev, profile: !prev.profile }))}
              >
                <div className="space-y-1">
                  <CheckboxRow
                    checked={selectedDepth.includes("skills")}
                    label="Has listed skills"
                    onToggle={() => toggleDepth("skills")}
                  />
                  <CheckboxRow
                    checked={selectedDepth.includes("experience")}
                    label="Has experience highlights"
                    onToggle={() => toggleDepth("experience")}
                  />
                  <CheckboxRow
                    checked={selectedDepth.includes("projects")}
                    label="Has portfolio projects"
                    onToggle={() => toggleDepth("projects")}
                  />
                </div>
              </FilterSection>
            </div>
          </aside>

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-[#0b1020] px-5 py-4">
              <div>
                <div className="text-sm font-medium text-slate-400">
                  {filteredItems.length} result{filteredItems.length === 1 ? "" : "s"}
                </div>
                <div className="mt-1 text-sm text-slate-300">
                  {isRecruiter
                    ? "Recruiter view is restricted to students."
                    : `Current lane: ${roleLabel(entityType)}`}
                </div>
              </div>
              {hasFilters ? (
                <div className="flex flex-wrap gap-2">
                  {selectedDomains.map((domain) => (
                    <span
                      key={domain}
                      className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300"
                    >
                      {domain}
                    </span>
                  ))}
                  {selectedLocations.map((location) => (
                    <span
                      key={location}
                      className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300"
                    >
                      {location}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            {listQuery.isLoading ? (
              <div className="rounded-[24px] border border-white/10 bg-[#0b1020] px-6 py-12 text-sm text-slate-400">
                Loading marketplace results...
              </div>
            ) : null}

            {listQuery.isError ? (
              <div className="rounded-[24px] border border-rose-500/30 bg-rose-500/10 px-6 py-5 text-sm text-rose-200">
                {listErrorMessage}
              </div>
            ) : null}

            {!listQuery.isLoading && !listQuery.isError && filteredItems.length === 0 ? (
              <div className="rounded-[24px] border border-white/10 bg-[#0b1020] px-6 py-12">
                <div className="text-sm font-medium text-slate-400">No matches</div>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  No profiles match these filters
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  Try broadening the score range, clearing one filter section, or searching with a
                  different keyword.
                </p>
              </div>
            ) : null}

            {filteredItems.map((item) => {
              const title = isStartupItem(item) ? item.name : item.displayName;
              const subtitle = isStartupItem(item)
                ? `${item.category} • ${item.stage}`
                : item.headline || roleLabel(item.entityType);
              const description = isStartupItem(item)
                ? item.tagline
                : item.bio || "Public profile details will appear here as more members complete their profiles.";
              const score = isStartupItem(item)
                ? item.innovationScoreAtLaunch
                : item.innovationScore ?? 0;
              const primaryTargetId = isStartupItem(item)
                ? item.primaryFounderId ?? item._id
                : item._id;
              const isSelf = primaryTargetId === authUser?._id;
              const chips = isStartupItem(item)
                ? [item.category, item.stage, ...item.launchTargets]
                : [
                    item.domain ?? "",
                    item.location ?? "",
                    ...(item.skills ?? []).slice(0, 4).map((skill) => skill.name),
                  ].filter(Boolean);

              return (
                <article
                  key={`${item.entityType}-${item._id}`}
                  className="rounded-[26px] border border-white/10 bg-[#0b1020] px-5 py-5 shadow-[0_18px_60px_rgba(0,0,0,0.25)]"
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-4">
                        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-[20px] bg-white/5 text-xl font-semibold text-white">
                          {isStartupItem(item) ? (
                            item.name.slice(0, 1).toUpperCase()
                          ) : item.avatar ? (
                            <img
                              src={item.avatar}
                              alt={item.displayName}
                              className="h-16 w-16 rounded-[20px] object-cover"
                            />
                          ) : (
                            item.displayName.slice(0, 1).toUpperCase()
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300/70">
                              {isStartupItem(item) ? "Startup" : roleLabel(item.entityType)}
                            </div>
                            {!isStartupItem(item) ? (
                              <div className="inline-flex items-center gap-1 rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs font-medium text-cyan-200">
                                <Zap className="h-3 w-3" />
                                {score}
                              </div>
                            ) : null}
                          </div>
                          <h2 className="mt-2 text-2xl font-semibold text-white">{title}</h2>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                            <span>{subtitle}</span>
                            {!isStartupItem(item) && item.location ? (
                              <>
                                <span className="text-slate-600">&bull;</span>
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="h-3.5 w-3.5" />
                                  {item.location}
                                </span>
                              </>
                            ) : null}
                          </div>
                          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
                            {description}
                          </p>
                        </div>
                      </div>

                      {chips.length > 0 ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {chips.slice(0, 6).map((chip) => (
                            <span
                              key={`${item._id}-${chip}`}
                              className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300"
                            >
                              {chip}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {!isStartupItem(item) ? (
                        <div className="mt-5 grid gap-3 sm:grid-cols-4">
                          <div className="rounded-2xl bg-white/5 px-4 py-3">
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                              Score
                            </div>
                            <div className="mt-2 text-lg font-semibold text-white">{score}</div>
                          </div>
                          <div className="rounded-2xl bg-white/5 px-4 py-3">
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                              Skills
                            </div>
                            <div className="mt-2 text-lg font-semibold text-white">
                              {item.insightCounts.skills}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-white/5 px-4 py-3">
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                              Experience
                            </div>
                            <div className="mt-2 text-lg font-semibold text-white">
                              {item.insightCounts.experience}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-white/5 px-4 py-3">
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                              Projects
                            </div>
                            <div className="mt-2 text-lg font-semibold text-white">
                              {item.insightCounts.portfolioProjects}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2 xl:w-[240px] xl:flex-col">
                      {!isSelf ? (
                        <button
                          type="button"
                          onClick={() =>
                            openMessages(
                              primaryTargetId,
                              isStartupItem(item) || item.entityType === "student"
                                ? "project_join"
                                : getQueryTypeForRole(item.entityType),
                            )
                          }
                          className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-400 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-300"
                        >
                          <MessageCircle className="h-4 w-4" />
                          {isStartupItem(item) || item.entityType === "student"
                            ? "Request to Join"
                            : "Message"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            isStartupItem(item)
                              ? `/marketplace/view/startup/${item._id}`
                              : `/marketplace/view/${item.entityType}/${item._id}`,
                          )
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-white/30"
                      >
                        View Details
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
