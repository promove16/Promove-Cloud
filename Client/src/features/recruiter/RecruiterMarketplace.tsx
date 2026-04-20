import { type ReactNode, useDeferredValue, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Eye,
  Loader2,
  Mail,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { toast as appToast } from "../../app/components/ui/sonner";
import { recruiterApi } from "../../api/recruiter.api";
import { requestApi } from "../../api/request.api";
import { getStudentPortfolioViewPath } from "../marketplace/navigation";
import {
  RECRUITER_PAGE_CONTENT_CLASS,
  RecruiterSectionNav,
  recruiterMarketplaceSectionItems,
} from "./RecruiterSectionNav";
import {
  RecruiterCollegeCard,
  RecruiterJobDetail,
  RecruiterListResponse,
  RecruiterTalentSummary,
} from "../../types/recruiter.types";
import { UserRole } from "../../types/roles.types";

type RecruiterMarketplaceLane = "students" | "colleges";
type RecruiterEventPlanningRequest = Awaited<ReturnType<typeof requestApi.outgoing>>[number];

const hiringEventTypes = [
  "Industry Connect Session",
  "Placement Hackathon",
  "Innovation Drive",
  "Other",
] as const;

type HiringEventPlanFormState = {
  collegeId: string;
  collegeName: string;
  title: string;
  type: (typeof hiringEventTypes)[number];
  date: string;
  description: string;
  linkedJobId: string;
  minimumInnovationScore: string;
  message: string;
};

type JobFormState = {
  title: string;
  company: string;
  description: string;
  domain: string;
  type: "Full-time" | "Internship" | "Contract" | "Part-time";
  location: string;
  workMode: "On-site" | "Hybrid" | "Remote";
  minimumInnovationScore: string;
  openings: string;
};

type StudentMarketplaceFilters = {
  contact: "all" | "open" | "gated";
  minScore: number;
  requireActiveProject: boolean;
  stages: string[];
  skills: string[];
};

type CollegeMarketplaceFilters = {
  minRating: number;
  minPlacementVelocity: number;
  minStudents: number;
  focusLabels: string[];
  locations: string[];
};

const recruiterTabs: Array<{
  id: RecruiterMarketplaceLane;
  label: string;
  eyebrow: string;
  description: string;
  helper: string;
  icon: typeof Users;
}> = [
  {
    id: "students",
    label: "Students",
    eyebrow: "Talent Directory",
    description: "Find student innovators by name, domain, project signal, or institution fit.",
    helper: "Students ready for review",
    icon: Users,
  },
  {
    id: "colleges",
    label: "Colleges",
    eyebrow: "College Directory",
    description: "Browse colleges with active innovation pipelines and placement readiness signals.",
    helper: "Institution pipeline overview",
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
  "border border-slate-800 bg-slate-900 shadow-[0_18px_40px_rgba(2,6,23,0.35)]";
const secondaryButtonClass =
  "inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-cyan-400/50 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900 disabled:text-slate-500";
const primaryButtonClass =
  "inline-flex items-center gap-2 rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-60";
const subtleTagClass =
  "rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-200";

const createInitialHiringEventPlan = (college?: RecruiterCollegeCard): HiringEventPlanFormState => ({
  collegeId: college?._id ?? "",
  collegeName: college?.displayName ?? "",
  title: college ? `${college.displayName} Hiring Event` : "",
  type: hiringEventTypes[0],
  date: "",
  description: "",
  linkedJobId: "",
  minimumInnovationScore: "0",
  message: "",
});

const createInitialJobForm = (): JobFormState => ({
  title: "",
  company: "",
  description: "",
  domain: "",
  type: "Full-time",
  location: "",
  workMode: "On-site",
  minimumInnovationScore: "0",
  openings: "1",
});

const createDefaultStudentFilters = (): StudentMarketplaceFilters => ({
  contact: "all",
  minScore: 0,
  requireActiveProject: false,
  stages: [],
  skills: [],
});

const createDefaultCollegeFilters = (): CollegeMarketplaceFilters => ({
  minRating: 0,
  minPlacementVelocity: 0,
  minStudents: 0,
  focusLabels: [],
  locations: [],
});

const toggleStringFilter = (current: string[], value: string) =>
  current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];

function FilterOptionButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-100"
          : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function FilterSidebarSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-slate-800 pt-4 first:border-t-0 first:pt-0">
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
        {title}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

const parseRequestDateInput = (value?: string) => {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
};

const getLatestCollegeEventRequest = (
  requests: RecruiterEventPlanningRequest[],
  collegeId: string,
) =>
  requests
    .filter(
      (request) =>
        request.type === "college_event_invite" &&
        request.targetEntityType === "college" &&
        request.targetEntityId === collegeId,
    )
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0] ?? null;

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
  const skillCount = student.skills?.length ?? 0;
  const visibleSkills = (student.skills ?? []).slice(0, 6);
  const remainingSkillCount = Math.max(skillCount - visibleSkills.length, 0);
  const inviteTitle =
    activeJobCount > 0
      ? undefined
      : "No active jobs yet. Open the invite flow to create or reopen one.";
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
    <article className="px-4 py-5 transition hover:bg-slate-900 sm:px-6">
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

          {visibleSkills.length > 0 ? (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Skill snapshot</div>
              <div className="flex flex-wrap gap-2">
                {visibleSkills.map((skill) => (
                  <span key={`${student._id}-skill-${skill}`} className={subtleTagClass}>
                    {skill}
                  </span>
                ))}
                {remainingSkillCount > 0 ? (
                  <span className={subtleTagClass}>+{remainingSkillCount} more</span>
                ) : null}
              </div>
            </div>
          ) : null}

          <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div className="flex items-baseline gap-2">
              <dt className="text-slate-400">Skills</dt>
              <dd className="font-medium text-white">{skillCount}</dd>
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
            title={inviteTitle}
          >
            <BriefcaseBusiness className="h-4 w-4" />
            {invitingStudentId === student._id ? "Inviting..." : "Invite to Job"}
          </button>
          <button
            onClick={() => onMessage(student._id)}
            disabled={!student.canContact}
            className={secondaryButtonClass}
            title={!student.canContact ? "Shortlist this student to unlock messaging." : undefined}
          >
            <Mail className="h-4 w-4" />
            Message
          </button>
          <button
            onClick={() => onShortlist(student._id)}
            disabled={student.canContact || shortlistingId === student._id}
            className={secondaryButtonClass}
            title={student.canContact ? "Messaging is already unlocked for this student." : undefined}
          >
            <ShieldCheck className="h-4 w-4" />
            {shortlistingId === student._id ? "Shortlisting..." : "Shortlist"}
          </button>
        </div>
      </div>
    </article>
  );
}

