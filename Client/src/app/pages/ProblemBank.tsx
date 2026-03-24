import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Search, Filter, TrendingUp, Clock, Tag, Plus, CheckCircle, Loader2 } from "lucide-react";
import { DashboardLayout } from "../components/DashboardLayout";
import { problemBankApi } from "../../api/problemBank.api";
import { useAuthStore } from "../../store/authStore";
import { Problem } from "../../types/problem.types";

const categoryOptions = [
  "All Problems",
  "Agriculture",
  "Environment",
  "Healthcare",
  "Technology",
  "Education",
  "Rural Development",
  "Other",
];

const timeAgo = (value: string) => {
  const milliseconds = Date.now() - new Date(value).getTime();
  const days = Math.max(1, Math.round(milliseconds / (1000 * 60 * 60 * 24)));
  return days === 1 ? "1 day ago" : `${days} days ago`;
};

export function ProblemBank() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);
  const [selectedCategory, setSelectedCategory] = useState("All Problems");
  const [searchValue, setSearchValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearchQuery(searchValue), 300);
    return () => window.clearTimeout(timeout);
  }, [searchValue]);

  const problemsQuery = useInfiniteQuery({
    queryKey: ["problems", selectedCategory, searchQuery],
    queryFn: ({ pageParam = 1 }) =>
      problemBankApi.list({
        page: pageParam,
        limit: 6,
        search: searchQuery || undefined,
        category: selectedCategory === "All Problems" ? undefined : selectedCategory,
      }),
    getNextPageParam: (lastPage) => {
      const { meta } = lastPage;
      return meta.page * meta.limit < meta.total ? meta.page + 1 : undefined;
    },
    initialPageParam: 1,
  });

  const claimMutation = useMutation({
    mutationFn: (problemId: string) => problemBankApi.claim(problemId),
    onSuccess: (workspace) => {
      setFeedback("Problem claimed successfully. Your workspace is ready.");
      navigate(`/product-workspace/${workspace._id}`);
    },
    onError: (error) => {
      const message =
        (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        "Unable to claim this problem right now.";
      setFeedback(message);
    },
  });

  const problems = useMemo(
    () => problemsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [problemsQuery.data],
  );

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Problem Bank</h1>
            <p className="text-slate-400">Global repository of real-world problems waiting to be solved</p>
          </div>
          <button className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold transition-all flex items-center gap-2 opacity-80">
            <Plus className="w-5 h-5" />
            Submit Problem
          </button>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search problems..."
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Student Search
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {categoryOptions.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedCategory === category
                  ? "bg-blue-600 text-white"
                  : "bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {feedback ? (
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-300 text-sm">{feedback}</div>
        ) : null}

        <div className="space-y-4">
          {problems.map((problem) => {
            const isClaimedByMe = Boolean(problem.claimedBy && problem.claimedBy === currentUser?._id);
            const isClaimedByOther = Boolean(problem.claimedBy && problem.claimedBy !== currentUser?._id);

            return (
              <div key={problem._id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-all">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="text-xl font-bold text-white">{problem.title}</h3>
                      {problem.isVerified ? (
                        <div className="px-2 py-1 bg-green-500/10 rounded text-xs text-green-400 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Verified
                        </div>
                      ) : null}
                      {isClaimedByMe ? (
                        <div className="px-2 py-1 bg-blue-500/10 rounded text-xs text-blue-400">Already Claimed</div>
                      ) : null}
                      {isClaimedByOther ? (
                        <div className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-300">Claimed</div>
                      ) : null}
                    </div>
                    <p className="text-slate-400 mb-4">
                      {problem.description.length > 180 ? `${problem.description.slice(0, 180)}...` : problem.description}
                    </p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {problem.tags.map((tag) => (
                        <span key={tag} className="px-3 py-1 bg-slate-800 rounded-full text-xs text-slate-300 flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-6 text-sm text-slate-400 flex-wrap">
                      <span className="px-2 py-1 bg-slate-800 rounded text-xs font-semibold">{problem.category}</span>
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
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
                        <Clock className="w-4 h-4" />
                        {timeAgo(problem.createdAt)}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-500">by</span> {problem.postedBy}
                      </div>
                      <div>{problem.domain}</div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 pt-4 border-t border-slate-800">
                  <button
                    onClick={() => setSelectedProblem(problem)}
                    className="flex-1 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold transition-colors"
                  >
                    View Details
                  </button>
                  {!problem.claimedBy ? (
                    <button
                      onClick={() => claimMutation.mutate(problem._id)}
                      disabled={claimMutation.isPending}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-semibold transition-all disabled:opacity-60"
                    >
                      {claimMutation.isPending ? "Claiming..." : "Claim & Start Solving"}
                    </button>
                  ) : (
                    <button className="flex-1 px-6 py-3 bg-slate-800 text-slate-500 rounded-lg font-semibold cursor-not-allowed">
                      {isClaimedByMe ? "Already Claimed" : "Claimed"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {problemsQuery.hasNextPage ? (
          <div className="flex justify-center">
            <button
              onClick={() => problemsQuery.fetchNextPage()}
              disabled={problemsQuery.isFetchingNextPage}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-60 flex items-center gap-2"
            >
              {problemsQuery.isFetchingNextPage ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Load More Problems
            </button>
          </div>
        ) : null}

        <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-800/30 rounded-xl p-6">
          <div className="grid md:grid-cols-3 gap-6 text-center">
            <div>
              <TrendingUp className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white mb-1">{problemsQuery.data?.pages[0]?.meta.total ?? 0}</div>
              <div className="text-sm text-slate-400">Active Problems</div>
            </div>
            <div>
              <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white mb-1">{problems.filter((item) => item.isVerified).length}</div>
              <div className="text-sm text-slate-400">Verified Challenges</div>
            </div>
            <div>
              <Tag className="w-8 h-8 text-purple-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white mb-1">{new Set(problems.map((item) => item.domain)).size}</div>
              <div className="text-sm text-slate-400">Domains</div>
            </div>
          </div>
        </div>

        {selectedProblem ? (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl p-8">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">{selectedProblem.title}</h2>
                  <p className="text-slate-400">{selectedProblem.domain} • {selectedProblem.category}</p>
                </div>
                <button onClick={() => setSelectedProblem(null)} className="text-slate-400 hover:text-white">
                  Close
                </button>
              </div>
              <p className="text-slate-300 leading-7 mb-6">{selectedProblem.description}</p>
              <div className="flex flex-wrap gap-2 mb-6">
                {selectedProblem.tags.map((tag) => (
                  <span key={tag} className="px-3 py-1 bg-slate-800 rounded-full text-xs text-slate-300">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setSelectedProblem(null)} className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold">
                  Close
                </button>
                {!selectedProblem.claimedBy ? (
                  <button
                    onClick={() => claimMutation.mutate(selectedProblem._id)}
                    className="px-5 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold"
                  >
                    Claim & Start Solving
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
