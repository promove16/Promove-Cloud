import { useDeferredValue, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  Eye,
  Mail,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { DashboardLayout } from "../../app/components/DashboardLayout";
import { recruiterApi } from "../../api/recruiter.api";
import {
  RecruiterCollegeCard,
  RecruiterListResponse,
  RecruiterTalentSummary,
} from "../../types/recruiter.types";
import { UserRole } from "../../types/roles.types";
import { StudentProfileDrawer } from "./StudentProfileDrawer";

type RecruiterMarketplaceLane = "students" | "colleges";

const recruiterTabs: Array<{
  id: RecruiterMarketplaceLane;
  label: string;
  eyebrow: string;
  description: string;
  icon: typeof Users;
}> = [
  {
    id: "students",
    label: "Students",
    eyebrow: "Talent",
    description: "Find student innovators by name, domain, project signal, or institution fit.",
    icon: Users,
  },
  {
    id: "colleges",
    label: "Colleges",
    eyebrow: "Institutions",
    description: "Browse colleges with active innovation pipelines and placement readiness signals.",
    icon: Building2,
  },
];

const formatCompactNumber = (value: number) =>
  new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);

const getRecruiterLane = (value: string | null): RecruiterMarketplaceLane =>
  value === "college" || value === "colleges" ? "colleges" : "students";

const buildSearchParams = ({
  lane,
  query,
  institution,
}: {
  lane: RecruiterMarketplaceLane;
  query?: string;
  institution?: string;
}) => ({
  role: lane,
  ...(query ? { q: query } : {}),
  ...(lane === "students" && institution ? { institution } : {}),
});

const mergeTalentResponses = (
  responses: Array<RecruiterListResponse<RecruiterTalentSummary>>,
): RecruiterListResponse<RecruiterTalentSummary> => {
  const itemMap = new Map<string, RecruiterTalentSummary>();

  responses.forEach((response) => {
    response.items.forEach((item) => {
      itemMap.set(item._id, item);
    });
  });

  const items = Array.from(itemMap.values()).sort((left, right) => right.innovationScore - left.innovationScore);

  return {
    items,
    page: 1,
    limit: 36,
    total: items.length,
    nextPage: null,
  };
};

const listRecruiterMarketplaceStudents = async (
  query: string,
  institution: string,
): Promise<RecruiterListResponse<RecruiterTalentSummary>> => {
  const baseParams: Parameters<typeof recruiterApi.discoverTalent>[0] = {
    minScore: 0,
    maxScore: 200,
    page: 1,
    limit: 36,
    ...(institution ? { institution } : {}),
  };

  if (!query) {
    return recruiterApi.discoverTalent(baseParams);
  }

  const searches = [
    recruiterApi.discoverTalent({ ...baseParams, search: query }),
    recruiterApi.discoverTalent({ ...baseParams, domain: query }),
  ];

  if (!institution) {
    searches.push(recruiterApi.discoverTalent({ ...baseParams, institution: query }));
  }

  return mergeTalentResponses(await Promise.all(searches));
};

const getCollegeSearchText = (college: RecruiterCollegeCard) =>
  [
    college.displayName,
    college.location,
    college.focusLabel,
    String(college.studentCount),
    String(college.iicStarRating),
  ]
    .join(" ")
    .toLowerCase();

const getStudentTags = (student: RecruiterTalentSummary) => [
  ...(student.skills ?? []),
  student.institution?.name ?? "",
  student.institution?.location ?? "",
  student.activeProject?.title ?? "",
  student.activeProject?.category ?? "",
  student.activeProject?.stage ?? "",
];

