import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Loader2,
  Search,
  Tag,
  Target,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { DashboardLayout } from "../components/DashboardLayout";
import { problemBankApi } from "../../api/problemBank.api";
import { workspaceApi } from "../../api/workspace.api";
import { toast } from "../components/ui/sonner";
import {
  PROBLEM_CATEGORIES,
  Problem,
  ProblemLeaderboardEntry,
} from "../../types/problem.types";
import { useAuthStore } from "../../store/authStore";
import { UserRole } from "../../types/roles.types";
import { getApiErrorMessage } from "../../utils/apiError";

const categoryOptions = ["All Problems", ...PROBLEM_CATEGORIES];

const timeAgo = (value: string) => {
  const milliseconds = Date.now() - new Date(value).getTime();
  const days = Math.max(1, Math.round(milliseconds / (1000 * 60 * 60 * 24)));
  return days === 1 ? "1 day ago" : `${days} days ago`;
};

const getViewerStatusStyles = (status?: Problem["viewerState"] | null) => {
  switch (status?.status) {
    case "approved":
      return {
        label: "Approved",
        className: "bg-emerald-500/10 text-emerald-300",
      };
    case "review_requested":
      return {
        label: "Review Pending",
        className: "bg-amber-500/10 text-amber-300",
      };
    case "changes_requested":
      return {
        label: "Changes Requested",
        className: "bg-rose-500/10 text-rose-300",
      };
    case "in_progress":
      return {
        label: "In Progress",
        className: "bg-cyan-500/10 text-cyan-300",
      };
    default:
      return null;
  }
};

const leaderboardRow = (entry: ProblemLeaderboardEntry) => (
  <div
    key={entry.submissionId}
    className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3"
  >
    <div className="min-w-0">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-white">
          {entry.rank}
        </div>
        <div className="min-w-0">
          <div className="truncate font-semibold text-white">
            {entry.teamName}
          </div>
          <div className="truncate text-xs text-slate-400">
            {entry.teamMembers.map((member) => member.displayName).join(", ")}
          </div>
        </div>
      </div>
    </div>
    <div className="text-right">
      <div className="font-semibold text-cyan-300">
        {entry.pointsAwarded} pts
      </div>
      <div className="text-xs text-slate-500">
        {new Date(entry.reviewedAt).toLocaleDateString("en-IN")}
      </div>
    </div>
  </div>
);

