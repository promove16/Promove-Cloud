import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { investorApi } from '../../api/investor.api';
import { InvestorStartupDetailResponse } from '../../types/investor.types';

type Props = {
  startupId: string | null;
  open: boolean;
  canExpressInterest: boolean;
  isExpressingInterest?: boolean;
  onOpenChange: (open: boolean) => void;
  onExpressInterest: (
    startupId: string,
    payload: {
      investorType: 'penny' | 'sole';
      proposedAmountINR: number;
      proposedEquityPercent: number;
      chosenRole?: 'shareholder' | 'director' | 'observer';
    },
  ) => void;
};

const breakdownLabels: Record<string, string> = {
  problemsClaimed: 'Problems Claimed',
  skillsCompleted: 'Skills Completed',
  progressUploads: 'Progress Uploads',
  patentsSubmitted: 'Patents Submitted',
  patentsApproved: 'Patents Approved',
  mvpsVerified: 'MVPs Verified',
  marketReadyVerified: 'Market Ready',
  startupsLaunched: 'Startups Launched',
  awardsApproved: 'Awards Approved',
};

export function StartupDetailDrawer({
  startupId,
  open,
  canExpressInterest,
  isExpressingInterest,
  onOpenChange,
  onExpressInterest,
}: Props) {
  const [investorType, setInvestorType] = useState<'penny' | 'sole'>('penny');
  const [proposedAmountINR, setProposedAmountINR] = useState('20000');
  const [proposedEquityPercent, setProposedEquityPercent] = useState('2');
  const [chosenRole, setChosenRole] = useState<'shareholder' | 'director' | 'observer'>('observer');
  const [submissionError, setSubmissionError] = useState('');
  const startupQuery = useQuery({
    queryKey: ['investor-startup', startupId],
    queryFn: () => investorApi.getStartup(startupId!),
    enabled: open && Boolean(startupId),
  });

  const detail = startupQuery.data as InvestorStartupDetailResponse | undefined;
  const canChoosePenny = Boolean(detail?.startup.acceptsPennyInvestors);
  const canChooseSole = Boolean(detail?.startup.acceptsSoleInvestor);
  const selectedTypeAvailable = investorType === 'penny' ? canChoosePenny : canChooseSole;
  const canSubmitInterest =
    canExpressInterest &&
    Boolean(detail?.canExpressInterest) &&
    (canChoosePenny || canChooseSole) &&
    selectedTypeAvailable;

  useEffect(() => {
    if (!open) {
      setInvestorType('penny');
      setProposedAmountINR('20000');
      setProposedEquityPercent('2');
      setChosenRole('observer');
      setSubmissionError('');
    }
  }, [open]);

  useEffect(() => {
    setSubmissionError('');
  }, [startupId]);

  useEffect(() => {
    if (!detail) return;

    if (investorType === 'penny' && !canChoosePenny && canChooseSole) {
      setInvestorType('sole');
      setChosenRole('shareholder');
      return;
    }

    if (investorType === 'sole' && !canChooseSole && canChoosePenny) {
      setInvestorType('penny');
      setChosenRole('observer');
    }
  }, [detail, investorType, canChoosePenny, canChooseSole]);

  if (!open) {
    return null;
  }

  const handleExpressInterest = () => {
    if (!startupId || !detail) return;

    if (!selectedTypeAvailable) {
      setSubmissionError(
        investorType === 'penny'
          ? 'This startup is not accepting penny investors right now.'
          : 'This startup already has a sole investor.',
      );
      return;
    }

    const amount = Number(proposedAmountINR);
    if (!Number.isFinite(amount) || amount < 20000) {
      setSubmissionError('Minimum investment amount is INR 20,000.');
      return;
    }

    const equity = Number(proposedEquityPercent);
    if (!Number.isFinite(equity) || equity <= 0 || equity > 100) {
      setSubmissionError('Enter a valid equity percentage between 0.01 and 100.');
      return;
    }

    if (investorType === 'penny' && equity > 5) {
      setSubmissionError('A penny investor cannot request more than 5% equity.');
      return;
    }

    if (investorType === 'sole' && chosenRole === 'director' && equity < 51) {
      setSubmissionError('A sole investor needs at least 51% equity to take the director role.');
      return;
    }

    setSubmissionError('');
    onExpressInterest(startupId, {
      investorType,
      proposedAmountINR: amount,
      proposedEquityPercent: equity,
      chosenRole,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 backdrop-blur-sm">
      <div className="h-full w-full max-w-4xl overflow-y-auto border-l border-slate-800 bg-slate-950 px-6 py-6 text-white">
        <div className="mb-6 flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="text-2xl font-bold text-white">Full Startup Profile</div>
            <div className="mt-2 text-sm text-slate-400">
              Review the complete founder score breakdown before expressing interest.
            </div>
          </div>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>

        {startupQuery.isLoading ? (
          <div className="flex min-h-[50vh] items-center justify-center">
            <Spinner />
          </div>
        ) : detail ? (
          <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-3xl font-bold text-white">{detail.startup.name}</div>
                    <div className="mt-2 text-slate-400">{detail.startup.category}</div>
                    <div className="mt-2 text-sm leading-6 text-slate-400">{detail.startup.tagline}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge>{detail.startup.stage}</Badge>
                    <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                      Score {detail.startup.innovationScoreAtLaunch}/200
                    </Badge>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {detail.startup.founders.map((founder) => (
                    <div
                      key={founder._id}
                      className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4"
                    >
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Founder</div>
                      <div className="mt-2 font-semibold text-white">{founder.displayName}</div>
                      <div className="mt-2 text-sm text-cyan-300">{founder.innovationScore}/200</div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {detail.startup.acceptsPennyInvestors ? (
                    <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">Accepting Penny Investors</Badge>
                  ) : null}
                  {detail.startup.acceptsSoleInvestor ? (
                    <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-300">Accepting Sole Investor</Badge>
                  ) : null}
                  <Badge className="border-slate-700 bg-slate-900 text-slate-300">
                    Shares Available {detail.startup.sharePool.availableShares}/{detail.startup.sharePool.totalShares}
                  </Badge>
                </div>
              </Card>

              <Card className="p-5">
                <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Pitch Deck</div>
                {detail.startup.pitchDeckUrl ? (
                  <iframe
                    title="Pitch deck PDF"
                    src={detail.startup.pitchDeckUrl}
                    className="mt-4 h-[340px] w-full rounded-2xl border border-slate-800 bg-slate-900"
                  />
                ) : (
                  <div className="mt-4 flex h-[340px] items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-900 text-slate-400">
                    No pitch deck uploaded yet
                  </div>
                )}
              </Card>
            </div>

            <Card className="p-5">
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                Founder Score Breakdown
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {detail.teamMembers.map((founder) => (
                  <div key={founder._id} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-white">{founder.displayName}</div>
                        <div className="text-sm text-slate-400">Live score {founder.innovationScore}/200</div>
                      </div>
                      <Badge>{founder.domain ?? 'Founder'}</Badge>
                    </div>
                    <div className="mt-4 space-y-2">
                      {Object.entries(founder.scoreBreakdown).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between text-sm">
                          <span className="text-slate-400">{breakdownLabels[key] ?? key}</span>
                          <span className="font-semibold text-white">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                Score Timeline
              </div>
              <div className="mt-4 space-y-4">
                {detail.scoreEvents.map((event) => (
                  <div
                    key={event._id}
                    className="flex items-start justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4"
                  >
                    <div>
                      <div className="font-semibold text-white">
                        {event.trigger.replace(/_/g, ' ').toLowerCase()}
                      </div>
                      <div className="mt-1 text-sm text-slate-400">
                        {new Date(event.createdAt).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                      +{event.delta} pts
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="space-y-4 border-t border-slate-800 p-5">
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                Step 0: Choose Your Investor Type
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setInvestorType('penny');
                    setChosenRole('observer');
                  }}
                  disabled={!canChoosePenny}
                  className={`rounded-2xl border p-4 text-left ${
                    investorType === 'penny' ? 'border-cyan-400 bg-cyan-500/10' : 'border-slate-800 bg-slate-900/80'
                  } ${!canChoosePenny ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  <div className="font-semibold text-white">Penny Investor</div>
                  <div className="mt-2 text-sm text-slate-400">Small stake, shareholder rights, INR 20k-INR 5L range</div>
                  {!canChoosePenny ? (
                    <div className="mt-2 text-xs text-amber-300">All penny investor slots are filled.</div>
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInvestorType('sole');
                    setChosenRole('shareholder');
                  }}
                  disabled={!canChooseSole}
                  className={`rounded-2xl border p-4 text-left ${
                    investorType === 'sole' ? 'border-amber-400 bg-amber-500/10' : 'border-slate-800 bg-slate-900/80'
                  } ${!canChooseSole ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  <div className="font-semibold text-white">Sole Investor</div>
                  <div className="mt-2 text-sm text-slate-400">Lead investor, director option, negotiated authority</div>
                  {!canChooseSole ? (
                    <div className="mt-2 text-xs text-amber-300">A sole investor is already assigned to this startup.</div>
                  ) : null}
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Amount (INR)</div>
                  <Input
                    type="number"
                    min={20000}
                    value={proposedAmountINR}
                    onChange={(event) => setProposedAmountINR(event.target.value)}
                  />
                </div>
                <div>
                  <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Equity %</div>
                  <Input
                    type="number"
                    min={0.01}
                    max={100}
                    step={0.01}
                    value={proposedEquityPercent}
                    onChange={(event) => setProposedEquityPercent(event.target.value)}
                  />
                </div>
                <div>
                  <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Role</div>
                  <select
                    value={chosenRole}
                    onChange={(event) => setChosenRole(event.target.value as 'shareholder' | 'director' | 'observer')}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                  >
                    {investorType === 'penny' ? (
                      <>
                        <option value="observer">Observer</option>
                        <option value="shareholder">Shareholder</option>
                      </>
                    ) : (
                      <>
                        <option value="shareholder">Shareholder</option>
                        <option value="director">Director</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {submissionError ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {submissionError}
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-slate-400">
                  {detail.canExpressInterest
                    ? 'Express Interest is enabled after the full profile review.'
                    : 'This startup is not accepting any new investor interest right now.'}
                </div>
                <Button
                  onClick={handleExpressInterest}
                  disabled={!canSubmitInterest || isExpressingInterest}
                >
                  {isExpressingInterest ? 'Sending...' : 'Express Interest'}
                </Button>
              </div>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}
