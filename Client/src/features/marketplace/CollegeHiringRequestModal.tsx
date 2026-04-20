import * as React from "react";
import { CalendarDays, Loader2, MapPin, Sparkles, Users, X } from "lucide-react";
import type { MarketplaceUserItem } from "../../api/marketplace.api";
import type {
  CreateWorkflowRequestPayload,
} from "../../api/request.api";
import type { AuthUser } from "../../types/auth.types";

export type CollegeHiringRequestTarget = Pick<
  MarketplaceUserItem,
  "_id" | "displayName" | "domain" | "location" | "headline" | "relatedCounts"
>;

export type CollegeHiringRequestFormState = {
  subject: string;
  innovationThemes: string;
  cohortSize: string;
  targetRoles: string;
  engagementFormat: string;
  pitchMessage: string;
};

const getCollegeName = (collegeUser?: AuthUser | null) =>
  collegeUser?.institutionProfile?.institutionName?.trim() ||
  collegeUser?.displayName ||
  "Our college";

const getCollegeLocation = (collegeUser?: AuthUser | null) =>
  collegeUser?.institutionProfile?.location?.trim() ||
  collegeUser?.location?.trim() ||
  "";

export const createInitialCollegeHiringRequestForm = ({
  collegeUser,
  target,
}: {
  collegeUser?: AuthUser | null;
  target: CollegeHiringRequestTarget;
}): CollegeHiringRequestFormState => {
  const collegeName = getCollegeName(collegeUser);
  const defaultTheme = target.domain?.trim() || "student innovation";

  return {
    subject: `${collegeName} student innovation pitch`,
    innovationThemes: defaultTheme,
    cohortSize: "",
    targetRoles: "",
    engagementFormat: "Hiring event / innovation showcase",
    pitchMessage: `We would like to present student innovators from ${collegeName} whose work aligns with your hiring needs. Our students can share innovation projects, execution proof, and role-fit context for your team.`,
  };
};

export const buildCollegeHiringRequestPayload = ({
  collegeUser,
  form,
  requestOrigin,
  target,
}: {
  collegeUser?: AuthUser | null;
  form: CollegeHiringRequestFormState;
  requestOrigin: string;
  target: CollegeHiringRequestTarget;
}): CreateWorkflowRequestPayload => {
  const collegeName = getCollegeName(collegeUser);
  const collegeLocation = getCollegeLocation(collegeUser);
  const cohortSizeValue = Number(form.cohortSize);

  return {
    requestType: "college_event_invite",
    actionType: "approve",
    toUserId: target._id,
    targetEntityType: "recruiter",
    targetEntityId: target._id,
    targetEntityTitle: target.displayName,
    targetRole: "recruiter",
    requestedRole: "hiring_event_partner",
    requestedPermission: "college_hiring_event_request",
    message: form.pitchMessage.trim(),
    metadata: {
      recruiterId: target._id,
      recruiterName: target.displayName,
      requestOrigin,
      eventRequestKind: "hiring_event",
      collegeName,
      ...(collegeLocation ? { collegeLocation } : {}),
      subject: form.subject.trim(),
      innovationThemes: form.innovationThemes.trim(),
      ...(Number.isFinite(cohortSizeValue) && cohortSizeValue > 0
        ? { cohortSize: cohortSizeValue }
        : {}),
      ...(form.targetRoles.trim()
        ? { targetRoles: form.targetRoles.trim() }
        : {}),
      ...(form.engagementFormat.trim()
        ? { engagementFormat: form.engagementFormat.trim() }
        : {}),
    },
    deepLink: "/dashboard/invitations",
    acceptRedirect: collegeUser?._id
      ? `/dashboard/messages/${collegeUser._id}`
      : "/dashboard/messages",
    declineRedirect: "/dashboard/invitations",
  };
};

