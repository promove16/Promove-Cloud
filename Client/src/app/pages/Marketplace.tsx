import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  ChevronUp,
  Compass,
  Filter,
  GraduationCap,
  LayoutGrid,
  Lock,
  LucideIcon,
  MapPin,
  MessageCircle,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react";
import { RecruiterMarketplace } from "../../features/recruiter/RecruiterMarketplace";
import { getMarketplaceDetailPath } from "../../features/marketplace/navigation";
import {
  getStartupInviteActionLabel,
  isStartupInviteTargetType,
  StartupInviteModal,
  StartupInviteTarget,
} from "../../features/marketplace/StartupInviteModal";
import {
  MarketplaceDirectoryItem,
  MarketplaceEntityType,
  MarketplaceStartupItem,
  MarketplaceUserItem,
  marketplaceApi,
} from "../../api/marketplace.api";
import { recruiterApi } from "../../api/recruiter.api";
import { useAuthStore } from "../../store/authStore";
import type { RecruiterJobView } from "../../types/recruiter.types";
import { UserRole } from "../../types/roles.types";

type MarketplaceTab = {
  id: MarketplaceEntityType;
  label: string;
  filterLabel: string;
  description: string;
  icon: LucideIcon;
};

type OptionFilterKey =
  | "location"
  | "domain"
  | "skills"
  | "stage"
  | "category"
  | "launchTargets"
  | "specialties"
  | "organizationType"
  | "traction"
  | "signals";

type RangeFilterKey =
  | "experience"
  | "portfolio"
  | "jobs"
  | "students"
  | "iicRating"
  | "startups"
  | "score"
  | "funding"
  | "team";

type FacetOption = {
  value: string;
  count: number;
};

type CheckboxFilterSection = {
  kind: "checkbox";
  id: string;
  title: string;
  filterKey: OptionFilterKey;
  options: FacetOption[];
};

type RangeFilterSection = {
  kind: "range";
  id: string;
  title: string;
  filterKey: RangeFilterKey;
  max: number;
  step?: number;
  minLabel: string;
  maxLabel: string;
  formatSelected: (value: number) => string;
};

type FilterSection = CheckboxFilterSection | RangeFilterSection;

type MarketplaceRecruiterJob = RecruiterJobView & {
  recruiterName: string;
  recruiterAvatar?: string;
  recruiterHeadline?: string;
  recruiterLocation?: string;
};

const allTabs: MarketplaceTab[] = [
  {
    id: "student",
    label: "Students",
    filterLabel: "Talent",
    description:
      "Find student builders by domain, skills, project proof, and startup participation.",
    icon: Users,
  },
  {
    id: "school",
    label: "Schools",
    filterLabel: "Programs",
    description:
      "Discover schools with active innovation programs, mentoring activity, and local reach.",
    icon: GraduationCap,
  },
  {
    id: "college",
    label: "Colleges",
    filterLabel: "Campus",
    description:
      "Review colleges by hiring footprint, startup output, specialties, and regional presence.",
    icon: Building2,
  },
  {
    id: "mentor",
    label: "Mentors",
    filterLabel: "Guidance",
    description:
      "Browse mentors by domain depth, portfolio proof, and execution experience.",
    icon: Compass,
  },
  {
    id: "investor",
    label: "Investors",
    filterLabel: "Capital",
    description:
      "Sort investors by sector lens, location, activity, and public profile strength.",
    icon: Building2,
  },
  {
    id: "recruiter",
    label: "Recruiters",
    filterLabel: "Hiring",
    description:
      "Find recruiters with active hiring demand, stronger profile signal, and the right domain fit.",
    icon: BriefcaseBusiness,
  },
  {
    id: "startup",
    label: "Startups",
    filterLabel: "Launch",
    description:
      "Scan live startups by sector, stage, traction, founder presence, and funding need.",
    icon: Sparkles,
  },
];

const roleLaneIds: Partial<Record<UserRole, MarketplaceEntityType[]>> = {
  [UserRole.STUDENT]: ["recruiter", "student", "mentor", "investor", "startup"],
  [UserRole.SCHOOL]: ["student", "mentor", "investor", "startup"],
  [UserRole.COLLEGE]: ["investor", "recruiter"],
  [UserRole.MENTOR]: ["student", "college", "school"],
  [UserRole.INVESTOR]: ["startup", "college", "school", "student"],
};

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const formatCompactNumber = (value: number) =>
  new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

const formatRelativeDate = (value?: string) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const diff = Date.now() - parsed.getTime();
  const day = 1000 * 60 * 60 * 24;

  if (diff < day) {
    return "Posted today";
  }

  const days = Math.floor(diff / day);

  if (days < 7) {
    return `Posted ${days} day${days === 1 ? "" : "s"} ago`;
  }

  const weeks = Math.floor(days / 7);

  if (weeks < 5) {
    return `Posted ${weeks} week${weeks === 1 ? "" : "s"} ago`;
  }

  return `Posted ${parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  })}`;
};

const formatRoleLabel = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);
const getDashboardRole = (role?: UserRole) => role ?? UserRole.STUDENT;

const secondaryActionClassName =
  "inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-cyan-400/50 hover:bg-slate-800 hover:text-white";
const primaryActionClassName =
  "inline-flex items-center gap-2 rounded-full bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300";

const createDefaultOptionFilters = (): Record<OptionFilterKey, string[]> => ({
  location: [],
  domain: [],
  skills: [],
  stage: [],
  category: [],
  launchTargets: [],
  specialties: [],
  organizationType: [],
  traction: [],
  signals: [],
});

const createDefaultRangeFilters = (): Record<RangeFilterKey, number> => ({
  experience: 0,
  portfolio: 0,
  jobs: 0,
  students: 0,
  iicRating: 0,
  startups: 0,
  score: 0,
  funding: 0,
  team: 0,
});

const sortLabelMap: Record<string, string> = {
  recommended: "Recommended",
  signal: "Profile signal",
  name: "Name",
};

const getTabsForRole = (role: UserRole) => {
  const laneIds = roleLaneIds[role] ?? roleLaneIds[UserRole.STUDENT]!;
  return laneIds
    .map((id) => allTabs.find((tab) => tab.id === id))
    .filter((tab): tab is MarketplaceTab => Boolean(tab))
    .map((tab) =>
      role === UserRole.STUDENT
        ? tab.id === "recruiter"
          ? {
              ...tab,
              label: "Jobs",
              filterLabel: "Jobs",
              description:
                "See live job openings with recruiter context, role details, and direct apply actions.",
            }
          : tab.id === "student"
            ? {
                ...tab,
                label: "Teammates",
                filterLabel: "Teammates",
                description:
                  "Find startup teammates across research, product, founder, engineering, design, and growth roles.",
              }
            : tab
        : tab,
    );
};

const isStartupItem = (
  item?: MarketplaceDirectoryItem | null,
): item is MarketplaceStartupItem => item?.entityType === "startup";

const getUserItem = (item: MarketplaceDirectoryItem) =>
  isStartupItem(item) ? null : (item as MarketplaceUserItem);

const normalizeFacetValue = (value?: string | null) => value?.trim() ?? "";

const uniqueValues = (values: Array<string | undefined | null>) =>
  Array.from(
    new Set(values.map((value) => normalizeFacetValue(value)).filter(Boolean)),
  );

const buildFacetOptions = (
  items: MarketplaceDirectoryItem[],
  getValues: (item: MarketplaceDirectoryItem) => string[],
) => {
  const counts = new Map<string, number>();

  items.forEach((item) => {
    uniqueValues(getValues(item)).forEach((value) => {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    });
  });

  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort(
      (left, right) =>
        right.count - left.count || left.value.localeCompare(right.value),
    );
};