function RecruiterStudentCard({
  student,
  shortlistingId,
  onMessage,
  onShortlist,
  onViewProfile,
}: {
  student: RecruiterTalentSummary;
  shortlistingId: string | null;
  onMessage: (studentId: string) => void;
  onShortlist: (studentId: string) => void;
  onViewProfile: (studentId: string) => void;
}) {
  const tags = getStudentTags(student).filter(Boolean).slice(0, 6);

  return (
    <article className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#090d1b] px-6 py-6 shadow-[0_24px_80px_rgba(2,6,23,0.35)]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[22px] bg-gradient-to-br from-cyan-500/25 via-sky-500/10 to-emerald-500/20 text-xl font-semibold text-white ring-1 ring-white/10">
              {student.avatar ? (
                <img src={student.avatar} alt={student.displayName} className="h-16 w-16 object-cover" />
              ) : (
                student.displayName.slice(0, 1).toUpperCase()
              )}
            </div>

            <div className="min-w-0 space-y-2">
              <div>
                <div className="text-xs uppercase tracking-[0.32em] text-slate-500">Student</div>
                <h2 className="truncate text-2xl font-semibold text-white">{student.displayName}</h2>
                <p className="mt-1 text-sm text-cyan-200">
                  {student.institution?.name ?? "Independent"} - {student.activeProject?.title ?? "No active workspace"}
                </p>
              </div>
              <p className="max-w-3xl text-sm leading-7 text-slate-300">
                {student.activeProject
                  ? `${student.activeProject.title} is in ${student.activeProject.stage} with ${student.activeProject.progressPercent}% progress.`
                  : "Innovation profile is visible for discovery. Shortlist the student to create a contact bridge."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={`${student._id}-${tag}`}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300"
              >
                {tag}
              </span>
            ))}
          </div>

          <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-3">
              <dt className="text-xs uppercase tracking-[0.25em] text-slate-500">Score</dt>
              <dd className="mt-2 text-lg font-semibold text-white">{student.innovationScore}</dd>
            </div>
            <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-3">
              <dt className="text-xs uppercase tracking-[0.25em] text-slate-500">Skills</dt>
              <dd className="mt-2 text-lg font-semibold text-white">{student.skills.length}</dd>
            </div>
            <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-3">
              <dt className="text-xs uppercase tracking-[0.25em] text-slate-500">Institution</dt>
              <dd className="mt-2 truncate text-lg font-semibold text-white">{student.institution?.name ?? "None"}</dd>
            </div>
            <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-3">
              <dt className="text-xs uppercase tracking-[0.25em] text-slate-500">Contact</dt>
              <dd className="mt-2 text-lg font-semibold text-white">{student.canContact ? "Open" : "Gated"}</dd>
            </div>
          </dl>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3 xl:justify-end">
          <button
            onClick={() => onViewProfile(student._id)}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/10"
          >
            <Eye className="h-4 w-4" />
            View Profile
          </button>
          {student.canContact ? (
            <button
              onClick={() => onMessage(student._id)}
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
            >
              <Mail className="h-4 w-4" />
              Message
            </button>
          ) : (
            <button
              onClick={() => onShortlist(student._id)}
              disabled={shortlistingId === student._id}
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60"
            >
              <ShieldCheck className="h-4 w-4" />
              {shortlistingId === student._id ? "Shortlisting..." : "Shortlist"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function RecruiterCollegeCardView({
  college,
  onViewStudents,
  onPlanEvent,
}: {
  college: RecruiterCollegeCard;
  onViewStudents: (collegeName: string) => void;
  onPlanEvent: (collegeId: string) => void;
}) {
  return (
    <article className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#090d1b] px-6 py-6 shadow-[0_24px_80px_rgba(2,6,23,0.35)]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] bg-gradient-to-br from-amber-500/25 via-orange-500/10 to-cyan-500/20 text-white ring-1 ring-white/10">
              <Building2 className="h-7 w-7" />
            </div>
            <div className="min-w-0 space-y-2">
              <div>
                <div className="text-xs uppercase tracking-[0.32em] text-slate-500">College</div>
                <h2 className="truncate text-2xl font-semibold text-white">{college.displayName}</h2>
                <p className="mt-1 text-sm text-cyan-200">{college.location}</p>
              </div>
              <p className="max-w-3xl text-sm leading-7 text-slate-300">{college.focusLabel}</p>
            </div>
          </div>

          <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-3">
              <dt className="text-xs uppercase tracking-[0.25em] text-slate-500">Students</dt>
              <dd className="mt-2 text-lg font-semibold text-white">{formatCompactNumber(college.studentCount)}</dd>
            </div>
            <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-3">
              <dt className="text-xs uppercase tracking-[0.25em] text-slate-500">Velocity</dt>
              <dd className="mt-2 text-lg font-semibold text-white">{college.placementVelocity}%</dd>
            </div>
            <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-3">
              <dt className="text-xs uppercase tracking-[0.25em] text-slate-500">IIC</dt>
              <dd className="mt-2 text-lg font-semibold text-white">{college.iicStarRating.toFixed(1)}</dd>
            </div>
            <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-3">
              <dt className="text-xs uppercase tracking-[0.25em] text-slate-500">Focus</dt>
              <dd className="mt-2 truncate text-lg font-semibold text-white">Hiring</dd>
            </div>
          </dl>
        </div>

        <div className="flex shrink-0 flex-wrap gap-3 xl:justify-end">
          <button
            onClick={() => onPlanEvent(college._id)}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/10"
          >
            <Mail className="h-4 w-4" />
            Plan Hiring Event
          </button>
          <button
            onClick={() => onViewStudents(college.displayName)}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
          >
            View Students
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

export function RecruiterMarketplace({ dashboardRole }: { dashboardRole: UserRole }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [shortlistingId, setShortlistingId] = useState<string | null>(null);

  const lane = getRecruiterLane(searchParams.get("role"));
  const query = searchParams.get("q") ?? "";
  const focusedInstitution = searchParams.get("institution") ?? "";
  const deferredQuery = useDeferredValue(query);
  const activeTab = recruiterTabs.find((tab) => tab.id === lane) ?? recruiterTabs[0];

  const studentsQuery = useQuery({
    queryKey: ["marketplace", "recruiter", "students", deferredQuery, focusedInstitution],
    queryFn: () => listRecruiterMarketplaceStudents(deferredQuery, focusedInstitution),
    enabled: lane === "students",
  });

  const collegesQuery = useQuery({
    queryKey: ["marketplace", "recruiter", "colleges"],
    queryFn: recruiterApi.getColleges,
    enabled: lane === "colleges",
  });

  const students = studentsQuery.data?.items ?? [];
  const colleges = useMemo(() => {
    const source = collegesQuery.data ?? [];
    if (!deferredQuery) {
      return source;
    }

    const needle = deferredQuery.toLowerCase();
    return source.filter((college) => getCollegeSearchText(college).includes(needle));
  }, [collegesQuery.data, deferredQuery]);

  const totalCount = lane === "students" ? students.length : colleges.length;
  const isLoading = lane === "students" ? studentsQuery.isLoading : collegesQuery.isLoading;
  const isError = lane === "students" ? studentsQuery.isError : collegesQuery.isError;

  const updateSearch = (nextQuery: string) =>
    setSearchParams(
      buildSearchParams({
        lane,
        query: nextQuery,
        institution: focusedInstitution,
      }),
    );

  const handleLaneChange = (nextLane: RecruiterMarketplaceLane) =>
    setSearchParams(
      buildSearchParams({
        lane: nextLane,
        query,
        institution: nextLane === "students" ? focusedInstitution : undefined,
      }),
    );

  const handleShortlist = async (studentId: string) => {
    setShortlistingId(studentId);
    try {
      await recruiterApi.shortlistStudent(studentId);
      await studentsQuery.refetch();
    } finally {
      setShortlistingId(null);
    }
  };

  const handleViewCollegeStudents = (collegeName: string) =>
    setSearchParams(buildSearchParams({ lane: "students", institution: collegeName }));

  return (
    <DashboardLayout role={dashboardRole}>
      <div className="space-y-8">
        <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#070816] px-6 py-7 shadow-[0_30px_120px_rgba(15,23,42,0.45)] sm:px-8">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-400/20 via-cyan-400/5 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_60%)] lg:block" />
          <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.1fr),380px] lg:items-end">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100">
                Recruiter Marketplace
              </div>
              <div className="max-w-3xl space-y-3">
                <p className="text-sm font-medium uppercase tracking-[0.35em] text-slate-400">{activeTab.eyebrow}</p>
                <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                  Browse {activeTab.label.toLowerCase()} ready for hiring conversations
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-300">{activeTab.description}</p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-slate-300">
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                  <span className="text-white">{formatCompactNumber(totalCount)}</span> live results
                </div>
                {focusedInstitution && lane === "students" ? (
                  <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                    Institution: <span className="text-white">{focusedInstitution}</span>
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
                  onChange={(event) => updateSearch(event.target.value)}
                  placeholder={lane === "students" ? "Search students, domains, or institutions" : "Search colleges or locations"}
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
                {recruiterTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = tab.id === lane;

                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleLaneChange(tab.id)}
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

              {focusedInstitution && lane === "students" ? (
                <button
                  onClick={() => setSearchParams(buildSearchParams({ lane: "students", query }))}
                  className="mt-4 w-full rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-slate-300 transition hover:border-white/20 hover:bg-white/10"
                >
                  Clear institution focus
                </button>
              ) : null}

              <div className="mt-6 rounded-[22px] border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Current lens</div>
                <div className="mt-2 text-sm leading-6 text-slate-300">{activeTab.description}</div>
              </div>
            </div>
          </aside>

          <div className="space-y-4">
            {isLoading ? (
              <div className="rounded-[28px] border border-white/10 bg-[#0a0d1d] px-6 py-10 text-sm text-slate-400">
                Loading marketplace results...
              </div>
            ) : null}

            {isError ? (
              <div className="rounded-[28px] border border-rose-500/20 bg-rose-500/10 px-6 py-5 text-sm text-rose-100">
                Unable to load recruiter marketplace items right now.
              </div>
            ) : null}

            {!isLoading && !isError && totalCount === 0 ? (
              <div className="rounded-[28px] border border-white/10 bg-[#0a0d1d] px-6 py-10">
                <div className="text-xs uppercase tracking-[0.28em] text-slate-500">No matches</div>
                <h2 className="mt-3 text-2xl font-semibold text-white">Nothing matched this search yet</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  Try another keyword, switch marketplace lanes, or clear the current search input.
                </p>
              </div>
            ) : null}

            {lane === "students"
              ? students.map((student) => (
                  <RecruiterStudentCard
                    key={student._id}
                    student={student}
                    shortlistingId={shortlistingId}
                    onMessage={(studentId) => navigate(`/dashboard/recruiter/messages/${studentId}`)}
                    onShortlist={handleShortlist}
                    onViewProfile={setSelectedStudentId}
                  />
                ))
              : colleges.map((college) => (
                  <RecruiterCollegeCardView
                    key={college._id}
                    college={college}
                    onViewStudents={handleViewCollegeStudents}
                    onPlanEvent={(collegeId) => navigate(`/dashboard/messages/${collegeId}?queryType=hiring_event`)}
                  />
                ))}
          </div>
        </section>
      </div>

      <StudentProfileDrawer
        studentId={selectedStudentId}
        open={Boolean(selectedStudentId)}
        onClose={() => setSelectedStudentId(null)}
        onChanged={() => studentsQuery.refetch()}
      />
    </DashboardLayout>
  );
}
