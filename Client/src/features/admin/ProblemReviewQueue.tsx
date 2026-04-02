import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/admin.api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { getApiErrorMessage } from '../../utils/apiError';

export default function ProblemReviewQueue() {
  const queryClient = useQueryClient();
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [reviewPoints, setReviewPoints] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);

  const reviewQueueQuery = useQuery({
    queryKey: ['admin-problem-review-requests'],
    queryFn: () => adminApi.getProblemReviewRequests({ status: 'review_requested' }),
  });

  const reviewMutation = useMutation({
    mutationFn: (payload: {
      submissionId: string;
      decision: 'approved' | 'changes_requested';
      pointsAwarded?: number;
      adminNotes?: string;
    }) =>
      adminApi.reviewProblemSubmission(payload.submissionId, {
        decision: payload.decision,
        pointsAwarded: payload.pointsAwarded,
        adminNotes: payload.adminNotes,
      }),
    onSuccess: () => {
      setFeedback({
        tone: 'success',
        message: 'Review decision saved.',
      });
      void queryClient.invalidateQueries({ queryKey: ['admin-problem-review-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-problems'] });
    },
    onError: (error) => {
      setFeedback({
        tone: 'error',
        message: getApiErrorMessage(error, 'Unable to save the review decision right now.'),
      });
    },
  });

  return (
    <div className="space-y-6">
      {feedback ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            feedback.tone === 'success'
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-500/20 bg-rose-500/10 text-rose-200'
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <Card className="p-6">
        <div className="mb-4 text-xs uppercase tracking-[0.25em] text-cyan-300">Review Queue</div>
        <div className="space-y-4">
          {reviewQueueQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : (reviewQueueQuery.data ?? []).length === 0 ? (
            <div className="text-sm text-slate-400">No problem reviews are waiting.</div>
          ) : (
            (reviewQueueQuery.data ?? []).map((item) => (
              <div key={item._id} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-lg font-semibold text-white">{item.problem.title}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {item.owner.displayName} / {item.workspace.title}
                    </div>
                    <div className="mt-3 text-sm text-slate-300">{item.requestNote}</div>
                    <div className="mt-3 text-xs text-slate-500">
                      Progress {item.workspace.progressPercent}% / uploads {item.workspace.evidenceSummary.uploadsCount} /
                      repos {item.workspace.evidenceSummary.repoCount} / code {item.workspace.evidenceSummary.codeCount}
                    </div>
                  </div>
                  <div className="w-full max-w-sm space-y-3">
                    <input
                      value={reviewPoints[item._id] ?? ''}
                      onChange={(event) =>
                        setReviewPoints((current) => ({
                          ...current,
                          [item._id]: event.target.value,
                        }))
                      }
                      placeholder="Points awarded"
                      className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-white"
                    />
                    <textarea
                      value={reviewNotes[item._id] ?? ''}
                      onChange={(event) =>
                        setReviewNotes((current) => ({
                          ...current,
                          [item._id]: event.target.value,
                        }))
                      }
                      placeholder="Admin notes"
                      className="min-h-[90px] w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-white"
                    />
                    <div className="flex gap-3">
                      <Button
                        onClick={() =>
                          reviewMutation.mutate({
                            submissionId: item._id,
                            decision: 'approved',
                            pointsAwarded: Number(reviewPoints[item._id] ?? 0),
                            adminNotes: reviewNotes[item._id],
                          })
                        }
                        disabled={reviewMutation.isPending || !reviewPoints[item._id]}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() =>
                          reviewMutation.mutate({
                            submissionId: item._id,
                            decision: 'changes_requested',
                            adminNotes: reviewNotes[item._id],
                          })
                        }
                        disabled={reviewMutation.isPending}
                      >
                        Request Changes
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