const buildFacetOptionsFromLists = (valuesByItem: string[][]) => {
  const counts = new Map<string, number>();

  valuesByItem.forEach((values) => {
    uniqueValues(values).forEach((value) => {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    });
  });

  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort(
      (left, right) =>
        right.count - left.count || left.value.localeCompare(right.value),
    );
};

const getRoundedRangeMax = (value: number) => {
  if (value <= 5) return Math.max(value, 5);
  if (value <= 25) return Math.ceil(value / 5) * 5;
  if (value <= 100) return Math.ceil(value / 10) * 10;
  if (value <= 1000) return Math.ceil(value / 50) * 50;
  if (value <= 10000) return Math.ceil(value / 500) * 500;
  if (value <= 100000) return Math.ceil(value / 5000) * 5000;
  return Math.ceil(value / 100000) * 100000;
};

const getRangeStep = (value: number) => {
  if (value <= 25) return 1;
  if (value <= 100) return 5;
  if (value <= 1000) return 25;
  if (value <= 100000) return 1000;
  return 50000;
};

const getSearchText = (item: MarketplaceDirectoryItem) => {
  if (isStartupItem(item)) {
    return [
      item.name,
      item.tagline,
      item.category,
      item.stage,
      item.founders.map((founder) => founder.displayName).join(" "),
      item.founders.map((founder) => founder.domain ?? "").join(" "),
      item.founders.map((founder) => founder.location ?? "").join(" "),
      item.launchTargets.join(" "),
      item.project?.title ?? "",
      item.project?.category ?? "",
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
    item.institutionProfile?.organizationType ?? "",
    item.institutionProfile?.location ?? "",
    item.institutionProfile?.specialties?.join(" ") ?? "",
    item.institutionProfile?.locations?.join(" ") ?? "",
    item.institutionProfile?.stats?.topHiringSector ?? "",
  ]
    .join(" ")
    .toLowerCase();
};

const getTitle = (item: MarketplaceDirectoryItem) =>
  isStartupItem(item) ? item.name : item.displayName;

const getSubtitle = (item: MarketplaceDirectoryItem) =>
  isStartupItem(item)
    ? `${item.category} • ${item.stage}`
    : `${formatRoleLabel(item.entityType)}${item.headline ? ` • ${item.headline}` : ""}`;

const getDescription = (item: MarketplaceDirectoryItem) =>
  isStartupItem(item)
    ? item.tagline
    : (item.bio ??
      "Public profile details will appear here as more marketplace members complete their profiles.");

const getDetailChips = (item: MarketplaceDirectoryItem) =>
  isStartupItem(item)
    ? [
        item.category,
        item.stage,
        ...item.launchTargets,
        item.project?.title ?? "",
        ...item.founders.map((founder) => founder.displayName),
      ]
    : item.entityType === "school" || item.entityType === "college"
      ? [
          item.domain ?? "",
          item.institutionProfile?.location ?? item.location ?? "",
          ...(item.institutionProfile?.specialties ?? []).slice(0, 3),
        ]
      : [
          item.domain ?? "",
          item.location ?? "",
          ...(item.skills ?? []).slice(0, 4).map((skill) => skill.name),
        ];

const buildStatList = (item: MarketplaceDirectoryItem) => {
  if (isStartupItem(item)) {
    return [
      { label: "Score", value: String(item.innovationScoreAtLaunch) },
      { label: "Team", value: String(item.teamSize) },
      { label: "Products", value: String(item.activeProducts) },
      {
        label: "Funding",
        value:
          typeof item.fundingNeeded === "number"
            ? currency.format(item.fundingNeeded)
            : "Undisclosed",
      },
    ];
  }

  const userItem = item as MarketplaceUserItem;
  if (userItem.entityType === "school" || userItem.entityType === "college") {
    return [
      {
        label: "Students",
        value: formatCompactNumber(
          userItem.institutionProfile?.totalStudentsEnrolled ?? 0,
        ),
      },
      {
        label: "Alumni",
        value: formatCompactNumber(
          userItem.institutionProfile?.alumniCount ?? 0,
        ),
      },
      {
        label: "Startups",
        value: String(
          userItem.institutionProfile?.stats?.startupsLaunched ?? 0,
        ),
      },
      {
        label: "Collaborations",
        value: String(
          userItem.institutionProfile?.stats?.industryCollaborations ?? 0,
        ),
      },
    ];
  }

  if (userItem.entityType === "recruiter") {
    return [
      { label: "Open Jobs", value: String(userItem.relatedCounts.jobs) },
      {
        label: "Startup Links",
        value: String(userItem.relatedCounts.startups),
      },
      { label: "Experience", value: String(userItem.insightCounts.experience) },
      { label: "Education", value: String(userItem.insightCounts.education) },
    ];
  }

  if (userItem.entityType === "mentor") {
    return [
      { label: "Experience", value: String(userItem.insightCounts.experience) },
      { label: "Education", value: String(userItem.insightCounts.education) },
      {
        label: "Projects",
        value: String(userItem.insightCounts.portfolioProjects),
      },
      {
        label: "Startup Links",
        value: String(userItem.relatedCounts.startups),
      },
    ];
  }

  if (userItem.entityType === "investor") {
    return [
      { label: "Portfolio", value: String(userItem.relatedCounts.startups) },
      { label: "Skills", value: String(userItem.insightCounts.skills) },
      { label: "Education", value: String(userItem.insightCounts.education) },
      {
        label: "Repos",
        value: String(userItem.githubStats?.totalRepos ?? 0),
      },
    ];
  }

  return [
    { label: "Skills", value: String(userItem.insightCounts.skills) },
    { label: "Experience", value: String(userItem.insightCounts.experience) },
    {
      label: "Projects",
      value: String(userItem.insightCounts.portfolioProjects),
    },
    {
      label: "Startups",
      value: String(userItem.relatedCounts.startups),
    },
  ];
};

const buildMetaList = (item: MarketplaceDirectoryItem) => {
  if (isStartupItem(item)) {
    return [
      ...item.launchTargets.slice(0, 1),
      `${item.innovationScoreAtLaunch} score`,
      `${item.teamSize} team`,
      `${item.activeProducts} products`,
    ].filter(Boolean);
  }

  const userItem = item as MarketplaceUserItem;

  switch (userItem.entityType) {
    case "recruiter":
      return [
        userItem.domain ?? "",
        `${userItem.relatedCounts.jobs} open jobs`,
        `${userItem.relatedCounts.startups} startup links`,
      ].filter(Boolean);
    case "investor":
      return [
        userItem.domain ?? "",
        `${userItem.relatedCounts.startups} portfolio startups`,
      ].filter(Boolean);
    case "mentor":
      return [
        userItem.domain ?? "",
        `${userItem.relatedCounts.startups} startup links`,
        `${userItem.insightCounts.experience} experience`,
      ].filter(Boolean);
    case "student":
      return [
        userItem.domain ?? "",
        `${userItem.insightCounts.portfolioProjects} projects`,
        `${userItem.insightCounts.experience} experience`,
      ].filter(Boolean);
    default:
      return [];
  }
};

const getItemLocations = (item: MarketplaceDirectoryItem) => {
  if (isStartupItem(item)) {
    return uniqueValues(item.founders.map((founder) => founder.location));
  }

  const userItem = item as MarketplaceUserItem;
  if (userItem.entityType === "school" || userItem.entityType === "college") {
    return uniqueValues([
      userItem.institutionProfile?.location,
      ...(userItem.institutionProfile?.locations ?? []),
    ]);
  }

  return uniqueValues([userItem.location]);
};

const getItemDomains = (item: MarketplaceDirectoryItem) => {
  if (isStartupItem(item)) {
    return uniqueValues([item.category, item.project?.category]);
  }

  const userItem = item as MarketplaceUserItem;
  if (userItem.entityType === "school" || userItem.entityType === "college") {
    return uniqueValues([
      userItem.domain,
      userItem.institutionProfile?.stats?.topHiringSector,
    ]);
  }

  return uniqueValues([userItem.domain]);
};

const getItemSkills = (item: MarketplaceDirectoryItem) => {
  const userItem = getUserItem(item);
  if (
    !userItem ||
    userItem.entityType === "school" ||
    userItem.entityType === "college"
  ) {
    return [];
  }

  return uniqueValues((userItem.skills ?? []).map((skill) => skill.name));
};

const getInstitutionSpecialties = (item: MarketplaceDirectoryItem) => {
  const userItem = getUserItem(item);
  if (
    !userItem ||
    (userItem.entityType !== "school" && userItem.entityType !== "college")
  ) {
    return [];
  }

  return uniqueValues(userItem.institutionProfile?.specialties ?? []);
};

const getInstitutionOrganizationType = (item: MarketplaceDirectoryItem) => {
  const userItem = getUserItem(item);
  if (
    !userItem ||
    (userItem.entityType !== "school" && userItem.entityType !== "college")
  ) {
    return [];
  }

  return uniqueValues([userItem.institutionProfile?.organizationType]);
};

const getStartupTractionTags = (item: MarketplaceDirectoryItem) => {
  if (!isStartupItem(item)) {
    return [];
  }

  return uniqueValues([
    item.traction.mvpBuilt ? "MVP Built" : "",
    item.traction.revenueGenerating ? "Revenue Generating" : "",
    item.traction.patentFiled ? "Patent Filed" : "",
    item.pitchDeckUrl ? "Pitch Deck Ready" : "",
  ]);
};

const getItemSignals = (item: MarketplaceDirectoryItem) => {
  if (isStartupItem(item)) {
    return [];
  }

  const userItem = item as MarketplaceUserItem;
  if (userItem.entityType === "school" || userItem.entityType === "college") {
    return uniqueValues([
      (userItem.institutionProfile?.iicStarRating ?? 0) >= 4
        ? "IIC 4+ Rated"
        : "",
      (userItem.institutionProfile?.stats?.startupsLaunched ?? 0) > 0
        ? "Startup Active"
        : "",
      (userItem.institutionProfile?.stats?.industryCollaborations ?? 0) > 0
        ? "Industry Linked"
        : "",
    ]);
  }

  return uniqueValues([
    userItem.insightCounts.portfolioProjects > 0 ? "Portfolio Ready" : "",
    userItem.entityType !== "investor" && userItem.insightCounts.experience > 0
      ? "Experience Listed"
      : "",
    userItem.relatedCounts.startups > 0 ? "Startup Linked" : "",
    (userItem.githubStats?.totalRepos ?? 0) > 0 ? "GitHub Proof" : "",
    userItem.entityType === "recruiter" && userItem.relatedCounts.jobs > 0
      ? "Hiring Now"
      : "",
  ]);
};

const getUserExperienceCount = (item: MarketplaceDirectoryItem) => {
  const userItem = getUserItem(item);
  if (
    !userItem ||
    userItem.entityType === "investor" ||
    userItem.entityType === "school" ||
    userItem.entityType === "college"
  ) {
    return 0;
  }

  return userItem.insightCounts.experience;
};

const getUserPortfolioCount = (item: MarketplaceDirectoryItem) => {
  const userItem = getUserItem(item);
  if (
    !userItem ||
    userItem.entityType === "school" ||
    userItem.entityType === "college"
  ) {
    return 0;
  }

  return userItem.insightCounts.portfolioProjects;
};

const getRecruiterOpenJobCount = (item: MarketplaceDirectoryItem) => {
  const userItem = getUserItem(item);
  if (!userItem || userItem.entityType !== "recruiter") {
    return 0;
  }

  return userItem.relatedCounts.jobs;
};

const getInstitutionStudentCount = (item: MarketplaceDirectoryItem) => {
  const userItem = getUserItem(item);
  if (
    !userItem ||
    (userItem.entityType !== "school" && userItem.entityType !== "college")
  ) {
    return 0;
  }

  return userItem.institutionProfile?.totalStudentsEnrolled ?? 0;
};

const getInstitutionStartupCount = (item: MarketplaceDirectoryItem) => {
  const userItem = getUserItem(item);
  if (
    !userItem ||
    (userItem.entityType !== "school" && userItem.entityType !== "college")
  ) {
    return 0;
  }

  return userItem.institutionProfile?.stats?.startupsLaunched ?? 0;
};

const getInstitutionIicRating = (item: MarketplaceDirectoryItem) => {
  const userItem = getUserItem(item);
  if (
    !userItem ||
    (userItem.entityType !== "school" && userItem.entityType !== "college")
  ) {
    return 0;
  }

  return userItem.institutionProfile?.iicStarRating ?? 0;
};

const getStartupScore = (item: MarketplaceDirectoryItem) =>
  isStartupItem(item) ? item.innovationScoreAtLaunch : 0;
const getStartupFunding = (item: MarketplaceDirectoryItem) =>
  isStartupItem(item) ? (item.fundingNeeded ?? 0) : 0;
const getStartupTeamSize = (item: MarketplaceDirectoryItem) =>
  isStartupItem(item) ? item.teamSize : 0;

const matchesSelectedOptions = (selected: string[], values: string[]) =>
  selected.length === 0 || selected.some((value) => values.includes(value));

const getMarketplaceRecruiterJobSearchText = (job: MarketplaceRecruiterJob) =>
  [
    job.title,
    job.company,
    job.description,
    job.domain,
    job.location,
    job.type,
    job.workMode,
    job.recruiterName,
    job.recruiterHeadline,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const getMarketplaceRecruiterJobSignals = (job: MarketplaceRecruiterJob) =>
  uniqueValues([
    job.workMode,
    job.isActive ? "Actively hiring" : "Closed",
    job.hasApplied ? "Applied" : "",
  ]);

const getApplicationButtonLabel = (
  job: Pick<RecruiterJobView, "hasApplied" | "applicationSource">,
) => {
  if (!job.hasApplied) {
    return "Apply now";
  }

  return job.applicationSource === "recruiter_invite" ? "Invited" : "Applied";
};

function MarketplaceRecruiterJobFeedCard({
  dashboardRole,
  job,
}: {
  dashboardRole: UserRole;
  job: MarketplaceRecruiterJob;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [hasApplied, setHasApplied] = useState(Boolean(job.hasApplied));
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const postedLabel = formatRelativeDate(job.createdAt);
  const isApplyLocked = hasApplied || !job.isActive;

  useEffect(() => {
    if (job.hasApplied) {
      setHasApplied(true);
    }
  }, [job.hasApplied]);

  const markJobAsApplied = () => {
    const applicationUpdatedAt = new Date().toISOString();

    const applyPatch = <T extends RecruiterJobView>(current: T): T => ({
      ...current,
      hasApplied: true,
      applicationStage: current.applicationStage ?? "Applied",
      applicationSource: current.applicationSource ?? "student_apply",
      applicationUpdatedAt,
    });

    setHasApplied(true);

    queryClient.setQueriesData<MarketplaceRecruiterJob[]>(
      { queryKey: ["marketplace", "student-recruiter-jobs"] },
      (current) =>
        current?.map((currentJob) =>
          currentJob._id === job._id ? applyPatch(currentJob) : currentJob,
        ) ?? current,
    );

    queryClient.setQueryData<RecruiterJobView>(
      ["marketplace", "job-detail", job._id],
      (current) => (current ? applyPatch(current) : current),
    );

    queryClient.setQueriesData<RecruiterJobView[]>(
      { queryKey: ["marketplace", "job-detail", "related"] },
      (current) =>
        Array.isArray(current)
          ? current.map((currentJob) =>
              currentJob._id === job._id ? applyPatch(currentJob) : currentJob,
            )
          : current,
    );

    void queryClient.invalidateQueries({
      queryKey: ["student", "applications"],
    });
  };

  const handleApply = async () => {
    if (hasApplied || isApplying || !job.isActive) {
      return;
    }

    setIsApplying(true);
    setApplyError(null);

    try {
      const response = await recruiterApi.applyToJob(job._id);

      if (response.applied || response.alreadyApplied) {
        markJobAsApplied();
      }
    } catch {
      setApplyError("Unable to apply to this job right now.");
    } finally {
      setIsApplying(false);
    }
  };

  const handleMessage = () => {
    const storageKey = `dm_first_contact_${job.recruiterId}`;
    if (!localStorage.getItem(storageKey)) {
      localStorage.setItem(storageKey, "true");
    }
    navigate(`/dashboard/messages/${job.recruiterId}`);
  };

  return (
    <article className="border-b border-slate-800 py-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.22em] text-cyan-300">
            <span>{job.type}</span>
            <span className="text-slate-600">|</span>
            <span>{job.domain}</span>
            {job.workMode ? (
              <>
                <span className="text-slate-600">|</span>
                <span>{job.workMode}</span>
              </>
            ) : null}
            {postedLabel ? (
              <>
                <span className="text-slate-600">|</span>
                <span>{postedLabel}</span>
              </>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => navigate(`/marketplace/jobs/${job._id}`)}
            className="mt-3 text-left text-2xl font-semibold tracking-tight text-white transition hover:text-cyan-200"
          >
            {job.title}
          </button>

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-slate-400">
            <span className="font-medium text-slate-200">{job.company}</span>
            <span className="text-slate-600">|</span>
            <span>{job.recruiterName}</span>
            <span className="text-slate-600">|</span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-cyan-600" />
              {job.location}
            </span>
          </div>

          <p className="mt-5 max-w-3xl text-sm leading-6 text-slate-300">
            {job.roleSummary ?? job.description}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-300">
              Min score {job.minimumInnovationScore}+
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-300">
              {job.applicantCount} applicants
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-300">
              {job.shortlistedCount} shortlisted
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-300">
              {job.isActive ? "Actively hiring" : "Closed"}
            </span>
          </div>

          {applyError ? (
            <div className="mt-4 text-sm text-rose-300">{applyError}</div>
          ) : null}
        </div>

        <div className="w-full max-w-[320px] shrink-0 pt-2">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[18px] bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_100%)] text-lg font-semibold text-white">
              {job.recruiterAvatar ? (
                <img
                  src={job.recruiterAvatar}
                  alt={job.recruiterName}
                  className="h-14 w-14 object-cover"
                />
              ) : (
                job.recruiterName.slice(0, 1).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">
                {job.recruiterName}
              </div>
              <div className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-500">
                Hiring recruiter
              </div>
              {job.recruiterHeadline ? (
                <div className="mt-1 line-clamp-2 text-sm text-slate-400">
                  {job.recruiterHeadline}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleApply}
              disabled={isApplyLocked || isApplying}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                hasApplied
                  ? "cursor-not-allowed border border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                  : "bg-cyan-400 text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
              }`}
            >
              {hasApplied ? <Lock className="h-4 w-4" /> : null}
              {isApplying
                ? "Applying..."
                : getApplicationButtonLabel({
                    hasApplied,
                    applicationSource: job.applicationSource,
                  })}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/marketplace/jobs/${job._id}`)}
              className={secondaryActionClassName}
            >
              View job
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                navigate(
                  getMarketplaceDetailPath(
                    dashboardRole,
                    "recruiter",
                    job.recruiterId,
                  ),
                )
              }
              className={secondaryActionClassName}
            >
              Recruiter
            </button>
            <button
              type="button"
              onClick={handleMessage}
              className={secondaryActionClassName}
            >
              <MessageCircle className="h-4 w-4" />
              Message
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function FilterCheckboxGroup({
  title,
  options,
  selectedValues,
  onToggle,
}: {
  title: string;
  options: FacetOption[];
  selectedValues: string[];
  onToggle: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const visibleOptions = showAll ? options : options.slice(0, 4);

  return (
    <section className="border-t border-slate-800 pt-5 first:border-t-0 first:pt-0">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="text-[1.05rem] font-semibold text-white">{title}</span>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-slate-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-500" />
        )}
      </button>

      {isOpen ? (
        <div className="mt-4 space-y-3">
          {visibleOptions.length ? (
            visibleOptions.map((option) => {
              const checked = selectedValues.includes(option.value);

              return (
                <label
                  key={`${title}-${option.value}`}
                  className="flex cursor-pointer items-start gap-3 text-sm text-slate-300"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(option.value)}
                    className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-950 text-cyan-400 focus:ring-cyan-500"
                  />
                  <span className="flex min-w-0 flex-1 justify-between gap-3">
                    <span className="truncate">{option.value}</span>
                    <span className="shrink-0 text-slate-500">
                      ({option.count})
                    </span>
                  </span>
                </label>
              );
            })
          ) : (
            <div className="text-sm text-slate-500">No filter data yet.</div>
          )}

          {options.length > 4 ? (
            <button
              type="button"
              onClick={() => setShowAll((current) => !current)}
              className="text-sm font-semibold text-cyan-300 transition hover:text-cyan-200"
            >
              {showAll ? "View Less" : "View More"}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function FilterRangeGroup({
  title,
  value,
  max,
  step = 1,
  minLabel,
  maxLabel,
  formatSelected,
  onChange,
}: {
  title: string;
  value: number;
  max: number;
  step?: number;
  minLabel: string;
  maxLabel: string;
  formatSelected: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <section className="border-t border-slate-800 pt-5 first:border-t-0 first:pt-0">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="text-[1.05rem] font-semibold text-white">{title}</span>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-slate-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-500" />
        )}
      </button>

      {isOpen ? (
        <div className="mt-5">
          <div className="mb-4 flex justify-end">
            <span className="rounded-full bg-cyan-400 px-3 py-1 text-xs font-semibold text-slate-950">
              {value > 0 ? formatSelected(value) : "Any"}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(max, 1)}
            step={step}
            value={Math.min(value, Math.max(max, 1))}
            onChange={(event) => onChange(Number(event.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-cyan-400"
          />
          <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
            <span>{minLabel}</span>
            <span>{maxLabel}</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}

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
  const authUser = useAuthStore((state) => state.user);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [optionFilters, setOptionFilters] = useState<
    Record<OptionFilterKey, string[]>
  >(createDefaultOptionFilters);
  const [rangeFilters, setRangeFilters] = useState<
    Record<RangeFilterKey, number>
  >(createDefaultRangeFilters);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [inviteTarget, setInviteTarget] = useState<StartupInviteTarget | null>(
    null,
  );
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);
  const availableTabs = useMemo(
    () => getTabsForRole(dashboardRole),
    [dashboardRole],
  );
  const requestedEntityType = searchParams.get(
    "role",
  ) as MarketplaceEntityType | null;
  const fallbackEntityType = availableTabs[0]?.id ?? "student";
  const entityType = availableTabs.some((tab) => tab.id === requestedEntityType)
    ? requestedEntityType!
    : fallbackEntityType;
  const query = searchParams.get("q") ?? "";
  const sort = searchParams.get("sort") ?? "recommended";
  const deferredQuery = useDeferredValue(query);
  const activeTab =
    availableTabs.find((tab) => tab.id === entityType) ?? availableTabs[0]!;
  const isStudentRecruiterJobView =
    dashboardRole === UserRole.STUDENT && entityType === "recruiter";

  useEffect(() => {
    setOptionFilters(createDefaultOptionFilters());
    setRangeFilters(createDefaultRangeFilters());
    setShowMoreFilters(false);
  }, [entityType]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!sortMenuRef.current?.contains(event.target as Node)) {
        setIsSortMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const updateSearchParams = (next: {
    role?: MarketplaceEntityType;
    q?: string;
    sort?: string;
  }) => {
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
        domain: isStudentRecruiterJobView
          ? undefined
          : deferredQuery || undefined,
        limit: entityType === "startup" ? 48 : 36,
      }),
  });

  const sourceItems = useMemo(
    () =>
      listQuery.data?.filter((item): item is MarketplaceDirectoryItem => {
        if (!item) {
          return false;
        }

        if (
          dashboardRole === UserRole.STUDENT &&
          item.entityType === "student" &&
          authUser?._id &&
          item._id === authUser._id
        ) {
          return false;
        }

        return true;
      }) ?? [],
    [authUser?._id, dashboardRole, listQuery.data],
  );

  const recruiterProfiles = useMemo(
    () =>
      isStudentRecruiterJobView
        ? sourceItems.filter(
            (item): item is MarketplaceUserItem =>
              item.entityType === "recruiter",
          )
        : [],
    [isStudentRecruiterJobView, sourceItems],
  );

  const recruiterJobsQuery = useQuery({
    queryKey: [
      "marketplace",
      "student-recruiter-jobs",
      recruiterProfiles.map((profile) => profile._id).join(","),
    ],
    queryFn: async () => {
      const recruiterJobs = await Promise.all(
        recruiterProfiles.map(async (profile) => {
          const jobs = await recruiterApi.getPublicJobs(profile._id);

          return jobs.map(
            (job): MarketplaceRecruiterJob => ({
              ...job,
              recruiterName: profile.displayName,
              ...(profile.avatar ? { recruiterAvatar: profile.avatar } : {}),
              ...(profile.headline
                ? { recruiterHeadline: profile.headline }
                : {}),
              ...(profile.location
                ? { recruiterLocation: profile.location }
                : {}),
            }),
          );
        }),
      );

      return recruiterJobs.flat();
    },
    enabled: isStudentRecruiterJobView && recruiterProfiles.length > 0,
  });

  const recruiterJobItems = useMemo(() => {
    if (!isStudentRecruiterJobView) {
      return [];
    }

    const filteredByQuery = deferredQuery
      ? (recruiterJobsQuery.data ?? []).filter((job) =>
          getMarketplaceRecruiterJobSearchText(job).includes(
            deferredQuery.toLowerCase(),
          ),
        )
      : (recruiterJobsQuery.data ?? []);

    const filteredByControls = filteredByQuery.filter((job) => {
      if (
        optionFilters.location.length &&
        !matchesSelectedOptions(optionFilters.location, [job.location])
      ) {
        return false;
      }

      if (
        optionFilters.domain.length &&
        !matchesSelectedOptions(optionFilters.domain, [job.domain])
      ) {
        return false;
      }

      if (
        optionFilters.signals.length &&
        !matchesSelectedOptions(
          optionFilters.signals,
          getMarketplaceRecruiterJobSignals(job),
        )
      ) {
        return false;
      }

      if (
        rangeFilters.score > 0 &&
        job.minimumInnovationScore < rangeFilters.score
      ) {
        return false;
      }

      return true;
    });

    const sortedJobs = [...filteredByControls];

    if (sort === "name") {
      sortedJobs.sort(
        (left, right) =>
          left.title.localeCompare(right.title) ||
          left.recruiterName.localeCompare(right.recruiterName),
      );
    } else if (sort === "signal") {
      sortedJobs.sort(
        (left, right) =>
          right.minimumInnovationScore - left.minimumInnovationScore ||
          right.shortlistedCount - left.shortlistedCount ||
          right.applicantCount - left.applicantCount,
      );
    } else {
      sortedJobs.sort((left, right) => {
        if (left.isActive !== right.isActive) {
          return Number(right.isActive) - Number(left.isActive);
        }

        if (Boolean(left.hasApplied) !== Boolean(right.hasApplied)) {
          return (
            Number(Boolean(left.hasApplied)) - Number(Boolean(right.hasApplied))
          );
        }

        return (
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime()
        );
      });
    }

    return sortedJobs;
  }, [
    deferredQuery,
    isStudentRecruiterJobView,
    optionFilters.domain,
    optionFilters.location,
    optionFilters.signals,
    rangeFilters.score,
    recruiterJobsQuery.data,
    sort,
  ]);

  const filterSections = useMemo(() => {
    if (isStudentRecruiterJobView) {
      const recruiterJobsSource = recruiterJobsQuery.data ?? [];
      const scoreMax = getRoundedRangeMax(
        recruiterJobsSource.reduce(
          (largest, job) => Math.max(largest, job.minimumInnovationScore),
          0,
        ),
      );

      return {
        primary: [
          {
            kind: "checkbox",
            id: "location",
            title: "Location",
            filterKey: "location",
            options: buildFacetOptionsFromLists(
              recruiterJobsSource.map((job) => [job.location]),
            ),
          },
          {
            kind: "checkbox",
            id: "domain",
            title: "Department",
            filterKey: "domain",
            options: buildFacetOptionsFromLists(
              recruiterJobsSource.map((job) => [job.domain]),
            ),
          },
        ] as FilterSection[],
        advanced: [
          {
            kind: "checkbox",
            id: "signals",
            title: "Work mode / status",
            filterKey: "signals",
            options: buildFacetOptionsFromLists(
              recruiterJobsSource.map((job) =>
                getMarketplaceRecruiterJobSignals(job),
              ),
            ),
          },
          ...(scoreMax > 0
            ? [
                {
                  kind: "range" as const,
                  id: "score",
                  title: "Minimum innovation score",
                  filterKey: "score" as const,
                  max: scoreMax,
                  step: getRangeStep(scoreMax),
                  minLabel: "0",
                  maxLabel: "Any",
                  formatSelected: (value: number) => `${value}+`,
                },
              ]
            : []),
        ] as FilterSection[],
      };
    }

    const maxValue = (selector: (item: MarketplaceDirectoryItem) => number) =>
      getRoundedRangeMax(
        sourceItems.reduce(
          (largest, item) => Math.max(largest, selector(item)),
          0,
        ),
      );

    const sections = {
      primary: [] as FilterSection[],
      advanced: [] as FilterSection[],
    };

    if (entityType === "startup") {
      return sections;
    }

    if (entityType === "school" || entityType === "college") {
      const studentMax = maxValue(getInstitutionStudentCount);
      const startupMax = maxValue(getInstitutionStartupCount);
      const iicMax = maxValue(getInstitutionIicRating);

      sections.primary.push(
        {
          kind: "checkbox",
          id: "location",
          title: "Location",
          filterKey: "location",
          options: buildFacetOptions(sourceItems, getItemLocations),
        },
        {
          kind: "checkbox",
          id: "specialties",
          title: "Focus area",
          filterKey: "specialties",
          options: buildFacetOptions(sourceItems, getInstitutionSpecialties),
        },
      );

      if (studentMax > 0) {
        sections.primary.push({
          kind: "range",
          id: "students",
          title: "Student count",
          filterKey: "students",
          max: studentMax,
          step: getRangeStep(studentMax),
          minLabel: "0",
          maxLabel: "Any",
          formatSelected: (value) => `${formatCompactNumber(value)}+`,
        });
      }

      sections.advanced.push(
        {
          kind: "checkbox",
          id: "organizationType",
          title: "Institution type",
          filterKey: "organizationType",
          options: buildFacetOptions(
            sourceItems,
            getInstitutionOrganizationType,
          ),
        },
        {
          kind: "checkbox",
          id: "signals",
          title: "More filters",
          filterKey: "signals",
          options: buildFacetOptions(sourceItems, getItemSignals),
        },
      );

      if (startupMax > 0) {
        sections.advanced.push({
          kind: "range",
          id: "startups",
          title: "Startup output",
          filterKey: "startups",
          max: startupMax,
          step: getRangeStep(startupMax),
          minLabel: "0",
          maxLabel: "Any",
          formatSelected: (value) => `${value}+`,
        });
      }

      if (iicMax > 0) {
        sections.advanced.push({
          kind: "range",
          id: "iicRating",
          title: "IIC rating",
          filterKey: "iicRating",
          max: iicMax,
          step: 1,
          minLabel: "0",
          maxLabel: "Any",
          formatSelected: (value) => `${value}+ stars`,
        });
      }

      return sections;
    }

    const experienceMax = maxValue(getUserExperienceCount);
    const portfolioMax = maxValue(getUserPortfolioCount);
    const openJobsMax = maxValue(getRecruiterOpenJobCount);

    sections.primary.push(
      {
        kind: "checkbox",
        id: "location",
        title: "Location",
        filterKey: "location",
        options: buildFacetOptions(sourceItems, getItemLocations),
      },
      {
        kind: "checkbox",
        id: "domain",
        title: entityType === "recruiter" ? "Department" : "Domain",
        filterKey: "domain",
        options: buildFacetOptions(sourceItems, getItemDomains),
      },
    );

    if (entityType !== "investor" && experienceMax > 0) {
      sections.primary.push({
        kind: "range",
        id: "experience",
        title: "Experience",
        filterKey: "experience",
        max: experienceMax,
        step: 1,
        minLabel: "0",
        maxLabel: "Any",
        formatSelected: (value) => `${value}+ items`,
      });
    }

    sections.advanced.push(
      {
        kind: "checkbox",
        id: "skills",
        title: "Skills",
        filterKey: "skills",
        options: buildFacetOptions(sourceItems, getItemSkills),
      },
      {
        kind: "checkbox",
        id: "signals",
        title: "More filters",
        filterKey: "signals",
        options: buildFacetOptions(sourceItems, getItemSignals),
      },
    );

    if (portfolioMax > 0) {
      sections.advanced.push({
        kind: "range",
        id: "portfolio",
        title: "Portfolio projects",
        filterKey: "portfolio",
        max: portfolioMax,
        step: 1,
        minLabel: "0",
        maxLabel: "Any",
        formatSelected: (value) => `${value}+`,
      });
    }

    if (entityType === "recruiter" && openJobsMax > 0) {
      sections.advanced.push({
        kind: "range",
        id: "jobs",
        title: "Open jobs",
        filterKey: "jobs",
        max: openJobsMax,
        step: 1,
        minLabel: "0",
        maxLabel: "Any",
        formatSelected: (value) => `${value}+`,
      });
    }

    return sections;
  }, [entityType, isStudentRecruiterJobView, recruiterJobItems, sourceItems]);

  const toggleOptionFilter = (key: OptionFilterKey, value: string) => {
    setOptionFilters((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter((item) => item !== value)
        : [...current[key], value],
    }));
  };

  const clearAllFilters = () => {
    setOptionFilters(createDefaultOptionFilters());
    setRangeFilters(createDefaultRangeFilters());
    setShowMoreFilters(false);
  };

  const items = useMemo(() => {
    const filteredByQuery = deferredQuery
      ? sourceItems.filter((item) =>
          getSearchText(item).includes(deferredQuery.toLowerCase()),
        )
      : sourceItems;

    const filteredByControls = filteredByQuery.filter((item) => {
      if (
        optionFilters.location.length &&
        !matchesSelectedOptions(optionFilters.location, getItemLocations(item))
      ) {
        return false;
      }

      if (
        optionFilters.domain.length &&
        !matchesSelectedOptions(optionFilters.domain, getItemDomains(item))
      ) {
        return false;
      }

      if (entityType === "startup") {
        if (!isStartupItem(item)) {
          return false;
        }

        if (
          optionFilters.stage.length &&
          !matchesSelectedOptions(optionFilters.stage, [item.stage])
        ) {
          return false;
        }

        if (
          optionFilters.category.length &&
          !matchesSelectedOptions(optionFilters.category, [item.category])
        ) {
          return false;
        }

        if (
          optionFilters.launchTargets.length &&
          !matchesSelectedOptions(
            optionFilters.launchTargets,
            item.launchTargets,
          )
        ) {
          return false;
        }

        if (
          optionFilters.traction.length &&
          !matchesSelectedOptions(
            optionFilters.traction,
            getStartupTractionTags(item),
          )
        ) {
          return false;
        }

        if (
          rangeFilters.score > 0 &&
          item.innovationScoreAtLaunch < rangeFilters.score
        ) {
          return false;
        }

        if (
          rangeFilters.funding > 0 &&
          (item.fundingNeeded ?? 0) < rangeFilters.funding
        ) {
          return false;
        }

        if (rangeFilters.team > 0 && item.teamSize < rangeFilters.team) {
          return false;
        }

        return true;
      }

      const userItem = item as MarketplaceUserItem;

      if (entityType === "school" || entityType === "college") {
        if (
          optionFilters.specialties.length &&
          !matchesSelectedOptions(
            optionFilters.specialties,
            getInstitutionSpecialties(userItem),
          )
        ) {
          return false;
        }

        if (
          optionFilters.organizationType.length &&
          !matchesSelectedOptions(
            optionFilters.organizationType,
            getInstitutionOrganizationType(userItem),
          )
        ) {
          return false;
        }

        if (
          optionFilters.signals.length &&
          !matchesSelectedOptions(
            optionFilters.signals,
            getItemSignals(userItem),
          )
        ) {
          return false;
        }

        if (
          rangeFilters.students > 0 &&
          getInstitutionStudentCount(userItem) < rangeFilters.students
        ) {
          return false;
        }

        if (
          rangeFilters.startups > 0 &&
          getInstitutionStartupCount(userItem) < rangeFilters.startups
        ) {
          return false;
        }

        if (
          rangeFilters.iicRating > 0 &&
          getInstitutionIicRating(userItem) < rangeFilters.iicRating
        ) {
          return false;
        }

        return true;
      }

      if (
        optionFilters.skills.length &&
        !matchesSelectedOptions(optionFilters.skills, getItemSkills(userItem))
      ) {
        return false;
      }

      if (
        optionFilters.signals.length &&
        !matchesSelectedOptions(optionFilters.signals, getItemSignals(userItem))
      ) {
        return false;
      }

      if (
        entityType !== "investor" &&
        rangeFilters.experience > 0 &&
        getUserExperienceCount(userItem) < rangeFilters.experience
      ) {
        return false;
      }

      if (
        rangeFilters.portfolio > 0 &&
        getUserPortfolioCount(userItem) < rangeFilters.portfolio
      ) {
        return false;
      }

      if (
        entityType === "recruiter" &&
        rangeFilters.jobs > 0 &&
        getRecruiterOpenJobCount(userItem) < rangeFilters.jobs
      ) {
        return false;
      }

      return true;
    });

    const sorted = [...filteredByControls];

    if (sort === "name") {
      sorted.sort((left, right) =>
        getTitle(left).localeCompare(getTitle(right)),
      );
    }

    if (sort === "signal") {
      sorted.sort((left, right) => {
        const leftSignal = isStartupItem(left)
          ? left.innovationScoreAtLaunch
          : (left as MarketplaceUserItem).entityType === "school" ||
              (left as MarketplaceUserItem).entityType === "college"
            ? ((left as MarketplaceUserItem).institutionProfile?.stats
                ?.startupsLaunched ?? 0)
            : (left as MarketplaceUserItem).insightCounts.portfolioProjects;
        const rightSignal = isStartupItem(right)
          ? right.innovationScoreAtLaunch
          : (right as MarketplaceUserItem).entityType === "school" ||
              (right as MarketplaceUserItem).entityType === "college"
            ? ((right as MarketplaceUserItem).institutionProfile?.stats
                ?.startupsLaunched ?? 0)
            : (right as MarketplaceUserItem).insightCounts.portfolioProjects;
        return rightSignal - leftSignal;
      });
    }

    return sorted;
  }, [
    deferredQuery,
    entityType,
    optionFilters,
    rangeFilters,
    sort,
    sourceItems,
  ]);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> =
      [];

    (
      Object.entries(optionFilters) as Array<[OptionFilterKey, string[]]>
    ).forEach(([key, values]) => {
      values.forEach((value) => {
        chips.push({
          key: `${key}:${value}`,
          label: value,
          onRemove: () => toggleOptionFilter(key, value),
        });
      });
    });

    [...filterSections.primary, ...filterSections.advanced]
      .filter(
        (section): section is RangeFilterSection => section.kind === "range",
      )
      .forEach((section) => {
        const value = rangeFilters[section.filterKey];
        if (value > 0) {
          chips.push({
            key: `${section.filterKey}:${value}`,
            label: `${section.title}: ${section.formatSelected(value)}`,
            onRemove: () =>
              setRangeFilters((current) => ({
                ...current,
                [section.filterKey]: 0,
              })),
          });
        }
      });

    return chips;
  }, [
    filterSections.advanced,
    filterSections.primary,
    optionFilters,
    rangeFilters,
  ]);

  const totalCount = items.length;
  const displayedCount = isStudentRecruiterJobView
    ? recruiterJobItems.length
    : totalCount;
  const hasActiveFilters = activeFilterChips.length > 0;
  const hasFilterSections =
    filterSections.primary.length > 0 || filterSections.advanced.length > 0;

  const handleMessage = (targetId: string) => {
    const storageKey = `dm_first_contact_${targetId}`;
    if (!localStorage.getItem(storageKey)) {
      localStorage.setItem(storageKey, "true");
    }
    navigate(`/dashboard/messages/${targetId}`);
  };

  const openStartupInvite = (item: MarketplaceUserItem) => {
    if (!isStartupInviteTargetType(item.entityType) || item._id === authUser?._id) {
      return;
    }

    setInviteFeedback(null);
    setInviteTarget({
      _id: item._id,
      entityType: item.entityType,
      displayName: item.displayName,
      headline: item.headline,
      domain: item.domain,
      location: item.location,
    });
  };

  const renderActions = (item: MarketplaceDirectoryItem) => {
    if (isStartupItem(item)) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          {item.primaryFounderId ? (
            <button
              onClick={() => handleMessage(item.primaryFounderId!)}
              className={secondaryActionClassName}
            >
              <MessageCircle className="h-4 w-4" />
              Message founder
            </button>
          ) : null}
          <button
            onClick={() =>
              navigate(
                getMarketplaceDetailPath(dashboardRole, "startup", item._id),
              )
            }
            className={primaryActionClassName}
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
          className={secondaryActionClassName}
        >
          <MessageCircle className="h-4 w-4" />
          Message
        </button>
        {isStartupInviteTargetType(item.entityType) && item._id !== authUser?._id ? (
          <button
            onClick={() => openStartupInvite(item)}
            className={secondaryActionClassName}
          >
            <Send className="h-4 w-4" />
            {getStartupInviteActionLabel(item.entityType)}
          </button>
        ) : null}
        <button
          onClick={() =>
            navigate(
              getMarketplaceDetailPath(
                dashboardRole,
                item.entityType,
                item._id,
              ),
            )
          }
          className={primaryActionClassName}
        >
          View portfolio
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  };

  const headingTitle = isStudentRecruiterJobView
    ? "Jobs"
    : `${activeTab.label} discovery`;
  const headingDescription = isStudentRecruiterJobView
    ? "See live job openings with recruiter identity, role context, and a direct apply flow from the same page."
    : activeTab.description;
  const listingLabel = isStudentRecruiterJobView
    ? "jobs"
    : activeTab.label.toLowerCase();
  const isLoading = isStudentRecruiterJobView
    ? listQuery.isLoading || recruiterJobsQuery.isLoading
    : listQuery.isLoading;
  const isError = isStudentRecruiterJobView
    ? listQuery.isError || recruiterJobsQuery.isError
    : listQuery.isError;

  return (
    <div className="min-h-[calc(100vh-7rem)] bg-[radial-gradient(circle_at_top,#16213d_0%,#0a0f1d_34%,#050814_100%)] text-slate-100">
      <div className="w-full px-4 py-5 sm:px-6 lg:px-8">
        <section className="border-b border-slate-800 text-white">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
                  Marketplace
                </div>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-[2rem]">
                  {headingTitle}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                  {headingDescription}
                </p>
              </div>
              <div className="inline-flex items-center gap-2 text-sm text-slate-300">
                <LayoutGrid className="h-4 w-4 text-cyan-300" />
                {displayedCount > 0 ? `1 - ${displayedCount}` : "0"} of{" "}
                {formatCompactNumber(displayedCount)} live matches
              </div>
            </div>

            <div className="overflow-x-auto px-1 py-1.5">
              <div className="flex min-w-max items-center gap-2">
                {availableTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = tab.id === entityType;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() =>
                        updateSearchParams({ role: tab.id, q: query, sort })
                      }
                      className={`group inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-medium transition ${
                        isActive
                          ? "bg-cyan-500/10 text-cyan-200 ring-1 ring-cyan-500/30"
                          : "text-slate-400 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 ${isActive ? "text-cyan-300" : "text-slate-500 group-hover:text-slate-300"}`}
                      />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="border-b border-slate-800" />
          </div>
        </section>

        <div className={`mt-6 grid gap-6 ${hasFilterSections ? "xl:grid-cols-[320px,minmax(0,1fr)]" : ""}`}>
          {hasFilterSections ? (
            <aside className="xl:sticky xl:top-4 xl:self-start">
              <div className="pr-4 xl:pr-8">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xl font-semibold text-white">
                      All Filters
                    </div>
                    <p className="mt-1 text-sm text-slate-400">
                      Naukri-style grouped filters with live counts.
                    </p>
                  </div>
                  <Filter className="h-5 w-5 text-slate-500" />
                </div>

                <div className="mt-5 space-y-5">
                  {filterSections.primary.map((section) =>
                    section.kind === "checkbox" ? (
                      <FilterCheckboxGroup
                        key={section.id}
                        title={section.title}
                        options={section.options}
                        selectedValues={optionFilters[section.filterKey]}
                        onToggle={(value) =>
                          toggleOptionFilter(section.filterKey, value)
                        }
                      />
                    ) : (
                      <FilterRangeGroup
                        key={section.id}
                        title={section.title}
                        value={rangeFilters[section.filterKey]}
                        max={section.max}
                        step={section.step}
                        minLabel={section.minLabel}
                        maxLabel={section.maxLabel}
                        formatSelected={section.formatSelected}
                        onChange={(value) =>
                          setRangeFilters((current) => ({
                            ...current,
                            [section.filterKey]: value,
                          }))
                        }
                      />
                    ),
                  )}

                  {filterSections.advanced.length ? (
                    <div className="border-t border-slate-800 pt-5">
                      <button
                        type="button"
                        onClick={() => setShowMoreFilters((current) => !current)}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/75 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-400/50 hover:bg-slate-800"
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                        {showMoreFilters ? "Hide More Filters" : "More Filters"}
                      </button>
                    </div>
                  ) : null}

                  {showMoreFilters
                    ? filterSections.advanced.map((section) =>
                        section.kind === "checkbox" ? (
                          <FilterCheckboxGroup
                            key={section.id}
                            title={section.title}
                            options={section.options}
                            selectedValues={optionFilters[section.filterKey]}
                            onToggle={(value) =>
                              toggleOptionFilter(section.filterKey, value)
                            }
                          />
                        ) : (
                          <FilterRangeGroup
                            key={section.id}
                            title={section.title}
                            value={rangeFilters[section.filterKey]}
                            max={section.max}
                            step={section.step}
                            minLabel={section.minLabel}
                            maxLabel={section.maxLabel}
                            formatSelected={section.formatSelected}
                            onChange={(value) =>
                              setRangeFilters((current) => ({
                                ...current,
                                [section.filterKey]: value,
                              }))
                            }
                          />
                        ),
                      )
                    : null}
                </div>

                {hasActiveFilters ? (
                  <div className="mt-6 border-t border-slate-800 pt-5">
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="text-sm font-semibold text-cyan-300 transition hover:text-cyan-200"
                    >
                      Clear all filters
                    </button>
                  </div>
                ) : null}
              </div>
            </aside>
          ) : null}

          <main className="min-w-0">
            <div className="pb-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-400">
                    Marketplace Type
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-white">
                    {activeTab.label}
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  {isStudentRecruiterJobView ? (
                    <button
                      type="button"
                      onClick={() => navigate("/dashboard/student/applications")}
                      className={secondaryActionClassName}
                    >
                      <BriefcaseBusiness className="h-4 w-4" />
                      My Applications
                    </button>
                  ) : null}
                  <label className="relative block min-w-[260px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      value={query}
                      onChange={(event) =>
                        updateSearchParams({ q: event.target.value })
                      }
                      placeholder={
                        isStudentRecruiterJobView
                          ? "Job title, recruiter, company, location"
                          : "Role, skill, sector, location"
                      }
                      className="h-12 w-full rounded-full border border-slate-700 bg-slate-950/70 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:bg-slate-950"
                    />
                  </label>
                  <div
                    ref={sortMenuRef}
                    className="relative flex h-12 items-center gap-3 rounded-full border border-slate-700 bg-slate-950/70 px-4 text-sm text-slate-300"
                  >
                    <span className="font-medium text-slate-400">Sort</span>
                    <button
                      type="button"
                      onClick={() => setIsSortMenuOpen((current) => !current)}
                      className="inline-flex min-w-[10rem] items-center justify-between gap-2 rounded-full text-left font-semibold text-white"
                    >
                      <span>{sortLabelMap[sort] ?? "Recommended"}</span>
                      <ChevronDown
                        className={`h-4 w-4 text-slate-400 transition ${isSortMenuOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {isSortMenuOpen ? (
                      <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 min-w-[12rem] overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-[0_20px_60px_rgba(2,6,23,0.5)]">
                        {[
                          { value: "recommended", label: "Recommended" },
                          { value: "signal", label: "Profile signal" },
                          { value: "name", label: "Name" },
                        ].map((option) => {
                          const isActive = option.value === sort;

                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                updateSearchParams({ sort: option.value });
                                setIsSortMenuOpen(false);
                              }}
                              className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition ${
                                isActive
                                  ? "bg-cyan-500/15 text-cyan-100"
                                  : "text-slate-200 hover:bg-white/5"
                              }`}
                            >
                              <span>{option.label}</span>
                              {isActive ? (
                                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
                                  Active
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 border-t border-slate-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-slate-400">
                  Showing{" "}
                  <span className="font-semibold text-white">
                    {formatCompactNumber(displayedCount)}
                  </span>{" "}
                  {listingLabel}
                </div>
                <div className="text-sm text-slate-400">
                  {hasFilterSections
                    ? "Filters update instantly as you adjust the rail."
                    : "Startup listings are shown without extra marketplace filters."}
                </div>
              </div>

              {inviteFeedback ? (
                <div className="mt-4 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
                  {inviteFeedback}
                </div>
              ) : null}

              {activeFilterChips.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {activeFilterChips.map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={chip.onRemove}
                      className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-sm font-medium text-cyan-200 transition hover:border-cyan-400/50 hover:bg-cyan-500/15"
                    >
                      {chip.label}
                      <span className="text-cyan-400">x</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mt-6 space-y-4">
              {isLoading ? (
                <div className="py-12 text-sm text-slate-400">
                  Loading marketplace results...
                </div>
              ) : null}

              {isError ? (
                <div className="py-6 text-sm text-rose-200">
                  Unable to load marketplace items right now.
                </div>
              ) : null}

              {!isLoading && !isError && displayedCount === 0 ? (
                <div className="py-12">
                  <div className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">
                    No matches
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold text-white">
                    Nothing matched this filter stack yet
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                    Try another keyword, broaden the filter ranges, or clear the
                    current filter set.
                  </p>
                </div>
              ) : null}

              {isStudentRecruiterJobView
                ? recruiterJobItems.map((job) => (
                    <MarketplaceRecruiterJobFeedCard
                      key={job._id}
                      dashboardRole={dashboardRole}
                      job={job}
                    />
                  ))
                : items.map((item) => {
                    const stats = buildStatList(item);
                    const metaList = buildMetaList(item);
                    const title = getTitle(item);
                    const subtitle = getSubtitle(item);
                    const description = getDescription(item);
                    const chips = getDetailChips(item)
                      .filter(Boolean)
                      .slice(0, 6);
                    const avatarLabel = title.slice(0, 1).toUpperCase();
                    const itemTypeLabel = isStartupItem(item)
                      ? "Startup"
                      : formatRoleLabel(item.entityType);
                    const itemLocation = getItemLocations(item)[0];

                    return (
                      <article
                        key={`${item.entityType}-${item._id}`}
                        className="border-b border-slate-800 py-8"
                      >
                        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-4">
                              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[18px] bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_100%)] text-lg font-semibold text-white">
                                {!isStartupItem(item) && item.avatar ? (
                                  <img
                                    src={item.avatar}
                                    alt={item.displayName}
                                    className="h-14 w-14 object-cover"
                                  />
                                ) : (
                                  avatarLabel
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                                    {itemTypeLabel}
                                  </span>
                                  <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                                    {activeTab.filterLabel}
                                  </span>
                                </div>

                                <h2 className="mt-3 truncate text-2xl font-semibold tracking-tight text-white">
                                  {title}
                                </h2>
                                <p className="mt-1 truncate text-sm font-medium text-slate-400">
                                  {subtitle}
                                </p>

                                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-400">
                                  {itemLocation ? (
                                    <span className="inline-flex items-center gap-1.5">
                                      <MapPin className="h-4 w-4 text-cyan-600" />
                                      {itemLocation}
                                    </span>
                                  ) : null}
                                  {metaList.map((meta) => (
                                    <span key={`${item._id}-${meta}`}>
                                      {meta}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <p className="mt-5 max-w-3xl text-sm leading-6 text-slate-300">
                              {description}
                            </p>

                            <div className="mt-5 flex flex-wrap gap-2">
                              {chips.map((chip) => (
                                <span
                                  key={`${item._id}-${chip}`}
                                  className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-300"
                                >
                                  {chip}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="w-full max-w-[280px] shrink-0 pt-2">
                            <div className="grid grid-cols-2 gap-3">
                              {stats.map((stat) => (
                                <div
                                  key={`${item._id}-${stat.label}-tile`}
                                  className="border-l border-slate-800 pl-3"
                                >
                                  <div className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                                    {stat.label}
                                  </div>
                                  <div className="mt-2 text-base font-semibold text-white">
                                    {stat.value}
                                  </div>
                                </div>
                              ))}
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              {renderActions(item)}
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
            </div>
          </main>
        </div>
      </div>

      <StartupInviteModal
        isOpen={Boolean(inviteTarget)}
        onClose={() => setInviteTarget(null)}
        target={inviteTarget}
        onSent={setInviteFeedback}
      />
    </div>
  );
}
