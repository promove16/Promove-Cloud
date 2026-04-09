import { Fragment } from 'react';
import { APPLICATION_STAGE_BADGE, getStudentApplicationProgress } from '../../utils/applicationStages';
import type { RecruiterStudentApplicationView } from '../../types/recruiter.types';

const TONE_CLASSES = {
  default: {
    connector: 'bg-cyan-400/70',
    current: 'border-cyan-400 bg-cyan-400 shadow-[0_0_0_4px_rgba(34,211,238,0.14)]',
    detail: 'text-slate-300',
  },
  success: {
    connector: 'bg-emerald-400/70',
    current: 'border-emerald-400 bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.14)]',
    detail: 'text-emerald-100',
  },
  danger: {
    connector: 'bg-rose-400/70',
    current: 'border-rose-400 bg-rose-400 shadow-[0_0_0_4px_rgba(251,113,133,0.16)]',
    detail: 'text-rose-100',
  },
} as const;

export function ApplicationStatusBar({
  application,
}: {
  application: Pick<RecruiterStudentApplicationView, 'source' | 'stage'>;
}) {
  const progress = getStudentApplicationProgress(application.stage, application.source);
  const tone = TONE_CLASSES[progress.tone];

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 px-4 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Application progress</div>
          <p className={`mt-1 text-sm ${tone.detail}`}>{progress.helperText}</p>
        </div>
        <span
          className={`w-fit rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] ${APPLICATION_STAGE_BADGE[application.stage]}`}
        >
          {application.stage}
        </span>
      </div>

      <div className="mt-4 overflow-x-auto pb-1">
        <div className="flex min-w-[640px] items-start">
          {progress.steps.map((step, index) => {
            const isComplete = index < progress.currentIndex;
            const isCurrent = index === progress.currentIndex;
            const isLast = index === progress.steps.length - 1;

            return (
              <Fragment key={step.key}>
                <div className="min-w-[92px] flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-3 w-3 rounded-full border transition ${
                        isCurrent
                          ? tone.current
                          : isComplete
                            ? `border-slate-300 ${tone.connector}`
                            : 'border-slate-700 bg-slate-950'
                      }`}
                    />
                    <span
                      className={`text-xs font-medium ${
                        isCurrent ? 'text-white' : isComplete ? 'text-slate-200' : 'text-slate-500'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                </div>
                {!isLast ? (
                  <div className={`mt-[7px] h-px flex-1 ${isComplete ? tone.connector : 'bg-slate-800'}`} />
                ) : null}
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