export function CollegeHiringRequestModal({
  collegeUser,
  isSubmitting,
  onClose,
  onSubmit,
  target,
}: {
  collegeUser?: AuthUser | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (form: CollegeHiringRequestFormState) => void;
  target: CollegeHiringRequestTarget;
}) {
  const [form, setForm] = React.useState<CollegeHiringRequestFormState>(() =>
    createInitialCollegeHiringRequestForm({ collegeUser, target }),
  );

  const canSubmit =
    form.subject.trim().length >= 3 &&
    form.innovationThemes.trim().length >= 3 &&
    form.pitchMessage.trim().length >= 20;

  const helperCollegeName = getCollegeName(collegeUser);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl overflow-hidden rounded-[30px] border border-white/10 bg-[#070816] shadow-[0_30px_120px_rgba(15,23,42,0.55)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-100">
              <CalendarDays className="h-3.5 w-3.5" />
              Hiring Request
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              Pitch your student innovators to {target.displayName}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Send a structured request with your college context, innovation
              focus, and a clear pitch message. The recruiter will see this in
              Invitations.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-2xl border border-white/10 p-2 text-slate-400 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 md:col-span-2">
              <span className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Request Subject
              </span>
              <input
                value={form.subject}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    subject: event.target.value,
                  }))
                }
                maxLength={120}
                placeholder="College innovation pitch"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Innovation Focus
              </span>
              <input
                value={form.innovationThemes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    innovationThemes: event.target.value,
                  }))
                }
                maxLength={180}
                placeholder="AI, product engineering, robotics"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Cohort Size
              </span>
              <input
                type="number"
                min={0}
                value={form.cohortSize}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    cohortSize: event.target.value,
                  }))
                }
                placeholder="40"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Target Roles
              </span>
              <input
                value={form.targetRoles}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    targetRoles: event.target.value,
                  }))
                }
                maxLength={180}
                placeholder="Internships, product engineering, AI roles"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Engagement Format
              </span>
              <input
                value={form.engagementFormat}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    engagementFormat: event.target.value,
                  }))
                }
                maxLength={160}
                placeholder="Campus showcase, innovation pitch day"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50"
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Pitch Message
              </span>
              <textarea
                value={form.pitchMessage}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    pitchMessage: event.target.value,
                  }))
                }
                rows={7}
                maxLength={1000}
                placeholder="Explain why this recruiter should review your student innovators."
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50"
              />
              <div className="text-right text-xs text-slate-500">
                {form.pitchMessage.length}/1000
              </div>
            </label>
          </div>

          <aside className="space-y-4">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
                Sending From
              </div>
              <div className="mt-3 text-lg font-semibold text-white">
                {helperCollegeName}
              </div>
              {getCollegeLocation(collegeUser) ? (
                <div className="mt-1 text-sm text-slate-400">
                  {getCollegeLocation(collegeUser)}
                </div>
              ) : null}
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
                Recruiter Context
              </div>
              <div className="mt-3 text-lg font-semibold text-white">
                {target.displayName}
              </div>
              {target.headline ? (
                <div className="mt-1 text-sm text-slate-400">
                  {target.headline}
                </div>
              ) : null}
              <div className="mt-4 space-y-2 text-sm text-slate-300">
                {target.domain ? (
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-cyan-300" />
                    <span>{target.domain}</span>
                  </div>
                ) : null}
                {target.location ? (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-cyan-300" />
                    <span>{target.location}</span>
                  </div>
                ) : null}
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-cyan-300" />
                  <span>{target.relatedCounts.jobs} open jobs</span>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm leading-6 text-cyan-50">
              Use the message to pitch student innovation quality, proof of
              work, and why this recruiter should engage with your college.
            </div>
          </aside>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-white/10 px-6 py-5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSubmit(form)}
            disabled={!canSubmit || isSubmitting}
            className="inline-flex items-center gap-2 rounded-full bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CalendarDays className="h-4 w-4" />
            )}
            {isSubmitting ? "Sending..." : "Send Hiring Request"}
          </button>
        </div>
      </div>
    </div>
  );
}
