import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, CheckCircle, Clock, FileText, Send } from "lucide-react";
import { DashboardLayout } from "../components/DashboardLayout";
import { patentApi } from "../../api/patent.api";
import { workspaceApi } from "../../api/workspace.api";

const QUESTIONS = [
  { key: "whatIsYourInnovation", label: "What is your innovation? Describe it in simple terms." },
  { key: "noveltyExplanation", label: "What makes it novel or unique? How is it different from existing solutions?" },
  { key: "technicalDetails", label: "Explain the technical details of how your innovation works." },
  { key: "marketUseCase", label: "What is the real-world market use case for your innovation?" },
  { key: "priorArtAwareness", label: "Are you aware of any prior art or similar existing patents/products?" },
] as const;

type QuestionKey = (typeof QUESTIONS)[number]["key"];

export function PatentSupport() {
  const queryClient = useQueryClient();
  const [workspaceId, setWorkspaceId] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<Record<QuestionKey, string>>({
    whatIsYourInnovation: "",
    noveltyExplanation: "",
    technicalDetails: "",
    marketUseCase: "",
    priorArtAwareness: "",
  });

  const workspacesQuery = useQuery({ queryKey: ["workspaces"], queryFn: () => workspaceApi.list() });
  const patentsQuery = useQuery({ queryKey: ["patents", "mine"], queryFn: () => patentApi.mine() });

  const activeWorkspace = useMemo(
    () => workspacesQuery.data?.find((item) => item._id === workspaceId) ?? workspacesQuery.data?.[0],
    [workspaceId, workspacesQuery.data],
  );

  const submitPatent = useMutation({
    mutationFn: () =>
      patentApi.submit({
        projectTitle: projectTitle || activeWorkspace?.title || "Untitled innovation",
        workspaceId: activeWorkspace?._id,
        questionnaire: answers,
      }),
    onSuccess: async () => {
      setSubmitted(true);
      setError("");
      await queryClient.invalidateQueries({ queryKey: ["patents", "mine"] });
      await queryClient.invalidateQueries({ queryKey: ["score", "me"] });
    },
    onError: (mutationError) => {
      setError(
        (mutationError as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
          "Unable to submit your patent questionnaire right now.",
      );
    },
  });

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Patent Support System</h1>
            <p className="text-slate-400">Step 1 of 1 — Questionnaire</p>
          </div>
          <div className="px-4 py-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-sm text-purple-300">
            Minimum 50 characters required for each answer
          </div>
        </div>

        {submitted ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Patent questionnaire submitted</h2>
            <p className="text-slate-300 max-w-2xl mx-auto">
              Your patent questionnaire has been submitted. Our IPR expert team will contact you within 2-3 business days via phone or Google Meet.
            </p>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Project</label>
                <select
                  value={workspaceId || activeWorkspace?._id || ""}
                  onChange={(event) => {
                    const nextId = event.target.value;
                    setWorkspaceId(nextId);
                    const nextWorkspace = workspacesQuery.data?.find((item) => item._id === nextId);
                    setProjectTitle(nextWorkspace?.title ?? "");
                  }}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white"
                >
                  {(workspacesQuery.data ?? []).map((workspace) => (
                    <option key={workspace._id} value={workspace._id}>
                      {workspace.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Project title for filing</label>
                <input
                  value={projectTitle || activeWorkspace?.title || ""}
                  onChange={(event) => setProjectTitle(event.target.value)}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white"
                />
              </div>
            </div>

            <div className="space-y-5">
              {QUESTIONS.map((question, index) => (
                <div key={question.key}>
                  <label className="block text-sm font-semibold text-white mb-2">
                    {index + 1}. {question.label}
                  </label>
                  <textarea
                    value={answers[question.key]}
                    onChange={(event) => setAnswers((current) => ({ ...current, [question.key]: event.target.value }))}
                    className="w-full min-h-32 px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                  <div className={`mt-2 text-xs ${answers[question.key].trim().length >= 50 ? "text-green-400" : "text-slate-500"}`}>
                    {answers[question.key].trim().length} / 50 characters
                  </div>
                </div>
              ))}
            </div>

            {error ? <div className="mt-5 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div> : null}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => submitPatent.mutate()}
                disabled={submitPatent.isPending}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold flex items-center gap-2 disabled:opacity-60"
              >
                <Send className="w-4 h-4" />
                Submit for Patent Review
              </button>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Existing submissions</h2>
            <div className="space-y-3">
              {(patentsQuery.data ?? []).map((patent) => (
                <div key={patent._id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-white">{patent.projectTitle}</div>
                    <div className="text-sm text-slate-400">Submitted {new Date(patent.submittedAt).toLocaleDateString("en-IN")}</div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      patent.status === "approved"
                        ? "bg-green-500/10 text-green-400"
                        : patent.status === "rejected"
                          ? "bg-red-500/10 text-red-400"
                          : patent.status === "under_review"
                            ? "bg-blue-500/10 text-blue-400"
                            : "bg-yellow-500/10 text-yellow-400"
                    }`}
                  >
                    {patent.status.replace("_", " ")}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-gradient-to-br from-yellow-900/20 to-orange-900/20 border border-yellow-800/30 rounded-xl p-6">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center mb-4">
                <Award className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-white mb-2">ProMove IPR Services</h3>
              <p className="text-sm text-slate-400 mb-4">Professional patent filing support included</p>
              <ul className="space-y-2 text-sm text-slate-300">
                <li>Expert review for novelty and readiness</li>
                <li>Prior-art and positioning support</li>
                <li>Submission workflow guidance</li>
              </ul>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="font-bold text-white mb-4">Submission Flow</h3>
              <div className="space-y-3 text-sm text-slate-300">
                <div className="flex items-center gap-3"><FileText className="w-4 h-4 text-blue-400" />Questionnaire completed</div>
                <div className="flex items-center gap-3"><Clock className="w-4 h-4 text-purple-400" />Review begins after submission</div>
                <div className="flex items-center gap-3"><CheckCircle className="w-4 h-4 text-green-400" />Status updates appear here automatically</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
