import { useDeferredValue, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  Eye,
  Mail,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { recruiterApi } from "../../api/recruiter.api";
import { getStudentPortfolioViewPath } from "../marketplace/navigation";
import {
  RecruiterCollegeCard,
  RecruiterJobDetail,
  RecruiterListResponse,
  RecruiterTalentSummary,
} from "../../types/recruiter.types";
import { UserRole } from "../../types/roles.types";

type RecruiterMarketplaceLane = "students" | "colleges";

const recruiterTabs: Array<{
  id: RecruiterMarketplaceLane;
  label: string;
  description: string;
  icon: typeof Users;
}> = [
  {
    id: "students",
    label: "Students",
    description: "Find student innovators by name, domain, project signal, or institution fit.",
    icon: Users,
  },
  {
    id: "colleges",
    label: "Colleges",
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
    maxScore: 1000,
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

const surfaceClass =
  "border border-slate-800/80 bg-slate-900/55 shadow-[0_18px_40px_rgba(2,6,23,0.35)]";
const secondaryButtonClass =
  "inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-cyan-400/50 hover:bg-slate-800/90 hover:text-white";
const primaryButtonClass =
  "inline-flex items-center gap-2 rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-60";
const subtleTagClass =
  "rounded-full border border-slate-700 bg-slate-900/75 px-2.5 py-1 text-xs text-slate-200";

function RecruiterStudentCard({
  student,
  activeJobCount,
  invitingStudentId,
  shortlistingId,
  onInvite,
  onMessage,
  onShortlist,
  onViewProfile,
}: {
  student: RecruiterTalentSummary;
  activeJobCount: number;
  invitingStudentId: string | null;
  shortlistingId: string | null;
  onInvite: (studentId: string) => void;
  onMessage: (studentId: string) => void;
  onShortlist: (studentId: string) => void;
  onViewProfile: (studentId: string) => void;
}) {
  const tags = getStudentTags(student).filter(Boolean).slice(0, 4);
  const projectSummary = student.activeProject
    ? `${student.activeProject.stage} / ${student.activeProject.progressPercent}% progress`
    : "Profile available for discovery";
  const contactState = student.canContact
    ? {
        label: "Contact Open",
        className: "bg-emerald-400/10 text-emerald-200 ring-1 ring-inset ring-emerald-400/25",
      }
    : {
        label: "Contact Gated",
        className: "bg-amber-400/10 text-amber-200 ring-1 ring-inset ring-amber-400/25",
      };

  return (
    <article className="px-4 py-5 transition hover:bg-slate-900/35 sm:px-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-900 text-base font-semibold text-white ring-1 ring-slate-700">
              {student.avatar ? (
                <img src={student.avatar} alt={student.displayName} className="h-12 w-12 object-cover" />
              ) : (
                student.displayName.slice(0, 1).toUpperCase()
              )}
            </div>

            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2 className="truncate text-xl font-semibold text-white">{student.displayName}</h2>
                <span className="text-sm font-medium text-cyan-200">Score {student.innovationScore}</span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${contactState.className}`}>
                  {contactState.label}
                </span>
              </div>
              <p className="truncate text-sm font-medium text-cyan-100">
                {student.institution?.name ?? "Independent"}
                {student.activeProject?.title ? ` / ${student.activeProject.title}` : ""}
              </p>
              <p className="max-w-3xl text-sm text-slate-300">{projectSummary}</p>
            </div>
          </div>

          {tags.length ? (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span key={`${student._id}-${tag}`} className={subtleTagClass}>
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div className="flex items-baseline gap-2">
              <dt className="text-slate-400">Skills</dt>
              <dd className="font-medium text-white">{student.skills.length}</dd>
            </div>
            <div className="flex items-baseline gap-2">
              <dt className="text-slate-400">Institution</dt>
              <dd className="max-w-[18rem] truncate font-medium text-white">{student.institution?.name ?? "None"}</dd>
            </div>
            {student.institution?.location ? (
              <div className="flex items-baseline gap-2">
                <dt className="text-slate-400">Location</dt>
                <dd className="font-medium text-white">{student.institution.location}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 xl:justify-end">
          <button
            onClick={() => onViewProfile(student._id)}
            className={secondaryButtonClass}
          >
            <Eye className="h-4 w-4" />
            View Profile
          </button>
          <button
            onClick={() => onInvite(student._id)}
            disabled={invitingStudentId === student._id}
            className={primaryButtonClass}
          >
            <BriefcaseBusiness className="h-4 w-4" />
            {invitingStudentId === student._id
              ? "Inviting..."
              : activeJobCount > 0
              ? "Invite to Job"
              : "Create job to invite"}
          </button>
          {student.canContact ? (
            <button
              onClick={() => onMessage(student._id)}
              className={secondaryButtonClass}
            >
              <Mail className="h-4 w-4" />
              Message
            </button>
          ) : (
            <button
              onClick={() => onShortlist(student._id)}
              disabled={shortlistingId === student._id}
              className={primaryButtonClass}
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

function InviteStudentModal({
  activeJobs,
  inviteNote,
  isSubmitting,
  onClose,
  onNoteChange,
  onInvite,
  onGoToRecruiterHome,
}: {
  activeJobs: RecruiterJobDetail[];
  inviteNote: string;
  isSubmitting: boolean;
  onClose: () => void;
  onNoteChange: (value: string) => void;
  onInvite: (jobId: string) => void;
  onGoToRecruiterHome: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl shadow-black/40">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-6 py-5">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-cyan-300">Invite to Hiring Flow</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">Choose an active job</h2>
            <p className="mt-2 text-sm text-slate-400">
              This creates a real application entry and makes the student visible in your recruiter pipeline.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-800 p-2 text-slate-400 transition hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-500">
              Optional note
            </label>
            <textarea
              value={inviteNote}
              onChange={(event) => onNoteChange(event.target.value)}
              rows={3}
              placeholder="Add a short note the student can see on their application page."
              className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50"
            />
          </div>

          {activeJobs.length > 0 ? (
            <div className="space-y-3">
              {activeJobs.map((job) => (
                <div
                  key={job._id}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0">
                    <div className="text-lg font-semibold text-white">{job.title}</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-sm text-slate-400">
                      <span>{job.company}</span>
                      <span>{job.location}</span>
                      <span>{job.type}</span>
                      {job.workMode ? <span>{job.workMode}</span> : null}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      {job.applicantCount} applicants · {job.shortlistedCount} progressed · score cutoff {job.minimumInnovationScore}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onInvite(job._id)}
                    disabled={isSubmitting}
                    className={primaryButtonClass}
                  >
                    <BriefcaseBusiness className="h-4 w-4" />
                    Send invite
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-800 p-6 text-center">
              <div className="text-lg font-semibold text-white">No active jobs yet</div>
              <p className="mt-2 text-sm text-slate-400">
                Post or reopen a recruiter job before inviting students into the hiring flow.
              </p>
              <button
                type="button"
                onClick={onGoToRecruiterHome}
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-medium text-slate-100 transition hover:border-slate-600 hover:bg-slate-800"
              >
                <BriefcaseBusiness className="h-4 w-4" />
                Go to recruiter home
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
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
    <article className="px-4 py-5 transition hover:bg-slate-900/35 sm:px-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-200 ring-1 ring-cyan-400/20">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2 className="truncate text-xl font-semibold text-white">{college.displayName}</h2>
                <span className="text-sm font-medium text-cyan-200">{formatCompactNumber(college.studentCount)} students</span>
                <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs font-medium text-cyan-100 ring-1 ring-inset ring-cyan-400/20">
                  Velocity {college.placementVelocity}%
                </span>
              </div>
              <p className="text-sm font-medium text-cyan-100">{college.location}</p>
              <p className="max-w-3xl text-sm text-slate-300">{college.focusLabel}</p>
            </div>
          </div>

          <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div className="flex items-baseline gap-2">
              <dt className="text-slate-400">IIC</dt>
              <dd className="font-medium text-white">{college.iicStarRating.toFixed(1)}</dd>
            </div>
            <div className="flex items-baseline gap-2">
              <dt className="text-slate-400">Focus</dt>
              <dd className="font-medium text-white">Hiring</dd>
            </div>
          </dl>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 xl:justify-end">
          <button
            onClick={() => onPlanEvent(college._id)}
            className={secondaryButtonClass}
          >
            <Mail className="h-4 w-4" />
            Plan Hiring Event
          </button>
          <button
            onClick={() => onViewStudents(college.displayName)}
            className={primaryButtonClass}
          >
            View Students
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

export function RecruiterMarketplace({ dashboardRole: _dashboardRole }: { dashboardRole: UserRole }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [shortlistingId, setShortlistingId] = useState<string | null>(null);
  const [inviteStudentId, setInviteStudentId] = useState<string | null>(null);
  const [inviteNote, setInviteNote] = useState("");
  const [inviteFeedback, setInviteFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

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
  const jobsQuery = useQuery({
    queryKey: ["recruiter", "jobs"],
    queryFn: recruiterApi.getJobs,
  });

  const activeJobs = useMemo(
    () => (jobsQuery.data ?? []).filter((job) => job.isActive),
    [jobsQuery.data],
  );

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

  const inviteMutation = useMutation({
    mutationFn: (jobId: string) =>
      recruiterApi.inviteStudentToJob(
        jobId,
        inviteStudentId!,
        inviteNote.trim() ? { note: inviteNote.trim() } : undefined,
      ),
    onSuccess: async (result, jobId) => {
      setInviteFeedback({
        tone: "success",
        message: result.alreadyInvited
          ? "This student is already in that hiring pipeline."
          : result.alreadyApplied
          ? "The student already applied. The hiring bridge is now ready for follow-up."
          : "Invite sent. The student now has an application entry in their hiring flow.",
      });
      setInviteStudentId(null);
      setInviteNote("");
      await Promise.all([
        studentsQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ["recruiter", "jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["recruiter", "job-applications", jobId] }),
        queryClient.invalidateQueries({ queryKey: ["recruiter", "dashboard"] }),
      ]);
    },
    onError: (error) => {
      setInviteFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Unable to invite this student right now.",
      });
    },
  });

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

  const openInviteModal = (studentId: string) => {
    setInviteFeedback(null);
    setInviteStudentId(studentId);
  };

  return (
    <>
      <div className="space-y-6">
        <section className="border-b border-slate-800/80 pb-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.28em] text-cyan-300/80">
                {lane === "students" ? "Talent Directory" : "College Directory"}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <h1 className="text-2xl font-semibold tracking-tight text-white">{activeTab.label}</h1>
                <span className="text-sm text-slate-300">{formatCompactNumber(totalCount)} results</span>
                {focusedInstitution && lane === "students" ? (
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100">
                    {focusedInstitution}
                  </span>
                ) : null}
              </div>
              <p className="max-w-2xl text-sm leading-6 text-slate-300">{activeTab.description}</p>
            </div>

            <div className="w-full max-w-md">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => updateSearch(event.target.value)}
                  placeholder={lane === "students" ? "Search students, domains, or institutions" : "Search colleges or locations"}
                  className="w-full rounded-full border border-slate-700 bg-slate-900/85 py-3 pl-11 pr-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-cyan-400/60"
                />
              </label>
            </div>
          </div>
        </section>

        <section className="flex flex-wrap items-center gap-3 border-b border-slate-800/80 pb-4">
          <div className="inline-flex rounded-full border border-slate-700 bg-slate-900/80 p-1">
            {recruiterTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.id === lane;

              return (
                <button
                  key={tab.id}
                  onClick={() => handleLaneChange(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition ${
                    isActive
                      ? "bg-cyan-400 text-slate-950 shadow-[0_0_0_1px_rgba(34,211,238,0.16)]"
                      : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="text-sm text-slate-300">
            {lane === "students" ? "Students ready for review" : "Institution pipeline overview"}
          </div>

          {focusedInstitution && lane === "students" ? (
            <button
              onClick={() => setSearchParams(buildSearchParams({ lane: "students", query }))}
              className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-sm text-slate-200 transition hover:border-cyan-400/50 hover:bg-slate-800/80"
            >
              Clear institution
            </button>
          ) : null}
        </section>

        {inviteFeedback ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              inviteFeedback.tone === "success"
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
                : "border-rose-500/20 bg-rose-500/10 text-rose-100"
            }`}
          >
            {inviteFeedback.message}
          </div>
        ) : null}

        <section className={`overflow-hidden rounded-2xl ${surfaceClass}`}>
          <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/55 px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-300 sm:px-6">
            <span>{lane === "students" ? "Student Results" : "College Results"}</span>
            <span>{formatCompactNumber(totalCount)}</span>
          </div>

          {isLoading ? (
            <div className="px-4 py-10 text-sm text-slate-300 sm:px-6">Loading marketplace results...</div>
          ) : null}

          {isError ? (
            <div className="px-4 py-5 text-sm text-rose-200 sm:px-6">
              Unable to load recruiter marketplace items right now.
            </div>
          ) : null}

          {!isLoading && !isError && totalCount === 0 ? (
            <div className="px-4 py-10 sm:px-6">
              <div className="text-sm font-medium text-white">No matches found</div>
              <p className="mt-1 text-sm text-slate-300">Try another search or switch directory.</p>
            </div>
          ) : null}

          {!isLoading && !isError && totalCount > 0 ? (
            <div className="divide-y divide-slate-800/80">
              {lane === "students"
                ? students.map((student) => (
                    <RecruiterStudentCard
                      key={student._id}
                      student={student}
                      activeJobCount={activeJobs.length}
                      invitingStudentId={inviteMutation.isPending ? inviteStudentId : null}
                      shortlistingId={shortlistingId}
                      onInvite={openInviteModal}
                      onMessage={(studentId) => navigate(`/dashboard/recruiter/messages/${studentId}`)}
                      onShortlist={handleShortlist}
                      onViewProfile={(studentId) => navigate(getStudentPortfolioViewPath(studentId))}
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
          ) : null}
        </section>
      </div>

      {inviteStudentId ? (
        <InviteStudentModal
          activeJobs={activeJobs}
          inviteNote={inviteNote}
          isSubmitting={inviteMutation.isPending}
          onClose={() => {
            if (inviteMutation.isPending) return;
            setInviteStudentId(null);
            setInviteNote("");
          }}
          onNoteChange={setInviteNote}
          onInvite={(jobId) => inviteMutation.mutate(jobId)}
          onGoToRecruiterHome={() => navigate("/dashboard/recruiter")}
        />
      ) : null}
    </>
  );
}