function InviteStudentModal({
  activeJobs,
  inviteNote,
  isLoadingJobs,
  isSubmitting,
  onClose,
  onCreateJob,
  onNoteChange,
  onInvite,
}: {
  activeJobs?: RecruiterJobDetail[];
  inviteNote: string;
  isLoadingJobs: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onCreateJob: () => void;
  onNoteChange: (value: string) => void;
  onInvite: (jobId: string) => void;
}) {
  const safeActiveJobs = activeJobs ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 px-4 backdrop-blur-sm">
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

          {isLoadingJobs ? (
            <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-5 text-sm text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
              Loading active jobs...
            </div>
          ) : safeActiveJobs.length > 0 ? (
            <div className="space-y-3">
              {safeActiveJobs.map((job) => (
                <div
                  key={job._id}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 lg:flex-row lg:items-center lg:justify-between"
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
                onClick={onCreateJob}
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-medium text-slate-100 transition hover:border-slate-600 hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                Create job role
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PlanHiringEventModal({
  form,
  activeJobs,
  isSubmitting,
  onChange,
  onClose,
  onSubmit,
}: {
  form: HiringEventPlanFormState;
  activeJobs: RecruiterJobDetail[];
  isSubmitting: boolean;
  onChange: (patch: Partial<HiringEventPlanFormState>) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const safeActiveJobs = activeJobs ?? [];
  const canSubmit =
    Boolean(form.collegeId) &&
    Boolean(form.title.trim()) &&
    Boolean(form.date) &&
    Boolean(form.description.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 px-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl shadow-black/40">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-6 py-5">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-cyan-300">College Approval</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">Plan a hiring event</h2>
            <p className="mt-2 text-sm text-slate-400">
              Send the event plan to {form.collegeName || "the college"} for approval. The event workspace opens
              after acceptance.
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

        <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Event Title</span>
            <input
              value={form.title}
              onChange={(event) => onChange({ title: event.target.value })}
              placeholder="Campus hiring showcase"
              className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50"
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Event Type</span>
            <select
              value={form.type}
              onChange={(event) =>
                onChange({ type: event.target.value as HiringEventPlanFormState["type"] })
              }
              className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/50"
            >
              {hiringEventTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Schedule</span>
            <input
              type="datetime-local"
              value={form.date}
              onChange={(event) => onChange({ date: event.target.value })}
              className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/50"
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Linked Job</span>
            <select
              value={form.linkedJobId}
              onChange={(event) => onChange({ linkedJobId: event.target.value })}
              className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/50"
            >
              <option value="">Link later</option>
              {safeActiveJobs.map((job) => (
                <option key={job._id} value={job._id}>
                  {job.title} / {job.company}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Description</span>
            <textarea
              value={form.description}
              onChange={(event) => onChange({ description: event.target.value })}
              rows={4}
              placeholder="Describe the format, target cohort, evaluation criteria, and recruiter intent."
              className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50"
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Minimum Score</span>
            <input
              type="number"
              min={0}
              value={form.minimumInnovationScore}
              onChange={(event) => onChange({ minimumInnovationScore: event.target.value })}
              className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/50"
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Approval Note</span>
            <input
              value={form.message}
              onChange={(event) => onChange({ message: event.target.value })}
              placeholder="Optional note for the college team"
              className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50"
            />
          </label>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-800 px-6 py-5">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Cancel
          </button>
          <button type="button" onClick={onSubmit} disabled={isSubmitting || !canSubmit} className={primaryButtonClass}>
            <CalendarDays className="h-4 w-4" />
            {isSubmitting ? "Sending..." : "Send for Approval"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PostJobRoleModal({
  form,
  error,
  isSubmitting,
  onChange,
  onClose,
  onSubmit,
}: {
  form: JobFormState;
  error: string | null;
  isSubmitting: boolean;
  onChange: (patch: Partial<JobFormState>) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 px-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl shadow-black/40">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-6 py-5">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-cyan-300">Recruiter Jobs</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">Post a job role</h2>
            <p className="mt-2 text-sm text-slate-400">
              Publish a recruiter role that can be used for direct invites, event-to-pipeline conversion, and student applications.
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
          {error ? (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Job Title</span>
              <input
                value={form.title}
                onChange={(event) => onChange({ title: event.target.value })}
                placeholder="Software Engineer"
                className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Company</span>
              <input
                value={form.company}
                onChange={(event) => onChange({ company: event.target.value })}
                placeholder="Acme Corp"
                className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Domain</span>
              <input
                value={form.domain}
                onChange={(event) => onChange({ domain: event.target.value })}
                placeholder="AI / ML"
                className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Location</span>
              <input
                value={form.location}
                onChange={(event) => onChange({ location: event.target.value })}
                placeholder="Bangalore, India"
                className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Type</span>
              <select
                value={form.type}
                onChange={(event) => onChange({ type: event.target.value as JobFormState["type"] })}
                className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/50"
              >
                <option value="Full-time">Full-time</option>
                <option value="Internship">Internship</option>
                <option value="Contract">Contract</option>
                <option value="Part-time">Part-time</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Work Mode</span>
              <select
                value={form.workMode}
                onChange={(event) => onChange({ workMode: event.target.value as JobFormState["workMode"] })}
                className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/50"
              >
                <option value="On-site">On-site</option>
                <option value="Hybrid">Hybrid</option>
                <option value="Remote">Remote</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Openings</span>
              <input
                type="number"
                min={1}
                value={form.openings}
                onChange={(event) => onChange({ openings: event.target.value })}
                className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/50"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Minimum Innovation Score</span>
              <input
                type="number"
                min={0}
                max={1000}
                value={form.minimumInnovationScore}
                onChange={(event) => onChange({ minimumInnovationScore: event.target.value })}
                className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/50"
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Job Description</span>
              <textarea
                rows={5}
                value={form.description}
                onChange={(event) => onChange({ description: event.target.value })}
                placeholder="Describe the role, responsibilities, and qualifications."
                className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50"
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-800 px-6 py-5">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Cancel
          </button>
          <button type="button" onClick={onSubmit} disabled={isSubmitting} className={primaryButtonClass}>
            <Plus className="h-4 w-4" />
            {isSubmitting ? "Posting..." : "Post Job Role"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RecruiterCollegeCardView({
  college,
  planningRequest,
  activeEventId,
  onViewStudents,
  onPlanEvent,
  onOpenEvent,
  onOpenRequest,
}: {
  college: RecruiterCollegeCard;
  planningRequest?: RecruiterEventPlanningRequest | null;
  activeEventId?: string | null;
  onViewStudents: (college: RecruiterCollegeCard) => void;
  onPlanEvent: (college: RecruiterCollegeCard) => void;
  onOpenEvent: (eventId: string) => void;
  onOpenRequest: (requestId: string) => void;
}) {
  const hasActiveEvent = Boolean(activeEventId);
  const isPendingApproval = planningRequest?.status === "pending" && !hasActiveEvent;
  const statusPill = hasActiveEvent
    ? "Event approved"
    : isPendingApproval
    ? "Approval pending"
    : planningRequest?.status === "declined"
    ? "Needs replan"
    : null;

  return (
    <article className="px-4 py-5 transition hover:bg-slate-900 sm:px-6">
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
                {statusPill ? (
                  <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-200">
                    {statusPill}
                  </span>
                ) : null}
              </div>
              <p className="text-sm font-medium text-cyan-100">{college.location}</p>
              <p className="max-w-3xl text-sm text-slate-300">{college.focusLabel}</p>
            </div>
          </div>

          <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div className="flex items-baseline gap-2">
              <dt className="text-slate-400">IIC</dt>
              <dd className="font-medium text-white">{college.iicStarRating.toFixed(1)} ★</dd>
            </div>
            <div className="flex items-baseline gap-2">
              <dt className="text-slate-400">Placement Rate</dt>
              <dd className="font-medium text-white">{college.placementVelocity}%</dd>
            </div>
            {college.placedStudents != null && (
              <div className="flex items-baseline gap-2">
                <dt className="text-slate-400">Placed</dt>
                <dd className="font-medium text-white">{college.placedStudents}</dd>
              </div>
            )}
            {college.activeStartups != null && (
              <div className="flex items-baseline gap-2">
                <dt className="text-slate-400">Active Startups</dt>
                <dd className="font-medium text-white">{college.activeStartups}</dd>
              </div>
            )}
            {college.avgPackage && (
              <div className="flex items-baseline gap-2">
                <dt className="text-slate-400">Avg Package</dt>
                <dd className="font-medium text-white">{college.avgPackage}</dd>
              </div>
            )}
          </dl>

          {college.topDomains && college.topDomains.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {college.topDomains.map((domain) => (
                <span key={domain} className={subtleTagClass}>
                  {domain}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 xl:justify-end">
          {hasActiveEvent && activeEventId ? (
            <button onClick={() => onOpenEvent(activeEventId)} className={secondaryButtonClass}>
              <CalendarDays className="h-4 w-4" />
              Open Event
            </button>
          ) : isPendingApproval && planningRequest ? (
            <button onClick={() => onOpenRequest(planningRequest._id)} className={secondaryButtonClass}>
              <Mail className="h-4 w-4" />
              Pending Approval
            </button>
          ) : (
            <button onClick={() => onPlanEvent(college)} className={secondaryButtonClass}>
              <Mail className="h-4 w-4" />
              Plan Hiring Event
            </button>
          )}
          <button
            onClick={() => onViewStudents(college)}
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
  const [eventPlanForm, setEventPlanForm] = useState<HiringEventPlanFormState>(createInitialHiringEventPlan());
  const [showJobModal, setShowJobModal] = useState(false);
  const [jobForm, setJobForm] = useState<JobFormState>(createInitialJobForm);
  const [jobFormError, setJobFormError] = useState<string | null>(null);
  const [studentFilters, setStudentFilters] = useState<StudentMarketplaceFilters>(
    createDefaultStudentFilters,
  );
  const [collegeFilters, setCollegeFilters] = useState<CollegeMarketplaceFilters>(
    createDefaultCollegeFilters,
  );
  const [inviteFeedback, setInviteFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [eventPlanFeedback, setEventPlanFeedback] = useState<{
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
  const eventPlanningRequestsQuery = useQuery({
    queryKey: ["requests", "outgoing", "college-event-invites"],
    queryFn: requestApi.outgoing,
    enabled: lane === "colleges",
  });
  const hiringEventsQuery = useQuery({
    queryKey: ["recruiter", "hiring-events"],
    queryFn: recruiterApi.getHiringEvents,
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
  const collegePlanningRequests = useMemo(
    () =>
      (eventPlanningRequestsQuery.data ?? []).filter(
        (request) => request.type === "college_event_invite" && request.targetEntityType === "college",
      ),
    [eventPlanningRequestsQuery.data],
  );
  const latestPlanningRequestByCollege = useMemo(
    () =>
      new Map(
        colleges.map((college) => [
          college._id,
          getLatestCollegeEventRequest(collegePlanningRequests, college._id),
        ]),
      ),
    [collegePlanningRequests, colleges],
  );
  const latestHiringEventByCollege = useMemo(() => {
    const eventMap = new Map<string, Awaited<ReturnType<typeof recruiterApi.getHiringEvents>>[number]>();

    (hiringEventsQuery.data ?? []).forEach((event) => {
      const current = eventMap.get(event.institutionId);
      if (!current || new Date(event.scheduledAt).getTime() > new Date(current.scheduledAt).getTime()) {
        eventMap.set(event.institutionId, event);
      }
    });

    return eventMap;
  }, [hiringEventsQuery.data]);

  const studentStageOptions = useMemo(
    () =>
      Array.from(
        new Set(
          students
            .map((student) => student.activeProject?.stage?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [students],
  );
  const studentSkillOptions = useMemo(() => {
    const counts = new Map<string, number>();

    students.forEach((student) => {
      (student.skills ?? []).forEach((skill) => {
        counts.set(skill, (counts.get(skill) ?? 0) + 1);
      });
    });

    return Array.from(counts.entries())
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 10)
      .map(([skill]) => skill);
  }, [students]);
  const collegeLocationOptions = useMemo(
    () =>
      Array.from(
        new Set(
          colleges
            .map((college) => college.location.trim())
            .filter(Boolean),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [colleges],
  );
  const collegeFocusOptions = useMemo(
    () =>
      Array.from(
        new Set(
          colleges
            .map((college) => college.focusLabel.trim())
            .filter(Boolean),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [colleges],
  );
  const filteredStudents = useMemo(
    () =>
      students.filter((student) => {
        if (studentFilters.contact === "open" && !student.canContact) {
          return false;
        }

        if (studentFilters.contact === "gated" && student.canContact) {
          return false;
        }

        if (student.innovationScore < studentFilters.minScore) {
          return false;
        }

        if (studentFilters.requireActiveProject && !student.activeProject) {
          return false;
        }

        if (
          studentFilters.stages.length > 0 &&
          !studentFilters.stages.includes(student.activeProject?.stage ?? "")
        ) {
          return false;
        }

        if (
          studentFilters.skills.length > 0 &&
          !studentFilters.skills.every((skill) => student.skills.includes(skill))
        ) {
          return false;
        }

        return true;
      }),
    [studentFilters, students],
  );
  const filteredColleges = useMemo(
    () =>
      colleges.filter((college) => {
        if (college.iicStarRating < collegeFilters.minRating) {
          return false;
        }

        if (college.placementVelocity < collegeFilters.minPlacementVelocity) {
          return false;
        }

        if (college.studentCount < collegeFilters.minStudents) {
          return false;
        }

        if (
          collegeFilters.focusLabels.length > 0 &&
          !collegeFilters.focusLabels.includes(college.focusLabel)
        ) {
          return false;
        }

        if (
          collegeFilters.locations.length > 0 &&
          !collegeFilters.locations.includes(college.location)
        ) {
          return false;
        }

        return true;
      }),
    [collegeFilters, colleges],
  );
  const studentActiveFilterCount =
    (studentFilters.contact !== "all" ? 1 : 0) +
    (studentFilters.minScore > 0 ? 1 : 0) +
    (studentFilters.requireActiveProject ? 1 : 0) +
    studentFilters.stages.length +
    studentFilters.skills.length;
  const collegeActiveFilterCount =
    (collegeFilters.minRating > 0 ? 1 : 0) +
    (collegeFilters.minPlacementVelocity > 0 ? 1 : 0) +
    (collegeFilters.minStudents > 0 ? 1 : 0) +
    collegeFilters.focusLabels.length +
    collegeFilters.locations.length;
  const activeFilterCount =
    lane === "students" ? studentActiveFilterCount : collegeActiveFilterCount;

  const totalCount =
    lane === "students" ? filteredStudents.length : filteredColleges.length;
  const isLoading = lane === "students" ? studentsQuery.isLoading : collegesQuery.isLoading;
  const isError = lane === "students" ? studentsQuery.isError : collegesQuery.isError;
  const resultSummaryLabel = `${formatCompactNumber(totalCount)} ${
    lane === "students" ? "student" : "college"
  }${totalCount === 1 ? "" : "s"}`;
  const jobSummaryTitle =
    activeJobs.length > 0
      ? `${formatCompactNumber(activeJobs.length)} active ${activeJobs.length === 1 ? "role" : "roles"}`
      : "No active roles";

  const inviteMutation = useMutation({
    mutationFn: (jobId: string) =>
      recruiterApi.inviteStudentToJob(
        jobId,
        inviteStudentId!,
        inviteNote.trim() ? { note: inviteNote.trim() } : undefined,
      ),
    onSuccess: async (result, jobId) => {
      const message = result.alreadyInvited
        ? "This student is already in that hiring pipeline."
        : result.alreadyApplied
          ? "The student already applied. The hiring bridge is now ready for follow-up."
          : "Invite sent. The student now has an application entry in their hiring flow.";
      setInviteFeedback({
        tone: "success",
        message,
      });
      appToast.success(message);
      const studentId = inviteStudentId;
      setInviteStudentId(null);
      setInviteNote("");
      await Promise.all([
        studentsQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ["recruiter", "jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["recruiter", "job-applications", jobId] }),
        queryClient.invalidateQueries({ queryKey: ["recruiter", "dashboard"] }),
      ]);
      if (studentId && !result.alreadyInvited) {
        navigate(`/dashboard/recruiter/applications/${studentId}?jobId=${jobId}`);
      }
    },
    onError: (error) => {
      const message = isAxiosError<{ error?: { message?: string } }>(error)
        ? error.response?.data?.error?.message ?? "Unable to invite this student right now."
        : error instanceof Error
          ? error.message
          : "Unable to invite this student right now.";
      setInviteFeedback({
        tone: "error",
        message,
      });
      appToast.error(message);
    },
  });
  const createJobMutation = useMutation({
    mutationFn: recruiterApi.createJob,
    onSuccess: async () => {
      const message = "Job role posted. It is now available for invites and event linking.";
      setJobForm(createInitialJobForm());
      setJobFormError(null);
      setShowJobModal(false);
      appToast.success(message);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["recruiter", "jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["recruiter", "dashboard"] }),
      ]);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Unable to post this job role right now.";
      setJobFormError(message);
      appToast.error(message);
    },
  });
  const planEventMutation = useMutation({
    mutationFn: () =>
      requestApi.create({
        requestType: "college_event_invite",
        actionType: "approve",
        toUserId: eventPlanForm.collegeId,
        targetEntityType: "college",
        targetEntityId: eventPlanForm.collegeId,
        targetEntityTitle: eventPlanForm.collegeName,
        targetRole: "college",
        requestedRole: "host",
        requestedPermission: "college_hiring_event",
        message: eventPlanForm.message.trim() || undefined,
        metadata: {
          entityName: eventPlanForm.title.trim(),
          title: eventPlanForm.title.trim(),
          type: eventPlanForm.type,
          date: new Date(eventPlanForm.date).toISOString(),
          description: eventPlanForm.description.trim(),
          minimumInnovationScore: Number(eventPlanForm.minimumInnovationScore || "0"),
          collegeId: eventPlanForm.collegeId,
          ...(eventPlanForm.linkedJobId ? { linkedJobId: eventPlanForm.linkedJobId } : {}),
        },
        deepLink: "/dashboard/invitations",
        acceptRedirect: "/dashboard/college/events?tab=hiring",
        declineRedirect: "/dashboard/invitations",
      }),
    onSuccess: async (request) => {
      const message = `Approval request sent to ${eventPlanForm.collegeName}. The event workspace will open once the college accepts.`;
      setEventPlanFeedback({
        tone: "success",
        message,
      });
      appToast.success(message);
      setEventPlanForm(createInitialHiringEventPlan());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["requests", "outgoing"] }),
        queryClient.invalidateQueries({ queryKey: ["recruiter", "hiring-events"] }),
      ]);
      navigate(`/dashboard/invitations?requestId=${request._id}`);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Unable to send the hiring event request right now.";
      setEventPlanFeedback({
        tone: "error",
        message,
      });
      appToast.error(message);
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

  const clearFilters = () => {
    if (lane === "students") {
      setStudentFilters(createDefaultStudentFilters());
      return;
    }

    setCollegeFilters(createDefaultCollegeFilters());
  };

  const handleShortlist = async (studentId: string) => {
    setShortlistingId(studentId);
    try {
      await recruiterApi.shortlistStudent(studentId);
      await studentsQuery.refetch();
      appToast.success("Student shortlisted.");
    } catch (error) {
      appToast.error(error instanceof Error ? error.message : "Unable to shortlist this student right now.");
    } finally {
      setShortlistingId(null);
    }
  };

  const handleViewCollegeStudents = (college: RecruiterCollegeCard) =>
    navigate(
      `/dashboard/recruiter/colleges/${college._id}/students?institution=${encodeURIComponent(college.displayName)}`,
    );

  const openJobModal = () => {
    setJobFormError(null);
    setShowJobModal(true);
  };

  const submitJob = () => {
    if (
      !jobForm.title.trim() ||
      !jobForm.company.trim() ||
      !jobForm.description.trim() ||
      !jobForm.domain.trim() ||
      !jobForm.location.trim()
    ) {
      setJobFormError("Title, company, domain, location and description are required.");
      return;
    }

    createJobMutation.mutate({
      title: jobForm.title.trim(),
      company: jobForm.company.trim(),
      description: jobForm.description.trim(),
      domain: jobForm.domain.trim(),
      type: jobForm.type,
      location: jobForm.location.trim(),
      workMode: jobForm.workMode,
      minimumInnovationScore: Number(jobForm.minimumInnovationScore) || 0,
      openings: jobForm.openings ? Number(jobForm.openings) : undefined,
    });
  };

  const openInviteModal = (studentId: string) => {
    if (jobsQuery.isError) {
      appToast.error("Recruiter jobs could not be loaded. Refresh and try again.");
      return;
    }

    setInviteFeedback(null);
    setInviteStudentId(studentId);
  };

  const openPlanEventModal = (college: RecruiterCollegeCard) => {
    const latestRequest = latestPlanningRequestByCollege.get(college._id);

    setEventPlanFeedback(null);
    setEventPlanForm({
      ...createInitialHiringEventPlan(college),
      ...(latestRequest?.metadata && typeof latestRequest.metadata === "object"
        ? {
            title:
              typeof latestRequest.metadata.title === "string"
                ? latestRequest.metadata.title
                : `${college.displayName} Hiring Event`,
            type:
              hiringEventTypes.find((type) => type === latestRequest.metadata?.type) ?? hiringEventTypes[0],
            date: parseRequestDateInput(
              typeof latestRequest.metadata.date === "string" ? latestRequest.metadata.date : undefined,
            ),
            description:
              typeof latestRequest.metadata.description === "string" ? latestRequest.metadata.description : "",
            linkedJobId:
              typeof latestRequest.metadata.linkedJobId === "string" ? latestRequest.metadata.linkedJobId : "",
            minimumInnovationScore:
              typeof latestRequest.metadata.minimumInnovationScore === "number" ||
              typeof latestRequest.metadata.minimumInnovationScore === "string"
                ? String(latestRequest.metadata.minimumInnovationScore)
                : "0",
            message: latestRequest.message ?? "",
          }
        : {}),
    });
  };

  return (
    <>
      <div className={`${RECRUITER_PAGE_CONTENT_CLASS} space-y-6`}>
        <RecruiterSectionNav items={recruiterMarketplaceSectionItems} />

        <section className="rounded-3xl border border-slate-800 bg-slate-950/90 px-4 py-4 sm:px-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),360px] xl:items-center xl:gap-6">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-[2.1rem]">
                  {activeTab.label}
                </h1>
                <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-300">
                  {formatCompactNumber(totalCount)} results
                </span>
                {focusedInstitution && lane === "students" ? (
                  <span className="rounded-full border border-slate-800 bg-slate-900/70 px-2.5 py-1 text-xs text-slate-200">
                    {focusedInstitution}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="space-y-3 xl:border-l xl:border-slate-800 xl:pl-6">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={query}
                  onChange={(event) => updateSearch(event.target.value)}
                  placeholder={lane === "students" ? "Search students, domains, or institutions" : "Search colleges or locations"}
                  className="h-10 w-full rounded-full border border-slate-800 bg-slate-900/70 pl-10 pr-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/45 focus:bg-slate-900"
                />
              </label>

              <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/45 px-3 py-2.5">
                <span className="text-sm font-medium text-slate-200">{jobSummaryTitle}</span>
                <button
                  type="button"
                  onClick={openJobModal}
                  className={`${primaryButtonClass} px-3 py-2 text-xs`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Post Job
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-4">
            {recruiterTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.id === lane;

              return (
                <button
                  key={tab.id}
                  onClick={() => handleLaneChange(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-100"
                      : "border-slate-800 bg-slate-950/35 text-slate-300 hover:border-slate-700 hover:bg-slate-900/60 hover:text-white"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                      isActive
                        ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-100"
                        : "border-slate-800 bg-slate-900/70 text-slate-500"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span>{tab.label}</span>
                </button>
              );
            })}

            <div className="flex flex-wrap items-center gap-2 xl:ml-auto">
              <span className="rounded-full bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200">
                {resultSummaryLabel}
              </span>
              {activeFilterCount > 0 ? (
                <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-sm font-medium text-cyan-100">
                  {activeFilterCount} active filter{activeFilterCount === 1 ? "" : "s"}
                </span>
              ) : null}
              {focusedInstitution && lane === "students" ? (
                <button
                  onClick={() => setSearchParams(buildSearchParams({ lane: "students", query }))}
                  className="rounded-full border border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-200 transition hover:border-cyan-400/40 hover:text-white"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>
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

        {eventPlanFeedback ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              eventPlanFeedback.tone === "success"
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
                : "border-rose-500/20 bg-rose-500/10 text-rose-100"
            }`}
          >
            {eventPlanFeedback.message}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[280px,minmax(0,1fr)]">
          <aside className={`h-fit rounded-2xl p-4 ${surfaceClass}`}>
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-cyan-300" />
                <div className="text-sm font-semibold text-white">Filters</div>
              </div>
              <div className="flex items-center gap-3">
                {activeFilterCount > 0 ? (
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-medium text-cyan-100">
                    {activeFilterCount}
                  </span>
                ) : null}
                {activeFilterCount > 0 ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-300 transition hover:text-cyan-200"
                  >
                    Clear all
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {lane === "students" ? (
                <>
                  <FilterSidebarSection title="Contact Access">
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: "all", label: "All" },
                        { id: "open", label: "Open" },
                        { id: "gated", label: "Gated" },
                      ].map((option) => (
                        <FilterOptionButton
                          key={option.id}
                          active={studentFilters.contact === option.id}
                          label={option.label}
                          onClick={() =>
                            setStudentFilters((current) => ({
                              ...current,
                              contact: option.id as StudentMarketplaceFilters["contact"],
                            }))
                          }
                        />
                      ))}
                    </div>
                  </FilterSidebarSection>

                  <FilterSidebarSection title="Minimum Score">
                    <div className="flex flex-wrap gap-2">
                      {[0, 150, 300, 500, 700].map((value) => (
                        <FilterOptionButton
                          key={value}
                          active={studentFilters.minScore === value}
                          label={value === 0 ? "Any" : `${value}+`}
                          onClick={() =>
                            setStudentFilters((current) => ({
                              ...current,
                              minScore: value,
                            }))
                          }
                        />
                      ))}
                    </div>
                  </FilterSidebarSection>

                  <FilterSidebarSection title="Project Signal">
                    <label className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-200">
                      <input
                        type="checkbox"
                        checked={studentFilters.requireActiveProject}
                        onChange={(event) =>
                          setStudentFilters((current) => ({
                            ...current,
                            requireActiveProject: event.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-cyan-400 focus:ring-cyan-400"
                      />
                      Active project only
                    </label>
                    {studentStageOptions.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {studentStageOptions.map((stage) => (
                          <FilterOptionButton
                            key={stage}
                            active={studentFilters.stages.includes(stage)}
                            label={stage}
                            onClick={() =>
                              setStudentFilters((current) => ({
                                ...current,
                                stages: toggleStringFilter(current.stages, stage),
                              }))
                            }
                          />
                        ))}
                      </div>
                    ) : null}
                  </FilterSidebarSection>

                  {studentSkillOptions.length > 0 ? (
                    <FilterSidebarSection title="Top Skills">
                      <div className="flex flex-wrap gap-2">
                        {studentSkillOptions.map((skill) => (
                          <FilterOptionButton
                            key={skill}
                            active={studentFilters.skills.includes(skill)}
                            label={skill}
                            onClick={() =>
                              setStudentFilters((current) => ({
                                ...current,
                                skills: toggleStringFilter(current.skills, skill),
                              }))
                            }
                          />
                        ))}
                      </div>
                    </FilterSidebarSection>
                  ) : null}
                </>
              ) : (
                <>
                  <FilterSidebarSection title="IIC Rating">
                    <div className="flex flex-wrap gap-2">
                      {[0, 2, 3, 4].map((value) => (
                        <FilterOptionButton
                          key={value}
                          active={collegeFilters.minRating === value}
                          label={value === 0 ? "Any" : `${value}+`}
                          onClick={() =>
                            setCollegeFilters((current) => ({
                              ...current,
                              minRating: value,
                            }))
                          }
                        />
                      ))}
                    </div>
                  </FilterSidebarSection>

                  <FilterSidebarSection title="Placement Velocity">
                    <div className="flex flex-wrap gap-2">
                      {[0, 25, 50, 75].map((value) => (
                        <FilterOptionButton
                          key={value}
                          active={collegeFilters.minPlacementVelocity === value}
                          label={value === 0 ? "Any" : `${value}%+`}
                          onClick={() =>
                            setCollegeFilters((current) => ({
                              ...current,
                              minPlacementVelocity: value,
                            }))
                          }
                        />
                      ))}
                    </div>
                  </FilterSidebarSection>

                  <FilterSidebarSection title="Student Base">
                    <div className="flex flex-wrap gap-2">
                      {[0, 250, 500, 1000].map((value) => (
                        <FilterOptionButton
                          key={value}
                          active={collegeFilters.minStudents === value}
                          label={value === 0 ? "Any" : `${value}+`}
                          onClick={() =>
                            setCollegeFilters((current) => ({
                              ...current,
                              minStudents: value,
                            }))
                          }
                        />
                      ))}
                    </div>
                  </FilterSidebarSection>

                  {collegeFocusOptions.length > 0 ? (
                    <FilterSidebarSection title="Focus">
                      <div className="flex flex-wrap gap-2">
                        {collegeFocusOptions.map((focus) => (
                          <FilterOptionButton
                            key={focus}
                            active={collegeFilters.focusLabels.includes(focus)}
                            label={focus}
                            onClick={() =>
                              setCollegeFilters((current) => ({
                                ...current,
                                focusLabels: toggleStringFilter(current.focusLabels, focus),
                              }))
                            }
                          />
                        ))}
                      </div>
                    </FilterSidebarSection>
                  ) : null}

                  {collegeLocationOptions.length > 0 ? (
                    <FilterSidebarSection title="Location">
                      <div className="flex flex-wrap gap-2">
                        {collegeLocationOptions.map((location) => (
                          <FilterOptionButton
                            key={location}
                            active={collegeFilters.locations.includes(location)}
                            label={location}
                            onClick={() =>
                              setCollegeFilters((current) => ({
                                ...current,
                                locations: toggleStringFilter(current.locations, location),
                              }))
                            }
                          />
                        ))}
                      </div>
                    </FilterSidebarSection>
                  ) : null}
                </>
              )}
            </div>
          </aside>

          <section className={`overflow-hidden rounded-2xl ${surfaceClass}`}>
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-300 sm:px-6">
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
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950 px-5 py-6">
                  <div className="text-sm font-medium text-white">
                    {lane === "students" ? "No talent found" : "No colleges found"}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {lane === "students"
                      ? "Try another student, domain, or institution search. You can also reset the current filters and review the full talent pool again."
                      : "Try another college or location search, or switch back to the student directory."}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setSearchParams(buildSearchParams({ lane }))}
                      className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-cyan-400/50 hover:bg-slate-800 hover:text-white"
                    >
                      Reset search
                    </button>
                    {activeFilterCount > 0 ? (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-cyan-400/50 hover:bg-slate-800 hover:text-white"
                      >
                        Reset filters
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleLaneChange(lane === "students" ? "colleges" : "students")}
                      className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-400/15"
                    >
                      Switch directory
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {!isLoading && !isError && totalCount > 0 ? (
              <div className="divide-y divide-slate-800">
                {lane === "students"
                  ? filteredStudents.map((student) => (
                      <RecruiterStudentCard
                        key={student._id}
                        student={student}
                        activeJobCount={activeJobs.length}
                        invitingStudentId={inviteMutation.isPending ? inviteStudentId : null}
                        shortlistingId={shortlistingId}
                        onInvite={openInviteModal}
                        onMessage={(studentId) => navigate(`/dashboard/messages/${studentId}`)}
                        onShortlist={handleShortlist}
                        onViewProfile={(studentId) => navigate(getStudentPortfolioViewPath(studentId))}
                      />
                    ))
                  : filteredColleges.map((college) => (
                      <RecruiterCollegeCardView
                        key={college._id}
                        college={college}
                        planningRequest={latestPlanningRequestByCollege.get(college._id)}
                        activeEventId={latestHiringEventByCollege.get(college._id)?._id ?? null}
                        onViewStudents={handleViewCollegeStudents}
                        onPlanEvent={openPlanEventModal}
                        onOpenEvent={(eventId) => navigate(`/dashboard/recruiter/hiring-events?eventId=${eventId}`)}
                        onOpenRequest={(requestId) => navigate(`/dashboard/invitations?requestId=${requestId}`)}
                      />
                    ))}
              </div>
            ) : null}
          </section>
        </div>
      </div>

      {inviteStudentId ? (
        <InviteStudentModal
          activeJobs={activeJobs}
          inviteNote={inviteNote}
          isLoadingJobs={jobsQuery.isLoading}
          isSubmitting={inviteMutation.isPending}
          onClose={() => {
            if (inviteMutation.isPending) return;
            setInviteStudentId(null);
            setInviteNote("");
          }}
          onCreateJob={() => {
            setInviteStudentId(null);
            setInviteNote("");
            openJobModal();
          }}
          onNoteChange={setInviteNote}
          onInvite={(jobId) => inviteMutation.mutate(jobId)}
        />
      ) : null}

      {eventPlanForm.collegeId ? (
        <PlanHiringEventModal
          form={eventPlanForm}
          activeJobs={activeJobs}
          isSubmitting={planEventMutation.isPending}
          onChange={(patch) => setEventPlanForm((current) => ({ ...current, ...patch }))}
          onClose={() => {
            if (planEventMutation.isPending) return;
            setEventPlanForm(createInitialHiringEventPlan());
          }}
          onSubmit={() => planEventMutation.mutate()}
        />
      ) : null}

      {showJobModal ? (
        <PostJobRoleModal
          form={jobForm}
          error={jobFormError}
          isSubmitting={createJobMutation.isPending}
          onChange={(patch) => setJobForm((current) => ({ ...current, ...patch }))}
          onClose={() => {
            if (createJobMutation.isPending) return;
            setShowJobModal(false);
            setJobForm(createInitialJobForm());
            setJobFormError(null);
          }}
          onSubmit={submitJob}
        />
      ) : null}
    </>
  );
}
