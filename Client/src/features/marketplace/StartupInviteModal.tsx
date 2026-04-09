import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BriefcaseBusiness,
  Rocket,
  Send,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { requestApi } from "../../api/request.api";
import { MarketplaceEntityType } from "../../api/marketplace.api";
import { startupApi } from "../../api/startup.api";
import { useAuthStore } from "../../store/authStore";
import { Startup } from "../../types/startup.types";
import { getApiErrorMessage } from "../../utils/apiError";

type StartupInviteTargetType = "student" | "mentor" | "investor";

export type StartupInviteTarget = {
  _id: string;
  entityType: StartupInviteTargetType;
  displayName: string;
  headline?: string;
  domain?: string;
  location?: string;
};

type StartupInviteConfig = {
  title: string;
  actionLabel: string;
  submitLabel: string;
  requestType: "startup_member" | "mentor_assignment" | "investor_startup_access";
  actionType: "join" | "mentor" | "invest";
  targetRole: string;
  roleLabel: string;
  rolePlaceholder: string;
  messageLabel: string;
  messagePlaceholder: string;
  helperText: string;
  suggestions: string[];
  icon: typeof Users;
};

const startupInviteConfigs: Record<StartupInviteTargetType, StartupInviteConfig> = {
  student: {
    title: "Startup teammate invite",
    actionLabel: "Invite",
    submitLabel: "Send invite",
    requestType: "startup_member",
    actionType: "join",
    targetRole: "student",
    roleLabel: "Proposed startup role",
    rolePlaceholder: "e.g. Founding engineer, Product designer",
    messageLabel: "Invite note",
    messagePlaceholder:
      "Explain what the startup is building, what this person will own, and why you want them on the team.",
    helperText:
      "This is a handshake invite. The teammate will receive a startup request and can accept or decline it.",
    suggestions: [
      "Founding engineer",
      "Product designer",
      "AI/ML builder",
      "Growth lead",
    ],
    icon: Users,
  },
  mentor: {
    title: "Startup mentor invite",
    actionLabel: "Invite",
    submitLabel: "Send mentor invite",
    requestType: "mentor_assignment",
    actionType: "mentor",
    targetRole: "mentor",
    roleLabel: "Mentor focus",
    rolePlaceholder: "e.g. GTM mentor, Product strategy mentor",
    messageLabel: "Mentorship note",
    messagePlaceholder:
      "Share the startup stage, where guidance is needed, and what kind of mentoring cadence you want.",
    helperText:
      "The mentor receives a startup mentorship request and chooses whether to accept or decline.",
    suggestions: [
      "Product strategy mentor",
      "Go-to-market mentor",
      "Technical architecture mentor",
      "Fundraising mentor",
    ],
    icon: Sparkles,
  },
  investor: {
    title: "Startup pitch request",
    actionLabel: "Pitch request",
    submitLabel: "Send pitch request",
    requestType: "investor_startup_access",
    actionType: "invest",
    targetRole: "investor",
    roleLabel: "Pitch ask",
    rolePlaceholder: "e.g. Seed pitch, Discovery call, Strategic investor intro",
    messageLabel: "Pitch note",
    messagePlaceholder:
      "Summarize the startup, traction, and why this investor is a fit for the pitch conversation.",
    helperText:
      "This sends a structured pitch request. The investor can accept or decline before the conversation advances.",
    suggestions: [
      "Discovery call",
      "Pitch deck review",
      "Seed investment pitch",
      "Strategic investor intro",
    ],
    icon: TrendingUp,
  },
};

const formatFundingNeeded = (value?: number) =>
  typeof value === "number"
    ? new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(value)
    : "Undisclosed";

const modalSectionClassName =
  "rounded-[22px] border border-white/10 bg-white/[0.03] p-4 sm:p-5";
const modalEyebrowClassName =
  "text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500";
const fieldClassName =
  "w-full rounded-2xl border border-slate-700/80 bg-slate-950/80 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:bg-slate-950";

export const isStartupInviteTargetType = (
  entityType: MarketplaceEntityType,
): entityType is StartupInviteTargetType =>
  entityType === "student" || entityType === "mentor" || entityType === "investor";

export const getStartupInviteActionLabel = (
  entityType: StartupInviteTargetType,
) => startupInviteConfigs[entityType].actionLabel;

