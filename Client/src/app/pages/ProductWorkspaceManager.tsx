import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Clock3,
  FolderKanban,
  Layers3,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Target,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { workspaceApi } from "../../api/workspace.api";
import { DashboardLayout } from "../components/DashboardLayout";
import { toast } from "../../components/ui/sonner";
import { useAuthStore } from "../../store/authStore";
import { UserRole } from "../../types/roles.types";
import { Workspace } from "../../types/workspace.types";
import { getApiErrorMessage } from "../../utils/apiError";

type WorkspaceEditorState = {
  title: string;
  category: string;
  stage: Workspace["stage"];
};

const STAGE_OPTIONS: Workspace["stage"][] = [
  "Ideation",
  "Problem",
  "Build",
  "Patent",
  "Launch",
];

const EMPTY_EDITOR_STATE: WorkspaceEditorState = {
  title: "",
  category: "",
  stage: "Ideation",
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const getWorkspaceSourceLabel = (workspace: Workspace) =>
  workspace.claimedProblemId ? "Problem Bank" : "Independent";

export function ProductWorkspaceManager() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const canManageWorkspaces = currentUser?.role === UserRole.STUDENT;
  const [searchValue, setSearchValue] = useState("");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [editorMode, setEditorMode] = useState<"create" | "edit" | null>(null);
  const [editorWorkspaceId, setEditorWorkspaceId] = useState<string | null>(null);
  const [editorState, setEditorState] =
    useState<WorkspaceEditorState>(EMPTY_EDITOR_STATE);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const deferredSearchValue = useDeferredValue(searchValue.trim().toLowerCase());

  const workspacesQuery = useQuery({
    queryKey: ["workspaces"],
    queryFn: workspaceApi.list,
  });

  const accessibleWorkspaces = useMemo(
    () =>
      [...(workspacesQuery.data ?? [])].sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() -
          new Date(left.updatedAt).getTime(),
      ),
    [workspacesQuery.data],
  );

  useEffect(() => {
    if (!accessibleWorkspaces.length) {
      if (selectedWorkspaceId) {
        setSelectedWorkspaceId("");
      }
      return;
    }

    const hasSelectedWorkspace = accessibleWorkspaces.some(
      (workspace) => workspace._id === selectedWorkspaceId,
    );

    if (!hasSelectedWorkspace) {
      setSelectedWorkspaceId(accessibleWorkspaces[0]._id);
    }
  }, [accessibleWorkspaces, selectedWorkspaceId]);

  const filteredWorkspaces = useMemo(() => {
    if (!deferredSearchValue) {
      return accessibleWorkspaces;
    }

    return accessibleWorkspaces.filter((workspace) =>
      [workspace.title, workspace.category, workspace.stage]
        .join(" ")
        .toLowerCase()
        .includes(deferredSearchValue),
    );
  }, [accessibleWorkspaces, deferredSearchValue]);

  const selectedWorkspace =
    accessibleWorkspaces.find((workspace) => workspace._id === selectedWorkspaceId) ??
    null;

  const ownedWorkspaceCount = useMemo(
    () =>
      accessibleWorkspaces.filter(
        (workspace) => workspace.ownerId === currentUser?._id,
      ).length,
    [accessibleWorkspaces, currentUser?._id],
  );

  const problemWorkspaceCount = useMemo(
    () =>
      accessibleWorkspaces.filter((workspace) => Boolean(workspace.claimedProblemId))
        .length,
    [accessibleWorkspaces],
  );

  const standaloneWorkspaceCount =
    accessibleWorkspaces.length - problemWorkspaceCount;

  const editingWorkspace =
    editorMode === "edit" && editorWorkspaceId
      ? accessibleWorkspaces.find((workspace) => workspace._id === editorWorkspaceId) ??
        null
      : null;

  const resetEditor = () => {
    startTransition(() => {
      setEditorMode(null);
      setEditorWorkspaceId(null);
      setEditorState(EMPTY_EDITOR_STATE);
    });
  };

  const refreshWorkspaceQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["workspaces"] }),
      queryClient.invalidateQueries({ queryKey: ["workspace"] }),
    ]);
  };

  const createWorkspaceMutation = useMutation({
    mutationFn: () =>
      workspaceApi.create({
        title: editorState.title.trim(),
        category: editorState.category.trim(),
      }),
    onSuccess: async (workspace) => {
      toast.success("Workspace created.");
      resetEditor();
      setSelectedWorkspaceId(workspace._id);
      await refreshWorkspaceQueries();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Unable to create the workspace."));
    },
  });

  const updateWorkspaceMutation = useMutation({
    mutationFn: (workspaceId: string) =>
      workspaceApi.update(workspaceId, {
        title: editorState.title.trim(),
        category: editorState.category.trim(),
        stage: editorState.stage,
      }),
    onSuccess: async (workspace) => {
      toast.success("Workspace updated.");
      resetEditor();
      setSelectedWorkspaceId(workspace._id);
      await refreshWorkspaceQueries();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Unable to update the workspace."));
    },
  });

  const deleteWorkspaceMutation = useMutation({
    mutationFn: (workspaceId: string) => workspaceApi.remove(workspaceId),
    onSuccess: async (_result, workspaceId) => {
      toast.success("Workspace deleted.");
      setDeleteTargetId(null);

      if (selectedWorkspaceId === workspaceId) {
        const nextWorkspace = accessibleWorkspaces.find(
          (workspace) => workspace._id !== workspaceId,
        );
        setSelectedWorkspaceId(nextWorkspace?._id ?? "");
      }

      await refreshWorkspaceQueries();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Unable to delete the workspace."));
    },
  });

  const isSubmittingEditor =
    createWorkspaceMutation.isPending || updateWorkspaceMutation.isPending;

  const openCreateEditor = () => {
    setDeleteTargetId(null);
    setEditorMode("create");
    setEditorWorkspaceId(null);
    setEditorState(EMPTY_EDITOR_STATE);
  };

  const openEditEditor = (workspace: Workspace) => {
    setDeleteTargetId(null);
    setEditorMode("edit");
    setEditorWorkspaceId(workspace._id);
    setEditorState({
      title: workspace.title,
      category: workspace.category,
      stage: workspace.stage,
    });
  };

  const submitEditor = () => {
    if (editorState.title.trim().length < 2) {
      toast.error("Workspace title must be at least 2 characters.");
      return;
    }

    if (editorState.category.trim().length < 2) {
      toast.error("Workspace category must be at least 2 characters.");
      return;
    }

    if (editorMode === "edit" && editorWorkspaceId) {
      updateWorkspaceMutation.mutate(editorWorkspaceId);
      return;
    }

    createWorkspaceMutation.mutate();
  };

  return (
    <DashboardLayout role={currentUser?.role ?? UserRole.STUDENT}>
      <div className="-mx-4 -my-6 min-h-full space-y-6 bg-black px-4 py-6 lg:-mx-8 lg:px-8">
        <section className="rounded-[28px] border border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_38%),linear-gradient(180deg,_rgba(15,23,42,0.96),_rgba(2,6,23,0.96))] p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">
                <FolderKanban className="h-3.5 w-3.5" />
                Workspace Manager
              </div>
              <h1 className="mt-4 text-3xl font-bold text-white sm:text-4xl">
                Manage your current workspaces
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Review every active workspace, create independent ones, update
                owned workspaces, and open the detailed board whenever you need
                tasks, uploads, progress, or collaboration tools.
              </p>
            </div>

            <button
              type="button"
              onClick={openCreateEditor}
              disabled={!canManageWorkspaces}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:from-cyan-400 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Create Workspace
            </button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              {
                label: "Total Workspaces",
                value: accessibleWorkspaces.length,
                detail: "All workspaces you can access",
                icon: Layers3,
              },
              {
                label: "Owned by You",
                value: ownedWorkspaceCount,
                detail: "Edit and delete are owner-only",
                icon: Sparkles,
              },
              {
                label: "Problem Linked",
                value: problemWorkspaceCount,
                detail: `${standaloneWorkspaceCount} independent workspaces`,
                icon: Target,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-slate-800 bg-slate-950 p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
                      {item.label}
                    </div>
                    <div className="mt-3 text-3xl font-bold text-white">
                      {item.value}
                    </div>
                  </div>
                  <item.icon className="h-5 w-5 text-cyan-300" />
                </div>
                <div className="mt-3 text-sm text-slate-400">
                  {item.detail}
                </div>
              </div>
            ))}
          </div>
        </section>

        {editorMode && canManageWorkspaces ? (
          <section className="rounded-[28px] border border-slate-800 bg-slate-950 p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
                  {editorMode === "create" ? "Create Workspace" : "Edit Workspace"}
                </div>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {editorMode === "create"
                    ? "Create a new independent workspace"
                    : `Update ${editingWorkspace?.title ?? "workspace details"}`}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {editorMode === "create"
                    ? "Independent workspaces start in Ideation and can later be used across startup, delivery, or collaboration flows."
                    : "Rename the workspace, refine its category, or move it to the next stage."}
                </p>
              </div>

              <button
                type="button"
                onClick={resetEditor}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200"
              >
                <X className="h-4 w-4" />
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-300">
                    Workspace title
                  </span>
                  <input
                    value={editorState.title}
                    onChange={(event) =>
                      setEditorState((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    placeholder="AI Campus Sprint"
                    className="w-full rounded-xl border border-slate-800 bg-black px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-300">
                    Category
                  </span>
                  <input
                    value={editorState.category}
                    onChange={(event) =>
                      setEditorState((current) => ({
                        ...current,
                        category: event.target.value,
                      }))
                    }
                    placeholder="Healthcare, EdTech, AI"
                    className="w-full rounded-xl border border-slate-800 bg-black px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                  />
                </label>

                {editorMode === "edit" ? (
                  <label className="space-y-2 md:col-span-2">
                    <span className="text-sm font-medium text-slate-300">
                      Stage
                    </span>
                    <select
                      value={editorState.stage}
                      onChange={(event) =>
                        setEditorState((current) => ({
                          ...current,
                          stage: event.target.value as Workspace["stage"],
                        }))
                      }
                      className="w-full rounded-xl border border-slate-800 bg-black px-4 py-3 text-sm text-white focus:border-cyan-500 focus:outline-none"
                    >
                      {STAGE_OPTIONS.map((stage) => (
                        <option
                          key={stage}
                          value={stage}
                          className="bg-slate-950"
                        >
                          {stage}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={submitEditor}
                  disabled={isSubmittingEditor}
                  className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmittingEditor
                    ? "Saving..."
                    : editorMode === "create"
                      ? "Create Workspace"
                      : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={resetEditor}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </section>
        ) : null}

        <section className="rounded-[28px] border border-slate-800 bg-slate-950 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">
                Current workspaces
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Problem Bank claims and independent workspaces appear here in
                one place.
              </p>
            </div>

            <div className="relative w-full md:max-w-md">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search by title, category, or stage"
                className="w-full rounded-xl border border-slate-800 bg-black py-3 pl-11 pr-11 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              />
              {searchValue ? (
                <button
                  type="button"
                  onClick={() => setSearchValue("")}
                  className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-900 hover:text-white"
                  aria-label="Clear workspace search"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>

          {workspacesQuery.isLoading ? (
            <div className="py-12 text-center text-sm text-slate-400">
              Loading workspaces...
            </div>
          ) : filteredWorkspaces.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-800 bg-black/60 p-10 text-center">
              <FolderKanban className="mx-auto h-10 w-10 text-slate-600" />
              <h3 className="mt-4 text-xl font-semibold text-white">
                {accessibleWorkspaces.length === 0
                  ? "No workspaces yet"
                  : "No workspaces match this search"}
              </h3>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                {accessibleWorkspaces.length === 0
                  ? "Create an independent workspace here or start a problem from the Problem Bank to generate one automatically."
                  : "Try a broader title, category, or stage search."}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {accessibleWorkspaces.length === 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={openCreateEditor}
                      disabled={!canManageWorkspaces}
                      className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Create Workspace
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate("/problem-bank")}
                      className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 text-sm font-semibold text-white"
                    >
                      Open Problem Bank
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_320px]">
              <div className="space-y-4">
                {filteredWorkspaces.map((workspace) => {
                  const isOwner = workspace.ownerId === currentUser?._id;
                  const isSelected = workspace._id === selectedWorkspaceId;
                  const isDeletePending = workspace._id === deleteTargetId;

                  return (
                    <article
                      key={workspace._id}
                      className={`rounded-[24px] border p-5 transition ${
                        isSelected
                          ? "border-sky-500/40 bg-sky-500/10"
                          : "border-slate-800 bg-black/70"
                      }`}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <button
                          type="button"
                          onClick={() => setSelectedWorkspaceId(workspace._id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-lg font-semibold text-white">
                              {workspace.title}
                            </h3>
                            <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-300">
                              {getWorkspaceSourceLabel(workspace)}
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] ${
                                isOwner
                                  ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                                  : "border border-amber-500/20 bg-amber-500/10 text-amber-200"
                              }`}
                            >
                              {isOwner ? "Owner" : "Collaborator"}
                            </span>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-400">
                            <span className="inline-flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-sky-300" />
                              {workspace.category}
                            </span>
                            <span className="inline-flex items-center gap-2">
                              <FolderKanban className="h-4 w-4 text-fuchsia-300" />
                              {workspace.stage}
                            </span>
                            <span className="inline-flex items-center gap-2">
                              <Users className="h-4 w-4 text-emerald-300" />
                              {workspace.teamMembers?.length ??
                                workspace.teamMemberIds.length}{" "}
                              members
                            </span>
                            <span className="inline-flex items-center gap-2">
                              <Clock3 className="h-4 w-4 text-slate-500" />
                              Updated {formatDate(workspace.updatedAt)}
                            </span>
                          </div>

                          <div className="mt-4">
                            <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-500">
                              <span>Progress</span>
                              <span>{workspace.progressPercent}%</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-fuchsia-500"
                                style={{
                                  width: `${workspace.progressPercent}%`,
                                }}
                              />
                            </div>
                          </div>
                        </button>

                        <div className="flex flex-wrap gap-2 lg:max-w-[220px] lg:justify-end">
                          <button
                            type="button"
                            onClick={() => navigate(`/product-workspace/${workspace._id}`)}
                            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
                          >
                            Open
                            <ArrowRight className="h-4 w-4" />
                          </button>
                          {isOwner && canManageWorkspaces ? (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditEditor(workspace)}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200"
                              >
                                <Pencil className="h-4 w-4" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setDeleteTargetId((current) =>
                                    current === workspace._id ? null : workspace._id,
                                  )
                                }
                                className="inline-flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-200"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>

                      {isDeletePending ? (
                        <div className="mt-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                              <div className="text-sm font-semibold text-rose-100">
                                Delete {workspace.title}?
                              </div>
                              <p className="mt-2 text-sm leading-6 text-rose-100/80">
                                This removes the workspace board, tasks, uploads,
                                and chat history permanently.
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-3">
                              <button
                                type="button"
                                onClick={() =>
                                  deleteWorkspaceMutation.mutate(workspace._id)
                                }
                                disabled={deleteWorkspaceMutation.isPending}
                                className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {deleteWorkspaceMutation.isPending
                                  ? "Deleting..."
                                  : "Confirm Delete"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTargetId(null)}
                                className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>

              <aside className="rounded-[24px] border border-slate-800 bg-black/70 p-5">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
                  Selected Workspace
                </div>
                {selectedWorkspace ? (
                  <>
                    <h3 className="mt-3 text-xl font-semibold text-white">
                      {selectedWorkspace.title}
                    </h3>
                    <div className="mt-4 space-y-3 text-sm text-slate-300">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Category</span>
                        <span>{selectedWorkspace.category}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Stage</span>
                        <span>{selectedWorkspace.stage}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Source</span>
                        <span>{getWorkspaceSourceLabel(selectedWorkspace)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Progress</span>
                        <span>{selectedWorkspace.progressPercent}%</span>
                      </div>
                    </div>

                    <div className="mt-5">
                      <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-500">
                        <span>Progress</span>
                        <span>{selectedWorkspace.progressPercent}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-fuchsia-500"
                          style={{ width: `${selectedWorkspace.progressPercent}%` }}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate(`/product-workspace/${selectedWorkspace._id}`)}
                      className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-semibold text-white"
                    >
                      Open Workspace Detail
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <div className="mt-4 text-sm text-slate-400">
                    Select a workspace to see its summary and open the detail
                    board.
                  </div>
                )}
              </aside>
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
