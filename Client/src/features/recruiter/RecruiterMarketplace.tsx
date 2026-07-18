import { type ReactNode, useDeferredValue, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BriefcaseBusiness,
  Eye,
  Loader2,
  Mail,
  MapPin,
  Pause,
  Play,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { toast as appToast } from "../../components/ui/sonner";
import { recruiterApi } from "../../api/recruiter.api";
import { getStudentPortfolioViewPath } from "../marketplace/navigation";
import {
  RECRUITER_PAGE_CONTENT_CLASS,
  RecruiterSectionNav,
  recruiterMarketplaceSectionItems,
} from "./RecruiterSectionNav";
import {
  RecruiterJobDetail,
  RecruiterListResponse,
  RecruiterTalentSummary,
} from "../../types/recruiter.types";
import { UserRole } from "../../types/roles.types";

// ─── Types ────────────────────────────────────────────────────────────────────

type RecruiterPortalView = "jobs" | "talent";

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

// ─── Constants ────────────────────────────────────────────────────────────────

const surfaceClass =
  "border border-slate-800 bg-slate-900 shadow-[0_18px_40px_rgba(2,6,23,0.35)]";
const secondaryButtonClass =
  "inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-cyan-400/50 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900 disabled:text-slate-500";
const primaryButtonClass =
  "inline-flex items-center gap-2 rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-60";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatCompactNumber = (value: number) =>
  new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);

const getPortalView = (value: string | null): RecruiterPortalView =>
  value === "talent" ? "talent" : "jobs";

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

const toggleStringFilter = (current: string[], value: string) =>
  current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];

const mergeTalentResponses = (
  responses: Array<RecruiterListResponse<RecruiterTalentSummary>>,
): RecruiterListResponse<RecruiterTalentSummary> => {
  const itemMap = new Map<string, RecruiterTalentSummary>();
  responses.forEach((response) => {
    response.items.forEach((item) => {
      itemMap.set(item._id, item);
    });
  });
  const items = Array.from(itemMap.values()).sort(
    (left, right) => right.innovationScore - left.innovationScore,
  );
  return { items, page: 1, limit: 36, total: items.length, nextPage: null };
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
  if (!query) return recruiterApi.discoverTalent(baseParams);
  const searches = [
    recruiterApi.discoverTalent({ ...baseParams, search: query }),
    recruiterApi.discoverTalent({ ...baseParams, domain: query }),
  ];
  if (!institution) {
    searches.push(recruiterApi.discoverTalent({ ...baseParams, institution: query }));
  }
  return mergeTalentResponses(await Promise.all(searches));
};


