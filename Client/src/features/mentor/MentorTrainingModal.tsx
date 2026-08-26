import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  HelpCircle,
  RotateCcw,
  Sparkles,
  Trophy,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { mentorScoreApi, MentorScoreEvent } from '../../api/mentorScore.api';
import { MENTOR_TRAINING_MODULES, TrainingModule } from './mentorTrainingData';

interface MentorTrainingModalProps {
  isOpen: boolean;
  onClose: () => void;
  trainingPoints?: number;
  events?: MentorScoreEvent[];
  onQuizCompleted?: () => void;
}

type ModalView = 'catalog' | 'quiz' | 'result';

export function MentorTrainingModal({
  isOpen,
  onClose,
  trainingPoints = 0,
  events = [],
  onQuizCompleted,
}: MentorTrainingModalProps) {
  const queryClient = useQueryClient();

  const [activeModule, setActiveModule] = useState<TrainingModule | null>(null);
  const [view, setView] = useState<ModalView>('catalog');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [quizScore, setQuizScore] = useState<{ correct: number; total: number; percentage: number; passed: boolean } | null>(null);

  // Set of quiz IDs already completed by the mentor
  const completedQuizIds = useMemo(() => {
    const passed = new Set<string>();
    for (const evt of events) {
      if (evt.trigger === 'QUIZ_PASSED' && evt.metadata?.quizId) {
        passed.add(String(evt.metadata.quizId));
      }
      if (evt.trigger === 'TRAINING_MODULE_COMPLETED' && evt.metadata?.moduleId) {
        passed.add(String(evt.metadata.moduleId));
      }
    }
    return passed;
  }, [events]);

  const quizMutation = useMutation({
    mutationFn: (variables: { quizId: string; quizPoints: number }) =>
      mentorScoreApi.completeQuiz(variables),
    onSuccess: () => {
      toast.success('+15 pts awarded to your Mentor Score!', {
        description: 'Your Phase 1 Training points have been updated.',
      });
      void queryClient.invalidateQueries({ queryKey: ['mentor-score'] });
      void queryClient.invalidateQueries({ queryKey: ['mentor-score-history'] });
      onQuizCompleted?.();
    },
    onError: (err: Error) => {
      // If error is duplicate/idempotency, still treat as recorded
      if (err.message?.includes('duplicate') || err.message?.includes('already')) {
        void queryClient.invalidateQueries({ queryKey: ['mentor-score'] });
        return;
      }
      toast.error(err.message || 'Failed to submit quiz score');
    },
  });

  if (!isOpen) return null;

  const handleStartQuiz = (mod: TrainingModule) => {
    setActiveModule(mod);
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setQuizScore(null);
    setView('quiz');
  };

  const handleSelectOption = (questionId: string, optionId: string) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionId,
    }));
  };

  const handleSubmitQuiz = () => {
    if (!activeModule) return;

    let correctCount = 0;
    const total = activeModule.questions.length;

    for (const q of activeModule.questions) {
      if (selectedAnswers[q.id] === q.correctOptionId) {
        correctCount += 1;
      }
    }

    const percentage = Math.round((correctCount / total) * 100);
    const passed = percentage >= 75; // 75% passing cutoff (at least 3/4)

    setQuizScore({
      correct: correctCount,
      total,
      percentage,
      passed,
    });
    setView('result');

    // If passed and not already awarded, submit to backend
    if (passed && !completedQuizIds.has(activeModule.quizId)) {
      quizMutation.mutate({
        quizId: activeModule.quizId,
        quizPoints: activeModule.points,
      });
    }
  };

  const handleBackToCatalog = () => {
    setView('catalog');
    setActiveModule(null);
    setSelectedAnswers({});
    setQuizScore(null);
  };

  const handleRetake = () => {
    if (!activeModule) return;
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setQuizScore(null);
    setView('quiz');
  };

  const currentQuestion = activeModule?.questions[currentQuestionIndex];
  const allAnswered = activeModule?.questions.every((q) => selectedAnswers[q.id] !== undefined) ?? false;
  const isCurrentAnswered = currentQuestion ? selectedAnswers[currentQuestion.id] !== undefined : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-fadeIn">
      <div className="flex h-full max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                Mentor Training & Certification
              </h2>
              <p className="text-xs text-slate-400">
                Phase 1: Foundation & Readiness (Up to 60 pts)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* VIEW A: CATALOG */}
          {view === 'catalog' && (
            <div className="space-y-6">
              {/* Progress Banner */}
              <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/40 via-slate-900 to-slate-900 p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                        Certification Progress
                      </span>
                      <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs font-medium text-cyan-300">
                        {trainingPoints} / 60 pts
                      </span>
                    </div>
                    <h3 className="mt-1 text-lg font-bold text-white">
                      {trainingPoints >= 60
                        ? 'Training & Quizzes Fully Completed!'
                        : 'Complete modules to boost your Mentor Score'}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Earn +15 points per certified module to maximize your Phase 1 rank.
                    </p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/20 text-cyan-400">
                    <Trophy className="h-6 w-6" />
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.round((trainingPoints / 60) * 100))}%` }}
                  />
                </div>
              </div>

              {/* Module Cards Grid */}
              <div className="space-y-3.5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Available Certification Modules (4)
                </h4>

                {MENTOR_TRAINING_MODULES.map((mod, idx) => {
                  const isCompleted =
                    completedQuizIds.has(mod.quizId) ||
                    (trainingPoints >= (idx + 1) * 15);

                  return (
                    <div
                      key={mod.id}
                      className={`group relative rounded-2xl border p-5 transition ${
                        isCompleted
                          ? 'border-emerald-500/30 bg-emerald-950/10'
                          : 'border-slate-800 bg-slate-950/50 hover:border-slate-700 hover:bg-slate-950'
                      }`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-300">
                              {mod.category}
                            </span>
                            <span className="flex items-center gap-1 text-[11px] text-slate-400">
                              <Clock className="h-3 w-3" />
                              ~{mod.estimatedMinutes} mins
                            </span>
                            <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-medium text-cyan-400">
                              +{mod.points} pts
                            </span>
                          </div>

                          <h5 className="mt-2 text-base font-semibold text-white">
                            {idx + 1}. {mod.title}
                          </h5>
                          <p className="mt-1 text-xs text-slate-400">
                            {mod.shortDescription}
                          </p>
                        </div>

                        <div className="shrink-0">
                          {isCompleted ? (
                            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-400">
                              <CheckCircle2 className="h-4 w-4" />
                              Certified (+{mod.points} pts)
                            </div>
                          ) : (
                            <button
                              onClick={() => handleStartQuiz(mod)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 hover:bg-cyan-400 transition"
                            >
                              Take Quiz
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW B: INTERACTIVE QUIZ RUNNER */}
          {view === 'quiz' && activeModule && currentQuestion && (
            <div className="space-y-6">
              {/* Quiz Header & Step Counter */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <button
                    onClick={handleBackToCatalog}
                    className="text-xs text-slate-400 hover:text-white transition flex items-center gap-1 mb-1"
                  >
                    ← Back to Modules
                  </button>
                  <h3 className="text-base font-bold text-white">
                    {activeModule.title}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold text-cyan-400">
                    Question {currentQuestionIndex + 1} of {activeModule.questions.length}
                  </span>
                  <div className="text-[11px] text-slate-400">
                    Pass cutoff: 75%
                  </div>
                </div>
              </div>

              {/* Progress step dots */}
              <div className="flex gap-1.5">
                {activeModule.questions.map((q, idx) => (
                  <div
                    key={q.id}
                    className={`h-1.5 flex-1 rounded-full transition-all ${
                      idx === currentQuestionIndex
                        ? 'bg-cyan-400'
                        : selectedAnswers[q.id]
                          ? 'bg-cyan-900'
                          : 'bg-slate-800'
                    }`}
                  />
                ))}
              </div>

              {/* Question Card */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300">
                  <HelpCircle className="h-3.5 w-3.5 text-cyan-400" />
                  Scenario Question {currentQuestionIndex + 1}
                </span>

                <h4 className="mt-3 text-base font-medium leading-relaxed text-white">
                  {currentQuestion.question}
                </h4>

                {/* Option choices */}
                <div className="mt-6 space-y-2.5">
                  {currentQuestion.options.map((opt) => {
                    const isSelected = selectedAnswers[currentQuestion.id] === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSelectOption(currentQuestion.id, opt.id)}
                        className={`flex w-full items-center gap-3.5 rounded-xl border p-4 text-left text-sm transition ${
                          isSelected
                            ? 'border-cyan-500 bg-cyan-500/10 text-white shadow-sm'
                            : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                        }`}
                      >
                        <div
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${
                            isSelected
                              ? 'border-cyan-400 bg-cyan-400 text-slate-950'
                              : 'border-slate-700 bg-slate-800 text-slate-400'
                          }`}
                        >
                          {opt.id.toUpperCase()}
                        </div>
                        <span className="flex-1">{opt.text}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quiz Navigation Footer */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                  disabled={currentQuestionIndex === 0}
                  className="rounded-xl border border-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  Previous
                </button>

                {currentQuestionIndex < activeModule.questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
                    disabled={!isCurrentAnswered}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-500 px-5 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    Next Question
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmitQuiz}
                    disabled={!allAnswered || quizMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    {quizMutation.isPending ? 'Submitting...' : 'Submit & Grade Quiz'}
                    <Sparkles className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* VIEW C: RESULTS & FEEDBACK */}
          {view === 'result' && activeModule && quizScore && (
            <div className="space-y-6 text-center">
              {quizScore.passed ? (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-8">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <Award className="h-8 w-8" />
                  </div>
                  <h3 className="mt-4 text-xl font-bold text-white">
                    Congratulations! You Passed!
                  </h3>
                  <p className="mt-1 text-sm text-emerald-400 font-medium">
                    Score: {quizScore.correct} / {quizScore.total} ({quizScore.percentage}%)
                  </p>
                  <p className="mt-2 text-xs text-slate-400 max-w-md mx-auto">
                    You have successfully demonstrated mastery in <strong className="text-white">{activeModule.title}</strong>. +{activeModule.points} points have been credited to your Mentor Score!
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-8">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    <XCircle className="h-8 w-8" />
                  </div>
                  <h3 className="mt-4 text-xl font-bold text-white">
                    Almost there!
                  </h3>
                  <p className="mt-1 text-sm text-rose-400 font-medium">
                    Score: {quizScore.correct} / {quizScore.total} ({quizScore.percentage}%)
                  </p>
                  <p className="mt-2 text-xs text-slate-400 max-w-md mx-auto">
                    A minimum passing score of 75% is required to earn certification points. Review the key explanations below and try again.
                  </p>
                </div>
              )}

              {/* Question-by-Question Review */}
              <div className="space-y-3 text-left">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Question Review & Explanations
                </h4>
                {activeModule.questions.map((q, idx) => {
                  const userAns = selectedAnswers[q.id];
                  const isCorrect = userAns === q.correctOptionId;

                  return (
                    <div
                      key={q.id}
                      className={`rounded-xl border p-4 text-xs ${
                        isCorrect
                          ? 'border-emerald-500/20 bg-emerald-950/10'
                          : 'border-rose-500/20 bg-rose-950/10'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {isCorrect ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                        ) : (
                          <XCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white">
                            {idx + 1}. {q.question}
                          </p>
                          <p className="mt-1 text-slate-400">
                            <span className="text-slate-300 font-medium">Explanation:</span> {q.explanation}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action CTA Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
                {!quizScore.passed && (
                  <button
                    type="button"
                    onClick={handleRetake}
                    className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-6 py-2.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400 transition"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Retake Quiz
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleBackToCatalog}
                  className="rounded-xl border border-slate-800 bg-slate-900 px-6 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition"
                >
                  Back to Training Modules
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