const buildRequestMessage = (
  startup: Startup,
  target: StartupInviteTarget,
  requestedRole: string,
  note: string,
) => {
  const roleText = requestedRole.trim();
  const opener =
    target.entityType === "investor"
      ? `I would like to send a pitch request for ${startup.name} around ${roleText}.`
      : target.entityType === "mentor"
        ? `I would like to invite you to mentor ${startup.name} as ${roleText}.`
        : `I would like to invite you to join ${startup.name} as ${roleText}.`;

  const details = [
    opener,
    startup.tagline ? startup.tagline : "",
    `Category: ${startup.category}`,
    `Stage: ${startup.stage}`,
    `Funding Needed: ${formatFundingNeeded(startup.fundingNeeded)}`,
    note.trim(),
  ].filter(Boolean);

  return details.join("\n");
};

export function StartupInviteModal({
  isOpen,
  onClose,
  target,
  onSent,
}: {
  isOpen: boolean;
  onClose: () => void;
  target: StartupInviteTarget | null;
  onSent?: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((state) => state.user?._id);
  const [selectedStartupId, setSelectedStartupId] = useState("");
  const [requestedRole, setRequestedRole] = useState("");
  const [message, setMessage] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const config = target ? startupInviteConfigs[target.entityType] : null;

  const founderStartupsQuery = useQuery({
    queryKey: ["startup", "mine", "founder-managed"],
    queryFn: startupApi.mine,
    enabled: isOpen && Boolean(currentUserId),
    staleTime: 60_000,
  });

  const founderStartups =
    founderStartupsQuery.data?.filter((startup) =>
      currentUserId ? startup.founderIds.includes(currentUserId) : false,
    ) ?? [];

  const selectedStartup =
    founderStartups.find((startup) => startup._id === selectedStartupId) ?? null;

  useEffect(() => {
    if (!isOpen) {
      setSelectedStartupId("");
      setRequestedRole("");
      setMessage("");
      setSubmitError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !founderStartups.length) {
      return;
    }

    setSelectedStartupId((current) =>
      founderStartups.some((startup) => startup._id === current)
        ? current
        : founderStartups[0]._id,
    );
  }, [founderStartups, isOpen]);

  const sendInviteMutation = useMutation({
    mutationFn: async () => {
      if (!target || !config || !selectedStartup || !requestedRole.trim()) {
        return null;
      }

      return requestApi.create({
        requestType: config.requestType,
        actionType: config.actionType,
        toUserId: target._id,
        targetEntityType: "startup",
        targetEntityId: selectedStartup._id,
        targetEntityTitle: selectedStartup.name,
        targetRole: config.targetRole,
        requestedRole: requestedRole.trim(),
        message: buildRequestMessage(
          selectedStartup,
          target,
          requestedRole,
          message,
        ),
        metadata: {
          startupName: selectedStartup.name,
          startupStage: selectedStartup.stage,
          startupCategory: selectedStartup.category,
          startupTagline: selectedStartup.tagline,
          startupFundingNeeded: selectedStartup.fundingNeeded,
          requestedAudience: target.entityType,
          recipientName: target.displayName,
        },
        deepLink: `/marketplace/view/startup/${selectedStartup._id}`,
        acceptRedirect: `/marketplace/view/startup/${selectedStartup._id}`,
      });
    },
    onSuccess: async () => {
      if (!config || !target) {
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["requests"] }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      ]);
      onSent?.(
        target.entityType === "investor"
          ? `Pitch request sent to ${target.displayName}.`
          : `Startup invite sent to ${target.displayName}.`,
      );
      onClose();
    },
    onError: (error) => {
      setSubmitError(
        getApiErrorMessage(error, "Unable to send this startup request right now."),
      );
    },
  });

  if (!isOpen || !target || !config) {
    return null;
  }

  const Icon = config.icon;
  const canSubmit =
    Boolean(selectedStartup) &&
    Boolean(requestedRole.trim()) &&
    !sendInviteMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 px-4 py-4 backdrop-blur-md sm:px-6">
      <div className="flex max-h-[min(92vh,860px)] w-full max-w-[720px] flex-col overflow-hidden rounded-[30px] border border-white/10 bg-[#070816]/95 shadow-[0_30px_120px_rgba(15,23,42,0.65)]">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200 ring-1 ring-cyan-400/15">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.26em] text-cyan-300">
                Startup Handshake
              </div>
              <h2 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
                {config.title}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                {config.helperText}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-700/80 p-2 text-slate-400 transition hover:border-slate-500 hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="space-y-4">
            <div className={modalSectionClassName}>
              <div className={modalEyebrowClassName}>
                Recipient
              </div>
              <div className="mt-3 flex items-start gap-3 sm:gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_100%)] text-lg font-semibold text-white ring-1 ring-white/10">
                  {target.displayName.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-semibold text-white">
                    {target.displayName}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-400">
                    {target.headline ? <span>{target.headline}</span> : null}
                    {target.domain ? <span>{target.domain}</span> : null}
                    {target.location ? <span>{target.location}</span> : null}
                  </div>
                </div>
              </div>
            </div>

            {founderStartupsQuery.isLoading ? (
              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-slate-400">
                Loading your founder-managed startups...
              </div>
            ) : founderStartups.length === 0 ? (
              <div className="rounded-[22px] border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-100">
                <div className="font-semibold">Founder-managed startup required</div>
                <p className="mt-2 leading-6 text-amber-100/90">
                  Create or open a startup you own before sending team invites,
                  mentor requests, or investor pitch requests from the marketplace.
                </p>
              </div>
            ) : (
              <>
                <div className={modalSectionClassName}>
                  <div className={`flex items-center gap-2 ${modalEyebrowClassName}`}>
                    <Rocket className="h-4 w-4" />
                    Startup Context
                  </div>

                  {founderStartups.length > 1 ? (
                    <div className="mt-4">
                      <label className="mb-2 block text-sm font-medium text-slate-300">
                        Select startup
                      </label>
                      <select
                        value={selectedStartupId}
                        onChange={(event) =>
                          setSelectedStartupId(event.target.value)
                        }
                        className={`${fieldClassName} h-12`}
                      >
                        {founderStartups.map((startup) => (
                          <option
                            key={startup._id}
                            value={startup._id}
                            className="bg-slate-950"
                          >
                            {startup.name} - {startup.stage}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  {selectedStartup ? (
                    <div className="mt-4 rounded-[20px] border border-cyan-500/20 bg-cyan-500/[0.07] p-4 ring-1 ring-inset ring-cyan-500/10">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-lg font-semibold text-white">
                            {selectedStartup.name}
                          </div>
                          <p className="mt-1 text-sm leading-6 text-slate-300">
                            {selectedStartup.tagline}
                          </p>
                        </div>
                        <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-sm font-semibold text-cyan-100">
                          {selectedStartup.stage}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                        <span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5">
                          {selectedStartup.category}
                        </span>
                        <span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5">
                          Team {selectedStartup.teamSize}
                        </span>
                        <span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5">
                          Funding {formatFundingNeeded(selectedStartup.fundingNeeded)}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className={modalSectionClassName}>
                  <label className="block text-sm font-medium text-slate-200">
                    {config.roleLabel}
                  </label>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {config.suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setRequestedRole(suggestion)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                          requestedRole === suggestion
                            ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-100"
                            : "border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-500 hover:text-white"
                        }`}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                  <input
                    value={requestedRole}
                    onChange={(event) => setRequestedRole(event.target.value)}
                    placeholder={config.rolePlaceholder}
                    className={`${fieldClassName} mt-4 h-12`}
                  />
                </div>

                <div className={modalSectionClassName}>
                  <label className="block text-sm font-medium text-slate-200">
                    {config.messageLabel}
                  </label>
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder={config.messagePlaceholder}
                    rows={4}
                    className={`${fieldClassName} mt-3 min-h-[132px] resize-y py-3`}
                  />
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    The request includes the startup context and proposed role,
                    and the receiver can respond from Invitations.
                  </p>
                </div>
              </>
            )}

            {submitError ? (
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {submitError}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#070816]/95 px-5 py-4 sm:px-6">
          <div className="text-sm text-slate-500">
            Pending requests can be withdrawn later from Invitations.
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-slate-500 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setSubmitError(null);
                sendInviteMutation.mutate();
              }}
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 rounded-full bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
            >
              {target.entityType === "investor" ? (
                <BriefcaseBusiness className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {sendInviteMutation.isPending ? "Sending..." : config.submitLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