// ─── Sub-components ───────────────────────────────────────────────────────────

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
  const skills = student.skills ?? [];
  const visibleSkills = skills.slice(0, 7);
  const remainingSkillCount = Math.max(skills.length - visibleSkills.length, 0);
  const inviteDisabled = activeJobCount === 0;

  return (
    <article className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-slate-900/60 sm:px-6">
      {/* Avatar + contact indicator */}
      <div className="relative mt-0.5 shrink-0">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-slate-800 text-sm font-semibold text-white ring-1 ring-white/10">
          {student.avatar ? (
            <img src={student.avatar} alt={student.displayName} className="h-10 w-10 object-cover" />
          ) : (
            student.displayName.slice(0, 1).toUpperCase()
          )}
        </div>
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-950 ${
            student.canContact ? "bg-emerald-400" : "bg-amber-400"
          }`}
          title={student.canContact ? "Contact open" : "Contact gated"}
        />
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1 space-y-2">
        {/* Name + score + contact badge */}
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <h2 className="text-[15px] font-semibold leading-snug text-white">
            {student.displayName}
          </h2>
          <span className="text-sm font-semibold text-cyan-300">{student.innovationScore}</span>
          <span
            className={`rounded-full px-2 py-px text-[11px] font-medium ${
              student.canContact
                ? "bg-emerald-400/10 text-emerald-300"
                : "bg-amber-400/10 text-amber-300"
            }`}
          >
            {student.canContact ? "Contact Open" : "Gated"}
          </span>
        </div>

        {/* Institution · Location · Project */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
          {student.institution?.name ? (
            <span className="font-medium text-slate-300">{student.institution.name}</span>
          ) : null}
          {student.institution?.location ? (
            <>
              <span className="text-slate-700">·</span>
              <span className="text-slate-400">{student.institution.location}</span>
            </>
          ) : null}
          {student.activeProject ? (
            <>
              <span className="text-slate-700">·</span>
              <span className="max-w-[180px] truncate text-slate-400">
                {student.activeProject.title}
              </span>
              <span className="rounded-full border border-slate-700 px-2 py-px text-[11px] text-slate-500">
                {student.activeProject.stage} · {student.activeProject.progressPercent}%
              </span>
            </>
          ) : null}
        </div>

        {/* Skills */}
        {visibleSkills.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {visibleSkills.map((skill) => (
              <span
                key={skill}
                className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-px text-[12px] text-slate-300"
              >
                {skill}
              </span>
            ))}
            {remainingSkillCount > 0 ? (
              <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-px text-[12px] text-slate-500">
                +{remainingSkillCount}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={() => onInvite(student._id)}
            disabled={invitingStudentId === student._id || inviteDisabled}
            title={inviteDisabled ? "No active jobs yet — post a job first." : undefined}
            className="inline-flex items-center gap-1.5 rounded-full bg-cyan-400 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <BriefcaseBusiness className="h-3.5 w-3.5" />
            {invitingStudentId === student._id ? "Inviting…" : "Invite to Job"}
          </button>
          <button
            onClick={() => onViewProfile(student._id)}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            <Eye className="h-3.5 w-3.5" />
            Profile
          </button>
          <button
            onClick={() => onMessage(student._id)}
            disabled={!student.canContact}
            title={!student.canContact ? "Shortlist to unlock messaging." : undefined}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Mail className="h-3.5 w-3.5" />
            Message
          </button>
          {!student.canContact ? (
            <button
              onClick={() => onShortlist(student._id)}
              disabled={shortlistingId === student._id}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-cyan-400/50 hover:text-white disabled:cursor-wait disabled:opacity-50"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {shortlistingId === student._id ? "…" : "Shortlist"}
            </button>
          ) : null}
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
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl shadow-black/40">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-800 px-6 py-5">
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

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
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
                      {job.applicantCount} applicants · {job.shortlistedCount} progressed · score cutoff{" "}
                      {job.minimumInnovationScore}
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
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl shadow-black/40">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-800 px-6 py-5">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-cyan-300">Global Hiring</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">Post a job role</h2>
            <p className="mt-2 text-sm text-slate-400">
              Publish a role visible to students on the marketplace. Applicants land directly in your
              hiring pipeline.
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

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
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
              <span className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Minimum Innovation Score
              </span>
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

        <div className="flex shrink-0 justify-end gap-3 border-t border-slate-800 px-6 py-5">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            className={primaryButtonClass}
          >
            <Plus className="h-4 w-4" />
            {isSubmitting ? "Posting..." : "Post Job Role"}
          </button>
        </div>
      </div>
    </div>
  );
}

function JobPortalCard({
  job,
  togglingJobId,
  onManage,
  onToggle,
  onInviteTalent,
}: {
  job: RecruiterJobDetail;
  togglingJobId: string | null;
  onManage: (jobId: string) => void;
  onToggle: (jobId: string, isActive: boolean) => void;
  onInviteTalent: () => void;
}) {
  const isToggling = togglingJobId === job._id;

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 transition hover:border-slate-700">
      {/* Title + status */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold leading-snug text-white">{job.title}</h3>
          <p className="mt-0.5 text-sm text-slate-400">{job.company}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
            job.isActive
              ? "bg-emerald-400/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/25"
              : "bg-slate-800 text-slate-500"
          }`}
        >
          {job.isActive ? "Active" : "Closed"}
        </span>
      </div>

      {/* Attribute tags */}
      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-full border border-slate-700 px-2.5 py-0.5 text-xs text-slate-300">
          {job.type}
        </span>
        {job.workMode ? (
          <span className="rounded-full border border-slate-700 px-2.5 py-0.5 text-xs text-slate-300">
            {job.workMode}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-2.5 py-0.5 text-xs text-slate-300">
          <MapPin className="h-3 w-3" />
          {job.location}
        </span>
        {job.domain ? (
          <span className="rounded-full border border-slate-700 px-2.5 py-0.5 text-xs text-slate-300">
            {job.domain}
          </span>
        ) : null}
      </div>

      {/* Stats grid */}
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-800 bg-slate-800 sm:grid-cols-4">
        {[
          { label: "Applicants", value: job.applicantCount, accent: "text-white" },
          { label: "Shortlisted", value: job.shortlistedCount, accent: "text-cyan-300" },
          { label: "Openings", value: job.openings ?? "—", accent: "text-white" },
          { label: "Score cutoff", value: `${job.minimumInnovationScore}+`, accent: "text-white" },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col gap-0.5 bg-slate-950 px-4 py-3">
            <dt className="text-[10px] uppercase tracking-widest text-slate-500">{stat.label}</dt>
            <dd className={`text-xl font-bold ${stat.accent}`}>{stat.value}</dd>
          </div>
        ))}
      </dl>

      {/* Description preview */}
      {job.description ? (
        <p className="line-clamp-2 text-sm leading-6 text-slate-400">{job.description}</p>
      ) : null}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3">
        <button type="button" onClick={() => onManage(job._id)} className={primaryButtonClass}>
          <BriefcaseBusiness className="h-4 w-4" />
          Manage Applications
        </button>
        <button type="button" onClick={onInviteTalent} className={secondaryButtonClass}>
          <Users className="h-4 w-4" />
          Invite Talent
        </button>
        <button
          type="button"
          onClick={() => onToggle(job._id, job.isActive)}
          disabled={isToggling}
          className={`${secondaryButtonClass} ml-auto`}
          title={job.isActive ? "Pause this job posting" : "Reactivate this job posting"}
        >
          {job.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {isToggling ? "..." : job.isActive ? "Pause" : "Activate"}
        </button>
      </div>
    </article>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function RecruiterMarketplace({ dashboardRole: _dashboardRole }: { dashboardRole: UserRole }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const view = getPortalView(searchParams.get("view"));
  const query = searchParams.get("q") ?? "";
  const focusedInstitution = searchParams.get("institution") ?? "";
  const deferredQuery = useDeferredValue(query);

  const [shortlistingId, setShortlistingId] = useState<string | null>(null);
  const [inviteStudentId, setInviteStudentId] = useState<string | null>(null);
  const [inviteNote, setInviteNote] = useState("");
  const [showJobModal, setShowJobModal] = useState(false);
  const [jobForm, setJobForm] = useState<JobFormState>(createInitialJobForm);
  const [jobFormError, setJobFormError] = useState<string | null>(null);
  const [studentFilters, setStudentFilters] = useState<StudentMarketplaceFilters>(
    createDefaultStudentFilters,
  );
  const [inviteFeedback, setInviteFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [togglingJobId, setTogglingJobId] = useState<string | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────────

  const studentsQuery = useQuery({
    queryKey: ["marketplace", "recruiter", "students", deferredQuery, focusedInstitution],
    queryFn: () => listRecruiterMarketplaceStudents(deferredQuery, focusedInstitution),
    enabled: view === "talent",
  });

  const jobsQuery = useQuery({
    queryKey: ["recruiter", "jobs"],
    queryFn: recruiterApi.getJobs,
  });

  // ── Derived data ───────────────────────────────────────────────────────────

  const jobs = jobsQuery.data ?? [];
  const activeJobs = useMemo(() => jobs.filter((job) => job.isActive), [jobs]);
  const students = studentsQuery.data?.items ?? [];

  const jobStats = useMemo(
    () => ({
      total: jobs.length,
      active: activeJobs.length,
      applicants: jobs.reduce((sum, job) => sum + job.applicantCount, 0),
      shortlisted: jobs.reduce((sum, job) => sum + job.shortlistedCount, 0),
    }),
    [jobs, activeJobs],
  );

  const studentStageOptions = useMemo(
    () =>
      Array.from(
        new Set(
          students
            .map((s) => s.activeProject?.stage?.trim())
            .filter((v): v is string => Boolean(v)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [students],
  );

  const studentSkillOptions = useMemo(() => {
    const counts = new Map<string, number>();
    students.forEach((s) => {
      (s.skills ?? []).forEach((skill) => counts.set(skill, (counts.get(skill) ?? 0) + 1));
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 10)
      .map(([skill]) => skill);
  }, [students]);

  const filteredStudents = useMemo(
    () =>
      students.filter((s) => {
        if (studentFilters.contact === "open" && !s.canContact) return false;
        if (studentFilters.contact === "gated" && s.canContact) return false;
        if (s.innovationScore < studentFilters.minScore) return false;
        if (studentFilters.requireActiveProject && !s.activeProject) return false;
        if (
          studentFilters.stages.length > 0 &&
          !studentFilters.stages.includes(s.activeProject?.stage ?? "")
        )
          return false;
        if (
          studentFilters.skills.length > 0 &&
          !studentFilters.skills.every((skill) => s.skills.includes(skill))
        )
          return false;
        return true;
      }),
    [studentFilters, students],
  );

  const studentActiveFilterCount =
    (studentFilters.contact !== "all" ? 1 : 0) +
    (studentFilters.minScore > 0 ? 1 : 0) +
    (studentFilters.requireActiveProject ? 1 : 0) +
    studentFilters.stages.length +
    studentFilters.skills.length;

  // ── Mutations ──────────────────────────────────────────────────────────────

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
      setInviteFeedback({ tone: "success", message });
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
        ? (error.response?.data?.error?.message ?? "Unable to invite this student right now.")
        : error instanceof Error
          ? error.message
          : "Unable to invite this student right now.";
      setInviteFeedback({ tone: "error", message });
      appToast.error(message);
    },
  });

  const createJobMutation = useMutation({
    mutationFn: recruiterApi.createJob,
    onSuccess: async () => {
      const message = "Job role posted. It is now visible in your portal and open for applications.";
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
      const message =
        error instanceof Error ? error.message : "Unable to post this job role right now.";
      setJobFormError(message);
      appToast.error(message);
    },
  });

  const toggleJobMutation = useMutation({
    mutationFn: ({ jobId, isActive }: { jobId: string; isActive: boolean }) =>
      recruiterApi.updateJob(jobId, { isActive }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["recruiter", "jobs"] });
      setTogglingJobId(null);
    },
    onError: (error) => {
      appToast.error(
        error instanceof Error ? error.message : "Unable to update this job right now.",
      );
      setTogglingJobId(null);
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  const setView = (nextView: RecruiterPortalView) => {
    const params = new URLSearchParams();
    if (nextView !== "jobs") params.set("view", nextView);
    setSearchParams(params);
  };

  const updateSearch = (nextQuery: string) => {
    const params = new URLSearchParams(searchParams);
    if (nextQuery) params.set("q", nextQuery);
    else params.delete("q");
    setSearchParams(params);
  };

  const clearFilters = () => setStudentFilters(createDefaultStudentFilters());

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

  const handleShortlist = async (studentId: string) => {
    setShortlistingId(studentId);
    try {
      await recruiterApi.shortlistStudent(studentId);
      await studentsQuery.refetch();
      appToast.success("Student shortlisted.");
    } catch (error) {
      appToast.error(
        error instanceof Error ? error.message : "Unable to shortlist this student right now.",
      );
    } finally {
      setShortlistingId(null);
    }
  };

  const handleToggleJob = (jobId: string, isActive: boolean) => {
    setTogglingJobId(jobId);
    toggleJobMutation.mutate({ jobId, isActive: !isActive });
  };

  const handleManageJob = (jobId: string) => {
    navigate(`/dashboard/recruiter/applications?jobId=${jobId}`);
  };

  const handleInviteTalentForJob = () => setView("talent");

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className={`${RECRUITER_PAGE_CONTENT_CLASS} space-y-6`}>

        {/* Section nav — same position as ApplicationsPipeline */}
        <RecruiterSectionNav items={recruiterMarketplaceSectionItems} />

        {/* Page header */}
        <section className="rounded-3xl border border-slate-800 bg-slate-950/90 px-5 py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Global Hiring</div>
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                {view === "jobs" ? "Job Portal" : "Talent Pool"}
              </h1>
              <p className="text-sm leading-6 text-slate-400">
                {view === "jobs"
                  ? "Manage your open roles and incoming applications from the ProMove talent pool."
                  : "Discover and invite top student innovators directly into your hiring pipeline."}
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-3">
              {/* View toggle pill */}
              <div className="flex rounded-full border border-slate-800 bg-slate-950 p-1">
                {(["jobs", "talent"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                      view === v
                        ? "bg-slate-100 text-slate-950"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {v === "jobs" ? "Job Portal" : "Talent Pool"}
                  </button>
                ))}
              </div>

              {/* Post job — always visible */}
              <button type="button" onClick={openJobModal} className={primaryButtonClass}>
                <Plus className="h-4 w-4" />
                Post Job
              </button>
            </div>
          </div>

          {/* Talent search bar */}
          {view === "talent" ? (
            <div className="mt-4 border-t border-slate-800 pt-4">
              <label className="relative block max-w-xl">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={query}
                  onChange={(event) => updateSearch(event.target.value)}
                  placeholder="Search students, domains, or institutions"
                  className="h-10 w-full rounded-full border border-slate-800 bg-slate-900/70 pl-10 pr-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/45 focus:bg-slate-900"
                />
              </label>
            </div>
          ) : null}
        </section>

        {/* Invite feedback */}
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

        {/* ═══ JOBS VIEW ════════════════════════════════════════════════════ */}
        {view === "jobs" ? (
          <div className="space-y-6">

            {/* Stats row */}
            {jobs.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: "Active Roles", value: jobStats.active, accent: "text-emerald-300" },
                  { label: "Total Roles", value: jobStats.total, accent: "text-white" },
                  { label: "Total Applicants", value: jobStats.applicants, accent: "text-cyan-300" },
                  { label: "Shortlisted", value: jobStats.shortlisted, accent: "text-amber-300" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-slate-800 bg-slate-900 px-5 py-4"
                  >
                    <div className={`text-3xl font-bold ${stat.accent}`}>
                      {formatCompactNumber(stat.value)}
                    </div>
                    <div className="mt-1 text-sm text-slate-400">{stat.label}</div>
                  </div>
                ))}
              </div>
            ) : null}

            {/* Job grid */}
            {jobsQuery.isLoading ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 px-5 py-12 text-center text-sm text-slate-400">
                Loading job postings...
              </div>
            ) : jobs.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {jobs.map((job) => (
                  <JobPortalCard
                    key={job._id}
                    job={job}
                    togglingJobId={togglingJobId}
                    onManage={handleManageJob}
                    onToggle={handleToggleJob}
                    onInviteTalent={handleInviteTalentForJob}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-800 bg-slate-950 px-6 py-20 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300 ring-1 ring-inset ring-cyan-400/20">
                  <BriefcaseBusiness className="h-6 w-6" />
                </div>
                <h2 className="mt-5 text-xl font-semibold text-white">No job postings yet</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
                  Post your first role to start receiving applications from the ProMove talent pool.
                  Students discover and apply directly from their marketplace.
                </p>
                <button
                  type="button"
                  onClick={openJobModal}
                  className={`${primaryButtonClass} mt-6`}
                >
                  <Plus className="h-4 w-4" />
                  Post Your First Job
                </button>
              </div>
            )}
          </div>
        ) : null}

        {/* ═══ TALENT VIEW ══════════════════════════════════════════════════ */}
        {view === "talent" ? (
          <div className="grid gap-6 xl:grid-cols-[280px,minmax(0,1fr)]">

            {/* Filter sidebar */}
            <aside className={`h-fit rounded-2xl p-4 ${surfaceClass}`}>
              <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-cyan-300" />
                  <div className="text-sm font-semibold text-white">Filters</div>
                </div>
                <div className="flex items-center gap-3">
                  {studentActiveFilterCount > 0 ? (
                    <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-medium text-cyan-100">
                      {studentActiveFilterCount}
                    </span>
                  ) : null}
                  {studentActiveFilterCount > 0 ? (
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
                <FilterSidebarSection title="Contact Access">
                  <div className="flex flex-wrap gap-2">
                    {(["all", "open", "gated"] as const).map((id) => (
                      <FilterOptionButton
                        key={id}
                        active={studentFilters.contact === id}
                        label={id.charAt(0).toUpperCase() + id.slice(1)}
                        onClick={() =>
                          setStudentFilters((c) => ({ ...c, contact: id }))
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
                        onClick={() => setStudentFilters((c) => ({ ...c, minScore: value }))}
                      />
                    ))}
                  </div>
                </FilterSidebarSection>

                <FilterSidebarSection title="Project Signal">
                  <label className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={studentFilters.requireActiveProject}
                      onChange={(e) =>
                        setStudentFilters((c) => ({
                          ...c,
                          requireActiveProject: e.target.checked,
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
                            setStudentFilters((c) => ({
                              ...c,
                              stages: toggleStringFilter(c.stages, stage),
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
                            setStudentFilters((c) => ({
                              ...c,
                              skills: toggleStringFilter(c.skills, skill),
                            }))
                          }
                        />
                      ))}
                    </div>
                  </FilterSidebarSection>
                ) : null}
              </div>
            </aside>

            {/* Student results */}
            <section className={`overflow-hidden rounded-2xl ${surfaceClass}`}>
              <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-300 sm:px-6">
                <span>Talent Results</span>
                <span>{formatCompactNumber(filteredStudents.length)}</span>
              </div>

              {studentsQuery.isLoading ? (
                <div className="px-4 py-10 text-sm text-slate-300 sm:px-6">
                  Loading talent pool...
                </div>
              ) : studentsQuery.isError ? (
                <div className="px-4 py-5 text-sm text-rose-200 sm:px-6">
                  Unable to load the talent pool right now.
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="px-4 py-10 sm:px-6">
                  <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950 px-5 py-6">
                    <div className="text-sm font-medium text-white">No talent found</div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      Try another student, domain, or institution search, or reset the current
                      filters.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => setSearchParams({ view: "talent" })}
                        className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-cyan-400/50 hover:bg-slate-800 hover:text-white"
                      >
                        Reset search
                      </button>
                      {studentActiveFilterCount > 0 ? (
                        <button
                          type="button"
                          onClick={clearFilters}
                          className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-cyan-400/50 hover:bg-slate-800 hover:text-white"
                        >
                          Reset filters
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {filteredStudents.map((student) => (
                    <RecruiterStudentCard
                      key={student._id}
                      student={student}
                      activeJobCount={activeJobs.length}
                      invitingStudentId={inviteMutation.isPending ? inviteStudentId : null}
                      shortlistingId={shortlistingId}
                      onInvite={openInviteModal}
                      onMessage={(studentId) => navigate(`/dashboard/messages/${studentId}`)}
                      onShortlist={handleShortlist}
                      onViewProfile={(studentId) =>
                        navigate(getStudentPortfolioViewPath(studentId))
                      }
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : null}
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}

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