export function ProblemBank() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const authUser = useAuthStore((state) => state.user);
  const [selectedCategory, setSelectedCategory] = useState("All Problems");
  const [searchValue, setSearchValue] = useState("");
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(
    null,
  );
  const [feedback, setFeedback] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [startingProblemId, setStartingProblemId] = useState<string | null>(
    null,
  );
  const deferredSearchQuery = useDeferredValue(searchValue.trim());
  const viewerRole = authUser?.role ?? UserRole.STUDENT;
  const canClaimProblems = viewerRole === UserRole.STUDENT;
  const canOpenProductWorkspace = viewerRole === UserRole.STUDENT;

  const problemsQuery = useInfiniteQuery({
    queryKey: [
      "problems",
      selectedCategory,
      deferredSearchQuery,
    ],
    queryFn: ({ pageParam = 1 }) =>
      problemBankApi.list({
        page: pageParam,
        limit: 6,
        search: deferredSearchQuery || undefined,
        category:
          selectedCategory === "All Problems" ? undefined : selectedCategory,
      }),
    getNextPageParam: (lastPage) => {
      const { meta } = lastPage;
      return meta.page * meta.limit < meta.total ? meta.page + 1 : undefined;
    },
    initialPageParam: 1,
  });

  const problems = useMemo(
    () => problemsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [problemsQuery.data],
  );

  const selectedProblem =
    problems.find((problem) => problem._id === selectedProblemId) ?? null;

  const workspacesQuery = useQuery({
    queryKey: ["workspaces"],
    queryFn: workspaceApi.list,
    enabled: Boolean(authUser) && canClaimProblems,
  });

  const workspaceIdByClaimedProblemId = useMemo(() => {
    if (!canClaimProblems) {
      return new Map<string, string>();
    }

    return new Map(
      (workspacesQuery.data ?? [])
        .filter((workspace) => Boolean(workspace.claimedProblemId))
        .map((workspace) => [workspace.claimedProblemId!, workspace._id]),
    );
  }, [canClaimProblems, workspacesQuery.data]);
  const getProblemWorkspaceId = (problem: Problem) =>
    problem.viewerState?.workspaceId ??
    workspaceIdByClaimedProblemId.get(problem._id) ??
    null;

  const selectedProblemWorkspaceId = selectedProblem
    ? getProblemWorkspaceId(selectedProblem)
    : null;

  useEffect(() => {
    setReviewNote("");
  }, [selectedProblemId]);

  const leaderboardQuery = useQuery({
    queryKey: ["problem-leaderboard", selectedProblemId],
    queryFn: () => problemBankApi.getLeaderboard(selectedProblemId!),
    enabled: Boolean(selectedProblemId),
  });

  const startProblem = async (problem: Problem) => {
    const existingWorkspaceId = getProblemWorkspaceId(problem);
    if (existingWorkspaceId) {
      navigate(`/product-workspace/${existingWorkspaceId}`);
      return;
    }

    if (startingProblemId) {
      return;
    }

    setStartingProblemId(problem._id);
    setFeedback("");

    try {
      const workspace = await Promise.race([
        problemBankApi.claim(problem._id),
        new Promise<"timeout">((resolve) => {
          window.setTimeout(() => resolve("timeout"), 10000);
        }),
      ]);

      if (workspace === "timeout") {
        const workspaces = await queryClient.fetchQuery({
          queryKey: ["workspaces"],
          queryFn: workspaceApi.list,
        });
        const claimedWorkspace = workspaces.find(
          (item) => item.claimedProblemId === problem._id,
        );

        if (claimedWorkspace) {
          toast.success("Workspace created successfully!");
          navigate(`/product-workspace/${claimedWorkspace._id}`);
          return;
        }

        setFeedback("Starting this problem is taking longer than expected. Please try again.");
        return;
      }

      void queryClient.invalidateQueries({ queryKey: ["problems"] });
      void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setFeedback("Problem started. Your team workspace is ready.");
      toast.success("Workspace created successfully!");
      navigate(`/product-workspace/${workspace._id}`);
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to start this problem right now.");
      setFeedback(message);
      toast.error(message);
    } finally {
      setStartingProblemId(null);
    }
  };

  const reviewMutation = useMutation({
    mutationFn: (payload: {
      problemId: string;
      workspaceId: string;
      requestNote: string;
    }) =>
      problemBankApi.requestReview(payload.problemId, {
        workspaceId: payload.workspaceId,
        requestNote: payload.requestNote,
      }),
    onSuccess: () => {
      setFeedback("Review request sent to admin.");
      setReviewNote("");
      void queryClient.invalidateQueries({ queryKey: ["problems"] });
      if (selectedProblemId) {
        void queryClient.invalidateQueries({
          queryKey: ["problem-leaderboard", selectedProblemId],
        });
      }
    },
    onError: (error) => {
      const message =
        (error as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ??
        "Unable to send the review request right now.";
      setFeedback(message);
    },
  });

  const approvedTeams = useMemo(
    () =>
      problems.reduce(
        (sum, problem) => sum + (problem.stats?.approvedTeamsCount ?? 0),
        0,
      ),
    [problems],
  );

  const activeTeams = useMemo(
    () =>
      problems.reduce(
        (sum, problem) => sum + (problem.stats?.activeTeamsCount ?? 0),
        0,
      ),
    [problems],
  );

  const requestReview = () => {
    if (!selectedProblem?.viewerState?.workspaceId) {
      return;
    }

    reviewMutation.mutate({
      problemId: selectedProblem._id,
      workspaceId: selectedProblem.viewerState.workspaceId,
      requestNote: reviewNote.trim(),
    });
  };

  const closeDetails = () => {
    setSelectedProblemId(null);
  };

  return (
    <DashboardLayout role={viewerRole}>
      <div className="-mx-4 -my-6 min-h-full space-y-6 bg-black px-4 py-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-white">Problem Bank</h1>
            <p className="text-slate-100">
              Admin-curated challenges with leaderboard ranking and
              workspace-linked review.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <div className="rounded-xl border border-slate-800 bg-slate-900 px-5 py-3 text-sm text-slate-300">
              {canClaimProblems
                ? "Complete the problem, request admin review, and earn innovation points."
                : "Browse admin-provided challenges, review requirements, and track approved leaderboard entries."}
            </div>
            {canOpenProductWorkspace ? (
              <button
                type="button"
                onClick={() => navigate("/product-workspace")}
                className="rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-3 text-sm font-semibold text-white"
              >
                Open Product Workspace
              </button>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-zinc-950 p-6">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search problems..."
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
              {searchValue ? (
                <button
                  type="button"
                  onClick={() => setSearchValue("")}
                  aria-label="Clear problem search"
                  className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-800 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {categoryOptions.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`rounded-lg px-4 py-2 font-medium transition-all ${
                selectedCategory === category
                  ? "bg-blue-600 text-white"
                  : "border border-slate-800 bg-zinc-950 text-slate-400 hover:bg-slate-900"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {feedback ? (
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-300">
            {feedback}
          </div>
        ) : null}

        {problemsQuery.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-cyan-300" />
          </div>
        ) : (
          <div className="space-y-4">
            {problems.map((problem) => {
              const viewerStatus = getViewerStatusStyles(problem.viewerState);
              const workspaceId = getProblemWorkspaceId(problem);

              return (
                <div
                  key={problem._id}
                  className="rounded-xl border border-slate-800 bg-slate-900 p-6 transition-all hover:border-slate-700"
                >
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-3">
                        <h3 className="text-xl font-bold text-white">
                          {problem.title}
                        </h3>
                        {problem.isVerified ? (
                          <div className="flex items-center gap-1 rounded px-2 py-1 text-xs text-green-400">
                            <CheckCircle className="h-3 w-3" />
                            Verified
                          </div>
                        ) : null}
                        {viewerStatus ? (
                          <div
                            className={`rounded px-2 py-1 text-xs ${viewerStatus.className}`}
                          >
                            {viewerStatus.label}
                          </div>
                        ) : null}
                        {problem.sponsorName ? (
                          <div className="rounded bg-cyan-500/10 px-2 py-1 text-xs text-cyan-300">
                            {problem.sponsorName}
                          </div>
                        ) : null}
                      </div>

                      <p className="mb-4 text-slate-400">
                        {problem.description.length > 180
                          ? `${problem.description.slice(0, 180)}...`
                          : problem.description}
                      </p>

                      <div className="mb-4 flex flex-wrap gap-2">
                        {problem.tags.map((tag) => (
                          <span
                            key={tag}
                            className="flex items-center gap-1 rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300"
                          >
                            <Tag className="h-3 w-3" />
                            {tag}
                          </span>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center gap-6 text-sm text-slate-400">
                        <span className="rounded bg-slate-800 px-2 py-1 text-xs font-semibold">
                          {problem.category}
                        </span>
                        <span
                          className={`rounded px-2 py-1 text-xs font-semibold ${
                            problem.difficulty === "Easy"
                              ? "bg-green-500/10 text-green-400"
                              : problem.difficulty === "Medium"
                                ? "bg-yellow-500/10 text-yellow-400"
                                : "bg-red-500/10 text-red-400"
                          }`}
                        >
                          {problem.difficulty}
                        </span>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {timeAgo(problem.createdAt)}
                        </div>
                        <div>{problem.domain}</div>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {problem.stats.activeTeamsCount} teams
                        </div>
                        <div className="flex items-center gap-1">
                          <Trophy className="h-4 w-4" />
                          {problem.stats.approvedTeamsCount} approved
                        </div>
                        {problem.stats.topPointsAwarded > 0 ? (
                          <div className="text-cyan-300">
                            Top score: {problem.stats.topPointsAwarded}{" "}
                            innovation points
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 border-t border-slate-800 pt-4">
                    <button
                      onClick={() => setSelectedProblemId(problem._id)}
                      className="flex-1 rounded-lg bg-slate-800 px-6 py-3 font-semibold text-white transition-colors hover:bg-slate-700"
                    >
                      View Details
                    </button>

                    {workspaceId ? (
                      <button
                        onClick={() =>
                          navigate(`/product-workspace/${workspaceId}`)
                        }
                        className="flex-1 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3 font-semibold text-white"
                      >
                        Open Product Workspace
                      </button>
                    ) : canClaimProblems ? (
                      <button
                        onClick={() => void startProblem(problem)}
                        disabled={Boolean(startingProblemId)}
                        className="flex-1 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 font-semibold text-white transition-all disabled:opacity-60"
                      >
                        {startingProblemId === problem._id
                          ? "Starting..."
                          : "Start Problem"}
                      </button>
                    ) : (
                      <div className="flex flex-1 items-center justify-center rounded-lg border border-slate-800 bg-slate-950 px-6 py-3 text-sm text-slate-400">
                        View-only access
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {problemsQuery.hasNextPage ? (
          <div className="flex justify-center">
            <button
              onClick={() => problemsQuery.fetchNextPage()}
              disabled={problemsQuery.isFetchingNextPage}
              className="flex items-center gap-2 rounded-lg bg-slate-800 px-6 py-3 font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-60"
            >
              {problemsQuery.isFetchingNextPage ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Load More Problems
            </button>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center">
            <div className="text-2xl font-bold text-white">
              {problemsQuery.data?.pages[0]?.meta.total ?? 0}
            </div>
            <div className="mt-2 text-sm text-slate-400">
              Published Problems
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center">
            <div className="text-2xl font-bold text-white">{activeTeams}</div>
            <div className="mt-2 text-sm text-slate-400">
              Active Team Attempts
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center">
            <div className="text-2xl font-bold text-white">{approvedTeams}</div>
            <div className="mt-2 text-sm text-slate-400">
              Approved Team Solutions
            </div>
          </div>
        </div>

        {selectedProblem ? (
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm sm:p-6"
            onClick={closeDetails}
          >
            <div
              className="mx-auto flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl sm:max-h-[calc(100vh-3rem)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4 sm:px-8">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={closeDetails}
                    className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-white"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to problems
                  </button>
                  <h2 className="text-2xl font-bold text-white">
                    {selectedProblem.title}
                  </h2>
                  <p className="mt-2 text-slate-400">
                    {selectedProblem.domain} / {selectedProblem.category}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeDetails}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                  aria-label="Close problem details"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6">
                <p className="mb-6 leading-7 text-slate-300">
                  {selectedProblem.description}
                </p>

                <div className="mb-6 grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <div className="mb-2 text-xs uppercase tracking-[0.25em] text-slate-500">
                      Teams Attempting
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {selectedProblem.stats.activeTeamsCount}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <div className="mb-2 text-xs uppercase tracking-[0.25em] text-slate-500">
                      Approved Teams
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {selectedProblem.stats.approvedTeamsCount}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <div className="mb-2 text-xs uppercase tracking-[0.25em] text-slate-500">
                      Best Innovation Points
                    </div>
                    <div className="text-2xl font-bold text-cyan-300">
                      {selectedProblem.stats.topPointsAwarded} pts
                    </div>
                  </div>
                </div>

                {selectedProblem.viewerState ? (
                  <div className="mb-6 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                    <div className="mb-3 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xs uppercase tracking-[0.25em] text-cyan-300">
                          Your Team
                        </div>
                        <div className="mt-2 text-lg font-semibold text-white">
                          Workspace linked to this problem
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `/product-workspace/${selectedProblem.viewerState?.workspaceId}`,
                          )
                        }
                        className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white"
                      >
                        Open Product Workspace
                      </button>
                    </div>

                    <div className="grid gap-3 text-sm text-slate-300 md:grid-cols-3">
                      <div>
                        <span className="text-slate-500">Status:</span>{" "}
                        {
                          getViewerStatusStyles(selectedProblem.viewerState)
                            ?.label
                        }
                      </div>
                      <div>
                        <span className="text-slate-500">Progress:</span>{" "}
                        {selectedProblem.viewerState.progressPercent}%
                      </div>
                      <div>
                        <span className="text-slate-500">Team size:</span>{" "}
                        {selectedProblem.viewerState.teamSize}
                      </div>
                    </div>

                    {selectedProblem.viewerState.reviewedAt ? (
                      <div className="mt-3 text-sm text-slate-400">
                        Reviewed on{" "}
                        {new Date(
                          selectedProblem.viewerState.reviewedAt,
                        ).toLocaleDateString("en-IN")}
                      </div>
                    ) : null}

                    {selectedProblem.viewerState.adminNotes ? (
                      <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-slate-300">
                        <div className="mb-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                          Admin Notes
                        </div>
                        {selectedProblem.viewerState.adminNotes}
                      </div>
                    ) : null}

                    {selectedProblem.viewerState.status === "approved" ? (
                      <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                        Approved. Your team earned{" "}
                        {selectedProblem.viewerState.pointsAwarded ?? 0}{" "}
                        innovation points for this problem.
                      </div>
                    ) : selectedProblem.viewerState.status ===
                      "review_requested" ? (
                      <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">
                        Review request sent. The admin team will verify your
                        completion and award innovation points.
                      </div>
                    ) : (
                      <div className="mt-4 space-y-3">
                        <div className="text-sm text-slate-400">
                          {selectedProblem.viewerState.status ===
                          "changes_requested"
                            ? "Update the workspace evidence if needed, then request another review."
                            : "When your team is done, send a review request to the admin team."}
                        </div>
                        <textarea
                          value={reviewNote}
                          onChange={(event) =>
                            setReviewNote(event.target.value)
                          }
                          placeholder="Summarize what your team completed, what evidence is available in the workspace, and what the admin should review."
                          className="min-h-[120px] w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={requestReview}
                          disabled={
                            reviewMutation.isPending ||
                            reviewNote.trim().length < 20
                          }
                          className="rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-60"
                        >
                          {reviewMutation.isPending
                            ? "Sending Review..."
                            : "Send Review Request"}
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}

                <div className="mb-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <div className="mb-3 text-xs uppercase tracking-[0.25em] text-slate-500">
                      Problem Details
                    </div>
                    <div className="space-y-2 text-sm text-slate-300">
                      <div>
                        <span className="text-slate-500">Domain:</span>{" "}
                        {selectedProblem.domain}
                      </div>
                      <div>
                        <span className="text-slate-500">Category:</span>{" "}
                        {selectedProblem.category}
                      </div>
                      <div>
                        <span className="text-slate-500">Difficulty:</span>{" "}
                        {selectedProblem.difficulty}
                      </div>
                      {selectedProblem.geography ? (
                        <div>
                          <span className="text-slate-500">Geography:</span>{" "}
                          {selectedProblem.geography}
                        </div>
                      ) : null}
                      {selectedProblem.sponsorName ? (
                        <div>
                          <span className="text-slate-500">Sponsor:</span>{" "}
                          {selectedProblem.sponsorName}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <div className="mb-3 text-xs uppercase tracking-[0.25em] text-slate-500">
                      Submission Policy
                    </div>
                    <div className="space-y-2 text-sm text-slate-300">
                      <div>
                        Documents:{" "}
                        {selectedProblem.submissionConfig.allowDocuments
                          ? "Allowed"
                          : "Not allowed"}
                      </div>
                      <div>
                        Images:{" "}
                        {selectedProblem.submissionConfig.allowImages
                          ? "Allowed"
                          : "Not allowed"}
                      </div>
                      <div>
                        GitHub repos:{" "}
                        {selectedProblem.submissionConfig.allowGithubRepos
                          ? `Up to ${selectedProblem.submissionConfig.maxRepoLinks}`
                          : "Not allowed"}
                      </div>
                      <div>
                        Code snippets:{" "}
                        {selectedProblem.submissionConfig.allowCodeSnippets
                          ? `Up to ${selectedProblem.submissionConfig.maxCodeSnippets}`
                          : "Not allowed"}
                      </div>
                      <div>
                        Max file size:{" "}
                        {selectedProblem.submissionConfig.maxFileSizeMb} MB
                      </div>
                    </div>
                  </div>
                </div>

                {selectedProblem.deliverables.length > 0 ? (
                  <div className="mb-6 rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <div className="mb-3 text-xs uppercase tracking-[0.25em] text-slate-500">
                      Deliverables
                    </div>
                    <ul className="space-y-2 text-sm text-slate-300">
                      {selectedProblem.deliverables.map((item) => (
                        <li key={item}>- {item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {selectedProblem.acceptanceCriteria.length > 0 ? (
                  <div className="mb-6 rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <div className="mb-3 text-xs uppercase tracking-[0.25em] text-slate-500">
                      Acceptance Criteria
                    </div>
                    <ul className="space-y-2 text-sm text-slate-300">
                      {selectedProblem.acceptanceCriteria.map((item) => (
                        <li key={item}>- {item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="mb-6 rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-slate-500">
                    <Target className="h-4 w-4" />
                    Problem Leaderboard
                  </div>
                  {leaderboardQuery.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading leaderboard...
                    </div>
                  ) : leaderboardQuery.data?.items.length ? (
                    <div className="space-y-3">
                      {leaderboardQuery.data.items
                        .slice(0, 5)
                        .map((entry) => leaderboardRow(entry))}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-400">
                      No approved team submissions yet. Be the first team on
                      this leaderboard.
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <div className="mb-2 text-xs uppercase tracking-[0.25em] text-amber-300">
                    Security Notice
                  </div>
                  <div className="text-sm text-slate-300">
                    {selectedProblem.securityNotice}
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-800 px-5 py-4 sm:flex-row sm:justify-end sm:px-8">
                <button
                  type="button"
                  onClick={closeDetails}
                  className="rounded-lg bg-slate-800 px-5 py-3 font-semibold text-white transition hover:bg-slate-700"
                >
                  Close
                </button>
                {selectedProblemWorkspaceId ? (
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/product-workspace/${selectedProblemWorkspaceId}`)
                    }
                    className="rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-3 font-semibold text-white"
                  >
                    Open Product Workspace
                  </button>
                ) : canClaimProblems ? (
                  <button
                    type="button"
                    onClick={() => void startProblem(selectedProblem)}
                    disabled={Boolean(startingProblemId)}
                    className="rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-3 font-semibold text-white disabled:opacity-60"
                  >
                    {startingProblemId === selectedProblem._id
                      ? "Starting..."
                      : "Start Problem"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
