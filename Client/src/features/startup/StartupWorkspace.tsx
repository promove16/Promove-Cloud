import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Plus, Users } from "lucide-react";
import { Navigate, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { dealApi } from "../../api/deal.api";
import { startupApi } from "../../api/startup.api";
import { workspaceApi } from "../../api/workspace.api";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Spinner } from "../../components/ui/Spinner";
import { useAuthStore } from "../../store/authStore";
import type { Workspace } from "../../types/workspace.types";
import { normalizeStartupRouteId } from "./navigation";

const getErrorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
  (error instanceof Error ? error.message : fallback);

type WorkspacePreview = Pick<Workspace, "_id" | "title" | "category" | "stage" | "progressPercent"> & {
  teamMembers?: Workspace["teamMembers"];
  teamMemberIds?: Workspace["teamMemberIds"];
};

export function StartupWorkspace() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { startupId: paramId } = useParams<{ startupId: string }>();
  const context = useOutletContext<{ startupId?: string }>();
  const currentUser = useAuthStore((state) => state.user);
  const startupId = context?.startupId ?? normalizeStartupRouteId(paramId);
  const isReadOnlyViewer = currentUser?.role === "investor";
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [feedback, setFeedback] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ title: "", category: "" });

  const startupQuery = useQuery({
    queryKey: ["startup", startupId],
    queryFn: () => startupApi.getById(startupId!),
    enabled: Boolean(startupId),
  });
  const startup = startupQuery.data;
  const workspaceListQuery = useQuery({
    queryKey: ["workspaces"],
    queryFn: workspaceApi.list,
    enabled: !isReadOnlyViewer,
  });
  const directWorkspaceQuery = useQuery({
    queryKey: ["workspace", startup?.projectId, "startup-readonly"],
    queryFn: () => workspaceApi.getById(startup!.projectId!),
    enabled: isReadOnlyViewer && Boolean(startup?.projectId),
    retry: false,
  });
  const investorDealsQuery = useQuery({
    queryKey: ["investor-deals", "startup-workshop", startupId],
    queryFn: dealApi.getInvestorDeals,
    enabled: isReadOnlyViewer && Boolean(startupId),
    staleTime: 60_000,
  });

  const isEditingLocked = Boolean(startup?.editAccess?.isLocked);
  const isWorkspaceSelectionDisabled = isEditingLocked || isReadOnlyViewer;
  const workspaces = workspaceListQuery.data ?? [];
  const linkedWorkspace = useMemo(
    () => (startup?.projectId ? workspaces.find((workspace) => workspace._id === startup.projectId) ?? null : null),
    [workspaces, startup?.projectId],
  );
  const availableWorkspaces = useMemo(() => {
    const base = workspaces.filter((workspace) => !workspace.claimedProblemId);
    if (linkedWorkspace && !base.some((workspace) => workspace._id === linkedWorkspace._id)) {
      return [linkedWorkspace, ...base];
    }
    return base;
  }, [workspaces, linkedWorkspace]);
  const investorWorkshopSummary = useMemo(() => {
    if (!isReadOnlyViewer || !startupId) {
      return null;
    }

    const deals = (investorDealsQuery.data ?? []).flatMap((group) => group.deals);
    return deals.find((deal) => deal.startupId === startupId)?.productWorkshop ?? null;
  }, [investorDealsQuery.data, isReadOnlyViewer, startupId]);
  const activeWorkspace = useMemo<WorkspacePreview | null>(() => {
    if (isReadOnlyViewer) {
      if (directWorkspaceQuery.data) {
        return directWorkspaceQuery.data;
      }

      if (investorWorkshopSummary) {
        return {
          _id: investorWorkshopSummary.workspaceId,
          title: investorWorkshopSummary.title,
          category: investorWorkshopSummary.category,
          stage: investorWorkshopSummary.stage as Workspace["stage"],
          progressPercent: investorWorkshopSummary.progressPercent,
          teamMembers: [],
          teamMemberIds: [],
        };
      }

      return null;
    }

    return workspaces.find((workspace) => workspace._id === selectedWorkspaceId) ?? null;
  }, [directWorkspaceQuery.data, investorWorkshopSummary, isReadOnlyViewer, selectedWorkspaceId, workspaces]);
  const isInvestorSummaryFallback =
    isReadOnlyViewer && !directWorkspaceQuery.data && Boolean(investorWorkshopSummary);

  useEffect(() => {
    setSelectedWorkspaceId(startup?.projectId ?? "");
  }, [startup?.projectId]);

  const startupUnlockRequestPath = useMemo(() => {
    if (!startupId) {
      return "/dashboard/help-desk/new?category=startup_patent";
    }

    const params = new URLSearchParams({
      category: "startup_patent",
      priority: "medium",
      relatedEntityType: "startup",
      relatedEntityId: startupId,
      referenceText: startup?.name ?? "Startup workspace lock",
      title: `Request workspace edit unlock for ${startup?.name ?? "startup"}`,
      description:
        `The startup is locked and I need admin approval to update the linked product workspace.\n\n` +
        `Startup: ${startup?.name ?? "Unknown startup"}\n` +
        `Current review status: ${startup?.reviewStatus ?? "draft"}\n` +
        `Reason shown: ${startup?.editAccess?.reason ?? "Profile is locked for review governance."}`,
    });

    return `/dashboard/help-desk/new?${params.toString()}`;
  }, [startup?.editAccess?.reason, startup?.name, startup?.reviewStatus, startupId]);

  const saveWorkspaceLink = useMutation({
    mutationFn: async () => {
      if (!startupId) {
        throw new Error("Startup not found.");
      }

      const nextTeamSize =
        activeWorkspace?.teamMembers?.length ??
        activeWorkspace?.teamMemberIds?.length ??
        startup?.teamSize ??
        1;

      return startupApi.update(startupId, {
        projectId: selectedWorkspaceId || undefined,
        teamSize: nextTeamSize,
      });
    },
    onSuccess: async (savedStartup) => {
      queryClient.setQueryData(["startup", savedStartup._id], savedStartup);
      setFeedback(
        selectedWorkspaceId
          ? "Product workspace linked to this startup."
          : "Product workspace removed from this startup.",
      );
      await queryClient.invalidateQueries({ queryKey: ["startup"] });
    },
    onError: () => {
      setFeedback("Unable to update the product workspace link right now.");
    },
  });
  const createWorkspace = useMutation({
    mutationFn: async () => {
      const title = createForm.title.trim();
      const category = createForm.category.trim();

      if (!title || !category) {
        throw new Error("Workspace title and category are required.");
      }

      return workspaceApi.create({ title, category });
    },
    onSuccess: async (workspace) => {
      setCreateForm({ title: "", category: "" });
      setSelectedWorkspaceId(workspace._id);
      setShowCreateForm(false);
      setFeedback("Independent workspace created. Save the workspace link to attach it to this startup.");
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
    onError: (error) => {
      setFeedback(getErrorMessage(error, "Unable to create an independent workspace right now."));
    },
  });

  if (!startupId) {
    return (
      <Card className="p-6 text-sm text-rose-200">
        Startup not found.
      </Card>
    );
  }

  const isWorkspaceLoading = isReadOnlyViewer
    ? investorDealsQuery.isLoading || (Boolean(startup?.projectId) && directWorkspaceQuery.isLoading)
    : workspaceListQuery.isLoading;

  if (startupQuery.isLoading || isWorkspaceLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (startupQuery.isError) {
    return (
      <Card className="p-6 text-sm text-rose-200">
        Unable to load this startup workspace section right now.
      </Card>
    );
  }

  if (isReadOnlyViewer && directWorkspaceQuery.data && activeWorkspace?._id) {
    return <Navigate to={`/product-workspace/${activeWorkspace._id}`} replace />;
  }

  const founderMembers = activeWorkspace?.teamMembers ?? [];
  return (
    <div className="space-y-6">
      {isInvestorSummaryFallback ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Detailed workspace access has not synced to this investor account yet. Showing the linked workshop summary from the deal record.
        </div>
      ) : null}

      {feedback ? (
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
          {feedback}
        </div>
      ) : null}

      {isEditingLocked && !isReadOnlyViewer ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {startup?.editAccess.reason}
          <button
            type="button"
            onClick={() => navigate(startupUnlockRequestPath)}
            className="ml-3 font-semibold text-cyan-200 underline underline-offset-4"
          >
            Raise Smart Help request
          </button>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),360px]">
        <Card className="p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
              <Link2 className="h-4 w-4" />
              Workspace Link
            </div>
            {!isReadOnlyViewer ? (
              <button
                type="button"
                onClick={() => {
                  setFeedback("");
                  setShowCreateForm((current) => !current);
                }}
                disabled={isEditingLocked || createWorkspace.isPending}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                {showCreateForm ? "Close" : "Create Workspace"}
              </button>
            ) : null}
          </div>
          <label className="mb-2 block text-sm font-semibold text-white">
            {isReadOnlyViewer ? "Linked independent product workspace" : "Select independent product workspace"}
          </label>
          <select
            value={selectedWorkspaceId}
            onChange={(event) => setSelectedWorkspaceId(event.target.value)}
            disabled={isWorkspaceSelectionDisabled}
            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-400/50"
          >
            <option value="">No linked workspace</option>
            {isReadOnlyViewer && activeWorkspace ? (
              <option value={activeWorkspace._id}>{activeWorkspace.title}</option>
            ) : null}
            {availableWorkspaces.map((workspace) => (
              <option key={workspace._id} value={workspace._id}>
                {workspace.title}
              </option>
            ))}
          </select>

          {availableWorkspaces.length === 0 && (!isReadOnlyViewer || !activeWorkspace) ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-800 bg-slate-950/60 px-4 py-4 text-sm text-slate-400">
              {isReadOnlyViewer
                ? "No linked independent workspace is available for investor review yet."
                : "No independent workspace exists yet for this account. Create one here, then save the link to attach it to this startup."}
            </div>
          ) : null}

          {showCreateForm && !isReadOnlyViewer ? (
            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="text-sm font-semibold text-white">Create independent workspace</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Workspace Title
                  </label>
                  <Input
                    value={createForm.title}
                    onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="e.g. ProMove Product Build"
                    disabled={isEditingLocked || createWorkspace.isPending}
                    className="rounded-xl border-slate-800 bg-slate-950 text-white placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Category
                  </label>
                  <Input
                    value={createForm.category}
                    onChange={(event) => setCreateForm((current) => ({ ...current, category: event.target.value }))}
                    placeholder="e.g. SaaS, FinTech, AI"
                    disabled={isEditingLocked || createWorkspace.isPending}
                    className="rounded-xl border-slate-800 bg-slate-950 text-white placeholder:text-slate-500"
                  />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => createWorkspace.mutate()}
                  disabled={isEditingLocked || createWorkspace.isPending}
                  className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:opacity-60"
                >
                  {createWorkspace.isPending ? "Creating..." : "Create Independent Workspace"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setCreateForm({ title: "", category: "" });
                  }}
                  disabled={createWorkspace.isPending}
                  className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Stage</div>
              <div className="mt-2 text-lg font-semibold text-white">
                {activeWorkspace?.stage ?? "Not linked"}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Category</div>
              <div className="mt-2 text-lg font-semibold text-white">
                {activeWorkspace?.category ?? "Not linked"}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Progress</div>
              <div className="mt-2 text-lg font-semibold text-white">
                {activeWorkspace ? `${activeWorkspace.progressPercent}%` : "Not linked"}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {!isReadOnlyViewer ? (
              <button
                type="button"
                onClick={() => saveWorkspaceLink.mutate()}
                disabled={saveWorkspaceLink.isPending || isEditingLocked}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-5 py-3 text-sm font-semibold text-white transition hover:from-blue-500 hover:to-cyan-500 disabled:opacity-60"
              >
                {saveWorkspaceLink.isPending ? "Saving..." : isEditingLocked ? "Workspace Locked" : "Save Workspace Link"}
              </button>
            ) : (
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-400">
                Investor access is read-only in this startup workspace.
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
            <Users className="h-4 w-4" />
            Founder Team
          </div>
          <h2 className="text-lg font-semibold text-white">Workspace members</h2>

          <div className="mt-5 space-y-3">
            {founderMembers.length > 0 ? (
              founderMembers.map((member) => (
                <div
                  key={member._id}
                  className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-sm font-semibold text-white">
                    {member.avatar ? (
                      <img src={member.avatar} alt={member.displayName} className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      member.displayName.slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-white">{member.displayName}</div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      {member.role}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/60 px-4 py-5 text-sm text-slate-400">
                {activeWorkspace
                  ? isInvestorSummaryFallback
                    ? "Founder roster will appear here once workspace access finishes syncing for this investor."
                    : "No workspace members were returned for this startup yet."
                  : "Link a workspace to sync founders and startup team access."}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default StartupWorkspace;
