import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  FolderKanban,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Users2,
} from "lucide-react";
import { workspaceApi } from "../../../api/workspace.api";
import { toast } from "../../../components/ui/sonner";
import { useAuthStore } from "../../../store/authStore";
import type { Workspace } from "../../../types/workspace.types";
import { getApiErrorMessage } from "../../../utils/apiError";

const stageOptions: Workspace["stage"][] = [
  "Ideation",
  "Problem",
  "Build",
  "Patent",
  "Launch",
];

const emptyWorkspaceForm = {
  title: "",
  category: "",
};

const formatDate = (value?: string) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Not updated";

export function StudentWorkspaces() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const [createForm, setCreateForm] = useState(emptyWorkspaceForm);
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(
    null,
  );
  const [editForm, setEditForm] = useState<{
    title: string;
    category: string;
    stage: Workspace["stage"];
  }>({
    title: "",
    category: "",
    stage: "Ideation",
  });
  const [deleteWorkspaceId, setDeleteWorkspaceId] = useState<string | null>(
    null,
  );

  const workspacesQuery = useQuery({
    queryKey: ["workspaces"],
    queryFn: workspaceApi.list,
  });

  const workspaces = useMemo(
    () =>
      [...(workspacesQuery.data ?? [])].sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() -
          new Date(left.updatedAt).getTime(),
      ),
    [workspacesQuery.data],
  );

  const ownedWorkspaceCount = useMemo(
    () =>
      workspaces.filter((workspace) => workspace.ownerId === currentUser?._id)
        .length,
    [currentUser?._id, workspaces],
  );
  const problemWorkspaceCount = useMemo(
    () => workspaces.filter((workspace) => Boolean(workspace.claimedProblemId)).length,
    [workspaces],
  );
  const independentWorkspaceCount = workspaces.length - problemWorkspaceCount;

  const refreshWorkspaces = async (workspaceId?: string) => {
    await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    if (workspaceId) {
      await queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId] });
    }
  };

  const createWorkspaceMutation = useMutation({
    mutationFn: () =>
      workspaceApi.create({
        title: createForm.title.trim(),
        category: createForm.category.trim(),
      }),
    onSuccess: async () => {
      setCreateForm(emptyWorkspaceForm);
      toast.success("Workspace created.");
      await refreshWorkspaces();
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Unable to create workspace right now."),
      );
    },
  });

  const updateWorkspaceMutation = useMutation({
    mutationFn: (workspaceId: string) =>
      workspaceApi.update(workspaceId, {
        title: editForm.title.trim(),
        category: editForm.category.trim(),
        stage: editForm.stage,
      }),
    onSuccess: async (_, workspaceId) => {
      setEditingWorkspaceId(null);
      toast.success("Workspace updated.");
      await refreshWorkspaces(workspaceId);
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Unable to update workspace right now."),
      );
    },
  });

  const deleteWorkspaceMutation = useMutation({
    mutationFn: (workspaceId: string) => workspaceApi.remove(workspaceId),
    onSuccess: async (_, workspaceId) => {
      if (editingWorkspaceId === workspaceId) {
        setEditingWorkspaceId(null);
      }
      setDeleteWorkspaceId(null);
      toast.success("Workspace deleted.");
      await refreshWorkspaces(workspaceId);
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Unable to delete workspace right now."),
      );
    },
  });

  const handleCreateWorkspace = () => {
    if (
      createWorkspaceMutation.isPending ||
      createForm.title.trim().length < 2 ||
      createForm.category.trim().length < 2
    ) {
      return;
    }

    createWorkspaceMutation.mutate();
  };

  const startEditing = (workspace: Workspace) => {
    setDeleteWorkspaceId(null);
    setEditingWorkspaceId(workspace._id);
    setEditForm({
      title: workspace.title,
      category: workspace.category,
      stage: workspace.stage,
    });
  };

  const cancelEditing = () => {
    setEditingWorkspaceId(null);
  };

  const handleSaveWorkspace = (workspaceId: string) => {
    if (
      updateWorkspaceMutation.isPending ||
      editForm.title.trim().length < 2 ||
      editForm.category.trim().length < 2
    ) {
      return;
    }

    updateWorkspaceMutation.mutate(workspaceId);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.32em] text-cyan-300">
            Workspace Control
          </div>
          <h1 className="mt-3 text-3xl font-bold text-white">
            Student Workspaces
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Review every active product workspace, create independent ones, edit
            workspace details, and remove workspaces you own without leaving the
            dashboard.
          </p>
        </div>
        <Link
          to="/problem-bank"
          className="inline-flex items-center justify-center rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
        >
          Browse Problem Bank
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
            Total Workspaces
          </div>
          <div className="mt-3 text-3xl font-bold text-white">
            {workspaces.length}
          </div>
          <div className="mt-2 text-sm text-slate-400">
            All workspaces visible to you
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
            Problem Linked
          </div>
          <div className="mt-3 text-3xl font-bold text-white">
            {problemWorkspaceCount}
          </div>
          <div className="mt-2 text-sm text-slate-400">
            Claimed from Problem Bank
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
            Owned By You
          </div>
          <div className="mt-3 text-3xl font-bold text-white">
            {ownedWorkspaceCount}
          </div>
          <div className="mt-2 text-sm text-slate-400">
            {independentWorkspaceCount} independent workspace
            {independentWorkspaceCount === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
            <Plus className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">
              Create Independent Workspace
            </h2>
            <p className="text-sm text-slate-400">
              Use this for student-led builds that are not attached to a Problem
              Bank claim.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.3fr_1fr_auto]">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-300">
              Workspace title
            </span>
            <input
              type="text"
              value={createForm.title}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              placeholder="AI Interview Coach"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-300">
              Category
            </span>
            <input
              type="text"
              value={createForm.category}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  category: event.target.value,
                }))
              }
              placeholder="Education / AI"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleCreateWorkspace}
              disabled={
                createWorkspaceMutation.isPending ||
                createForm.title.trim().length < 2 ||
                createForm.category.trim().length < 2
              }
              className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:from-cyan-500 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {createWorkspaceMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Create Workspace"
              )}
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Current Workspaces
            </h2>
            <p className="text-sm text-slate-400">
              Open detailed execution view or manage workspace metadata here.
            </p>
          </div>
          {workspacesQuery.isFetching ? (
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
              Refreshing
            </div>
          ) : null}
        </div>

        {workspacesQuery.isLoading ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center text-slate-400">
            Loading workspaces...
          </div>
        ) : workspacesQuery.isError ? (
          <div className="rounded-2xl border border-rose-900/40 bg-slate-900 p-10 text-center">
            <div className="text-lg font-semibold text-white">
              Unable to load workspaces
            </div>
            <p className="mt-2 text-sm text-rose-200">
              {getApiErrorMessage(
                workspacesQuery.error,
                "Please retry in a moment.",
              )}
            </p>
            <button
              type="button"
              onClick={() => workspacesQuery.refetch()}
              className="mt-4 inline-flex rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
            >
              Retry
            </button>
          </div>
        ) : workspaces.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-10 text-center">
            <FolderKanban className="mx-auto h-10 w-10 text-slate-600" />
            <h3 className="mt-4 text-lg font-semibold text-white">
              No workspace yet
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              Claim a problem or create an independent workspace to start
              collaborating.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {workspaces.map((workspace) => {
              const isEditing = editingWorkspaceId === workspace._id;
              const isDeleting = deleteWorkspaceId === workspace._id;
              const isOwner = workspace.ownerId === currentUser?._id;
              const memberCount =
                workspace.teamMembers?.length ??
                workspace.teamMemberIds?.length ??
                0;

              return (
                <article
                  key={workspace._id}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
                          {workspace.stage}
                        </span>
                        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                          {workspace.category}
                        </span>
                        {workspace.claimedProblemId ? (
                          <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
                            Problem Bank
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                            Independent
                          </span>
                        )}
                        {!isOwner ? (
                          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                            Collaborator
                          </span>
                        ) : null}
                      </div>

                      <div>
                        <h3 className="truncate text-2xl font-semibold text-white">
                          {workspace.title}
                        </h3>
                        <p className="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-400">
                          <span className="inline-flex items-center gap-2">
                            <Users2 className="h-4 w-4" />
                            {memberCount} member{memberCount === 1 ? "" : "s"}
                          </span>
                          <span>Updated {formatDate(workspace.updatedAt)}</span>
                          <span>{workspace.progressPercent}% complete</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link
                        to={`/product-workspace/${workspace._id}`}
                        className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
                      >
                        Open Workspace
                      </Link>
                      <button
                        type="button"
                        onClick={() => startEditing(workspace)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </button>
                      {isOwner ? (
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteWorkspaceId((current) =>
                              current === workspace._id ? null : workspace._id,
                            )
                          }
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-900/60 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:border-rose-500 hover:text-white"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-500">
                      <span>Progress</span>
                      <span>{workspace.progressPercent}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
                        style={{ width: `${workspace.progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950 p-5">
                      <div className="grid gap-4 lg:grid-cols-3">
                        <label className="space-y-2 lg:col-span-2">
                          <span className="text-sm font-medium text-slate-300">
                            Title
                          </span>
                          <input
                            type="text"
                            value={editForm.title}
                            onChange={(event) =>
                              setEditForm((current) => ({
                                ...current,
                                title: event.target.value,
                              }))
                            }
                            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white focus:border-cyan-500 focus:outline-none"
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-sm font-medium text-slate-300">
                            Stage
                          </span>
                          <select
                            value={editForm.stage}
                            onChange={(event) =>
                              setEditForm((current) => ({
                                ...current,
                                stage: event.target.value as Workspace["stage"],
                              }))
                            }
                            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white focus:border-cyan-500 focus:outline-none"
                          >
                            {stageOptions.map((stage) => (
                              <option key={stage} value={stage}>
                                {stage}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <label className="mt-4 block space-y-2">
                        <span className="text-sm font-medium text-slate-300">
                          Category
                        </span>
                        <input
                          type="text"
                          value={editForm.category}
                          onChange={(event) =>
                            setEditForm((current) => ({
                              ...current,
                              category: event.target.value,
                            }))
                          }
                          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white focus:border-cyan-500 focus:outline-none"
                        />
                      </label>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => handleSaveWorkspace(workspace._id)}
                          disabled={updateWorkspaceMutation.isPending}
                          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:from-cyan-500 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {updateWorkspaceMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Save Changes"
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditing}
                          className="inline-flex items-center justify-center rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {isDeleting ? (
                    <div className="mt-5 rounded-2xl border border-rose-900/40 bg-rose-950/20 p-5">
                      <div className="flex gap-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-300" />
                        <div>
                          <h4 className="font-semibold text-white">
                            Delete this workspace?
                          </h4>
                          <p className="mt-1 text-sm leading-6 text-rose-100/80">
                            This removes workspace progress, uploads, code
                            submissions, repo links, and chat history. This
                            action cannot be undone.
                          </p>
                          <div className="mt-4 flex flex-wrap gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                deleteWorkspaceMutation.mutate(workspace._id)
                              }
                              disabled={deleteWorkspaceMutation.isPending}
                              className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {deleteWorkspaceMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Confirm Delete"
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteWorkspaceId(null)}
                              className="inline-flex items-center justify-center rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
                            >
                              Keep Workspace
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default StudentWorkspaces;
