import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { investorApi } from '../../api/investor.api';
import { MAX_INNOVATION_SCORE } from '../../constants/score';
import { InvestorStartupDetailResponse } from '../../types/investor.types';
import { useStartupInterest } from '../../hooks/useStartupInterest';
import { ExpressInterestCard } from '../interest/ExpressInterestCard';
import { FundingProgressBar } from '../funding/FundingProgressBar';
import { LiveActivityFeed } from '../activity/LiveActivityFeed';

type Props = {
  startupId: string | null;
  open: boolean;
  canExpressInterest: boolean;
  alreadyBidded?: boolean;
  isExpressingInterest?: boolean;
  onOpenChange: (open: boolean) => void;
  onTrackInterest?: () => void;
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
  problemsCompleted: 'Problems Completed',
  skillsCompleted: 'Skills Completed',
  progressUploads: 'Progress Uploads',
  patentsSubmitted: 'Patents Submitted',
  patentsApproved: 'Patents Approved',
  mvpsVerified: 'MVPs Verified',
  marketReadyVerified: 'Market Ready',
  startupsLaunched: 'Startups Launched',
};

const MIN_INVESTMENT_AMOUNT_INR = 20_000;
const MAX_PENNY_INVESTMENT_AMOUNT_INR = 500_000;
const MAX_AMOUNT_INPUT_DIGITS = 9;

const formatINR = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);

const investorTypeGuidance = {
  penny: {
    title: 'Penny Investor',
    subtitle: 'Smaller ticket, capped equity, portfolio-style participation.',
    range: `${formatINR(MIN_INVESTMENT_AMOUNT_INR)} to ${formatINR(MAX_PENNY_INVESTMENT_AMOUNT_INR)}`,
    role: 'Observer or shareholder',
    note: 'Best when you want exposure without taking operating control.',
  },
  sole: {
    title: 'Sole Investor',
    subtitle: 'Lead ticket with negotiated authority and founder review.',
    range: `${formatINR(MIN_INVESTMENT_AMOUNT_INR)}+`,
    role: 'Shareholder or director',
    note: 'Best when you want to lead the round and negotiate deeper rights.',
  },
} satisfies Record<
  'penny' | 'sole',
  {
    title: string;
    subtitle: string;
    range: string;
    role: string;
    note: string;
  }
>;

const interestNextSteps = [
  'Founder receives your offer',
  'They can accept, decline, or counter',
  'Accepted interest moves into deal review',
];

type ExpressInterestDraft = {
  investorType: 'penny' | 'sole';
  proposedAmountINR: string;
  proposedEquityPercent: string;
  chosenRole: 'shareholder' | 'director' | 'observer';
};

const createDefaultDraft = (): ExpressInterestDraft => ({
  investorType: 'penny',
  proposedAmountINR: '20000',
  proposedEquityPercent: '2',
  chosenRole: 'observer',
});

const isSameDraft = (left: ExpressInterestDraft, right: ExpressInterestDraft) =>
  left.investorType === right.investorType &&
  left.proposedAmountINR === right.proposedAmountINR &&
  left.proposedEquityPercent === right.proposedEquityPercent &&
  left.chosenRole === right.chosenRole;

const getDraftStorageKey = (startupId: string) => `investor-interest-draft:${startupId}`;

const readDraft = (startupId: string): ExpressInterestDraft | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawDraft = window.localStorage.getItem(getDraftStorageKey(startupId));
  if (!rawDraft) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawDraft) as Partial<ExpressInterestDraft>;
    if (
      (parsed.investorType === 'penny' || parsed.investorType === 'sole') &&
      typeof parsed.proposedAmountINR === 'string' &&
      typeof parsed.proposedEquityPercent === 'string' &&
      (parsed.chosenRole === 'shareholder' || parsed.chosenRole === 'director' || parsed.chosenRole === 'observer')
    ) {
      return parsed as ExpressInterestDraft;
    }
  } catch {
    return null;
  }

  return null;
};

const persistDraft = (startupId: string, draft: ExpressInterestDraft) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(getDraftStorageKey(startupId), JSON.stringify(draft));
};

const sanitizeAmountInput = (value: string) => value.replace(/\D/g, '').slice(0, MAX_AMOUNT_INPUT_DIGITS);

const sanitizeEquityInput = (value: string) => {
  const cleaned = value.replace(/[^0-9.]/g, '');
  if (!cleaned) {
    return '';
  }

  const normalized = cleaned.startsWith('.') ? `0${cleaned}` : cleaned;
  const [wholePart = '', ...decimalParts] = normalized.split('.');
  const whole = wholePart.slice(0, 3);
  const decimal = decimalParts.join('').slice(0, 2);

  return decimal ? `${whole}.${decimal}` : whole;
};

const getInterestValidationError = ({
  investorType,
  proposedAmountINR,
  proposedEquityPercent,
  chosenRole,
  selectedTypeAvailable,
}: ExpressInterestDraft & { selectedTypeAvailable: boolean }) => {
  if (!selectedTypeAvailable) {
    return investorType === 'penny'
      ? 'This startup is not accepting penny investors right now.'
      : 'This startup already has a sole investor.';
  }

  if (!proposedAmountINR.trim()) {
    return 'Enter an investment amount.';
  }

  const amount = Number(proposedAmountINR);
  if (!Number.isSafeInteger(amount)) {
    return 'Enter an amount the platform can process safely.';
  }
  if (amount < MIN_INVESTMENT_AMOUNT_INR) {
    return 'Minimum investment amount is INR 20,000.';
  }
  if (investorType === 'penny' && amount > MAX_PENNY_INVESTMENT_AMOUNT_INR) {
    return 'A penny investment must stay within the INR 20,000 to INR 5,00,000 range.';
  }

  if (!proposedEquityPercent.trim()) {
    return 'Enter an equity percentage.';
  }

  const equity = Number(proposedEquityPercent);
  if (!Number.isFinite(equity) || equity <= 0 || equity > 100) {
    return 'Enter a valid equity percentage between 0.01 and 100.';
  }

  if (investorType === 'penny' && equity > 5) {
    return 'A penny investor cannot request more than 5% equity.';
  }

  if (investorType === 'sole' && chosenRole === 'director' && equity < 51) {
    return 'A sole investor needs at least 51% equity to take the director role.';
  }

  return '';
};

export function StartupDetailDrawer({
  startupId,
  open,
  canExpressInterest,
  alreadyBidded = false,
  isExpressingInterest,
  onOpenChange,
  onTrackInterest,
  onExpressInterest,
}: Props) {
  const [investorType, setInvestorType] = useState<'penny' | 'sole'>(createDefaultDraft().investorType);
  const [proposedAmountINR, setProposedAmountINR] = useState(createDefaultDraft().proposedAmountINR);
  const [proposedEquityPercent, setProposedEquityPercent] = useState(createDefaultDraft().proposedEquityPercent);
  const [chosenRole, setChosenRole] = useState<'shareholder' | 'director' | 'observer'>(createDefaultDraft().chosenRole);
  const [submissionError, setSubmissionError] = useState('');
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [draftRestoredToast, setDraftRestoredToast] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [loadedDraft, setLoadedDraft] = useState<ExpressInterestDraft>(createDefaultDraft);
  const backdropRef = useRef<HTMLDivElement>(null);
  const startupQuery = useQuery({
    queryKey: ['investor-startup', startupId],
    queryFn: () => investorApi.getStartup(startupId!),
    enabled: open && Boolean(startupId),
  });

  const detail = startupQuery.data as InvestorStartupDetailResponse | undefined;
  const { summary: interestSummary } = useStartupInterest(startupId);
  const hasExpressedInterest = interestSummary.isInterested;
  const canChoosePenny = Boolean(detail?.startup.acceptsPennyInvestors);
  const canChooseSole = Boolean(detail?.startup.acceptsSoleInvestor);
  const selectedTypeAvailable = investorType === 'penny' ? canChoosePenny : canChooseSole;
  const validationError = getInterestValidationError({
    investorType,
    proposedAmountINR,
    proposedEquityPercent,
    chosenRole,
    selectedTypeAvailable,
  });
  const currentDraft: ExpressInterestDraft = {
    investorType,
    proposedAmountINR,
    proposedEquityPercent,
    chosenRole,
  };
  const draftIsDirty = !isSameDraft(currentDraft, loadedDraft);
  const canSubmitInterest =
    canExpressInterest &&
    !alreadyBidded &&
    Boolean(detail?.canExpressInterest) &&
    (canChoosePenny || canChooseSole) &&
    selectedTypeAvailable &&
    !validationError;

  useEffect(() => {
    if (!startupId) {
      const defaultDraft = createDefaultDraft();
      setInvestorType(defaultDraft.investorType);
      setProposedAmountINR(defaultDraft.proposedAmountINR);
      setProposedEquityPercent(defaultDraft.proposedEquityPercent);
      setChosenRole(defaultDraft.chosenRole);
      setLoadedDraft(defaultDraft);
      setTouchedFields(new Set());
      return;
    }

    const restoredDraft = readDraft(startupId) ?? createDefaultDraft();
    const normalizedDraft: ExpressInterestDraft = {
      investorType: restoredDraft.investorType,
      proposedAmountINR: sanitizeAmountInput(restoredDraft.proposedAmountINR),
      proposedEquityPercent: sanitizeEquityInput(restoredDraft.proposedEquityPercent),
      chosenRole: restoredDraft.chosenRole,
    };
    setInvestorType(normalizedDraft.investorType);
    setProposedAmountINR(normalizedDraft.proposedAmountINR);
    setProposedEquityPercent(normalizedDraft.proposedEquityPercent);
    setChosenRole(normalizedDraft.chosenRole);
    setLoadedDraft(normalizedDraft);
    setTouchedFields(new Set());
  }, [startupId]);

  useEffect(() => {
    setSubmissionError('');
  }, [startupId, investorType, proposedAmountINR, proposedEquityPercent, chosenRole]);

  useEffect(() => {
    if (!startupId) {
      return;
    }

    persistDraft(startupId, {
      investorType,
      proposedAmountINR,
      proposedEquityPercent,
      chosenRole,
    });
  }, [startupId, investorType, proposedAmountINR, proposedEquityPercent, chosenRole]);

  useEffect(() => {
    if (!open || !draftIsDirty) {
      return;
    }

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [draftIsDirty, open]);

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

  useEffect(() => {
    if (!startupId) return;
    const restored = readDraft(startupId);
    if (restored && open) {
      const defaults = createDefaultDraft();
      const isDifferent =
        restored.investorType !== defaults.investorType ||
        restored.proposedAmountINR !== defaults.proposedAmountINR ||
        restored.proposedEquityPercent !== defaults.proposedEquityPercent ||
        restored.chosenRole !== defaults.chosenRole;
      if (isDifferent) {
        setDraftRestoredToast(true);
        const timer = setTimeout(() => setDraftRestoredToast(false), 4000);
        return () => clearTimeout(timer);
      }
    }
  }, [startupId, open]);

  const getAmountError = useCallback((): string => {
    if (!proposedAmountINR.trim()) return '';
    const amount = Number(proposedAmountINR);
    if (!Number.isSafeInteger(amount) || amount < 0) return 'Enter a valid positive number.';
    if (amount < MIN_INVESTMENT_AMOUNT_INR) return `Minimum is INR ${MIN_INVESTMENT_AMOUNT_INR.toLocaleString()}.`;
    if (investorType === 'penny' && amount > MAX_PENNY_INVESTMENT_AMOUNT_INR) return `Maximum for penny investors is INR ${MAX_PENNY_INVESTMENT_AMOUNT_INR.toLocaleString()}.`;
    if (amount > 999_999_999) return 'Amount exceeds the maximum allowed value.';
    return '';
  }, [proposedAmountINR, investorType]);

  const getEquityError = useCallback((): string => {
    if (!proposedEquityPercent.trim()) return '';
    const equity = Number(proposedEquityPercent);
    if (!Number.isFinite(equity) || equity < 0) return 'Enter a valid positive number.';
    if (equity <= 0) return 'Equity must be greater than 0%.';
    if (equity > 100) return 'Equity cannot exceed 100%.';
    if (investorType === 'penny' && equity > 5) return 'Penny investors cannot request more than 5%.';
    if (investorType === 'sole' && chosenRole === 'director' && equity < 51) return 'Director role requires at least 51%.';
    return '';
  }, [proposedEquityPercent, investorType, chosenRole]);

  const amountError = touchedFields.has('amount') ? getAmountError() : '';
  const equityError = touchedFields.has('equity') ? getEquityError() : '';

  const handleClose = () => {
    if (draftIsDirty) {
      setShowCloseConfirm(true);
    } else {
      onOpenChange(false);
    }
  };

  const confirmClose = () => {
    setShowCloseConfirm(false);
    onOpenChange(false);
  };

  const handleSaveDraft = () => {
    if (startupId) {
      persistDraft(startupId, { investorType, proposedAmountINR, proposedEquityPercent, chosenRole });
      setShowCloseConfirm(false);
      onOpenChange(false);
    }
  };

  if (!open) {
    return null;
  }

  const handleExpressInterest = () => {
    if (!startupId || !detail) return;

    if (validationError) {
      setSubmissionError(validationError);
      return;
    }

    setSubmissionError('');
    onExpressInterest(startupId, {
      investorType,
      proposedAmountINR: Number(proposedAmountINR),
      proposedEquityPercent: Number(proposedEquityPercent),
      chosenRole,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950 backdrop-blur-sm">
      {/* Backdrop click handler */}
      <div
        ref={backdropRef}
        className="hidden flex-1 lg:block"
        onClick={handleClose}
        role="presentation"
      />
      <div className="h-full w-full max-w-4xl overflow-y-auto border-l border-slate-800 bg-slate-950 px-6 py-6 text-white">
        {/* Close confirmation dialog */}
        {showCloseConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950 backdrop-blur-sm">
            <Card className="mx-4 max-w-md space-y-4 p-6">
              <h3 className="text-lg font-bold text-white">Unsaved Changes</h3>
              <p className="text-sm text-slate-400">
                You have unsaved changes. Your draft will be saved locally so you can continue later.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setShowCloseConfirm(false)}>
                  Keep Editing
                </Button>
                <Button variant="secondary" onClick={handleSaveDraft}>
                  Save Draft & Close
                </Button>
                <Button variant="danger" onClick={confirmClose}>
                  Discard & Close
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Draft restored toast */}
        {draftRestoredToast && (
          <div className="mb-4 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">
            Draft restored from your previous session.
          </div>
        )}

        <div className="mb-6 flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="text-2xl font-bold text-white">Full Startup Profile</div>
            <div className="mt-2 text-sm text-slate-400">
              Review the complete founder score breakdown before expressing interest.
            </div>
          </div>
          <div className="flex items-center gap-3">
            {interestSummary.interestedCount > 0 ? (
              <Badge className="border-cyan-500/40 bg-cyan-500/10 text-cyan-300">
                {interestSummary.interestedCount} interested
              </Badge>
            ) : null}
            <Button variant="ghost" onClick={handleClose}>
              Close
            </Button>
          </div>
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
                      Score {detail.startup.innovationScoreAtLaunch}/{MAX_INNOVATION_SCORE}
                    </Badge>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {detail.startup.founders.map((founder) => (
                    <div
                      key={founder._id}
                      className="rounded-2xl border border-slate-800 bg-slate-900 p-4"
                    >
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Founder</div>
                      <div className="mt-2 font-semibold text-white">{founder.displayName}</div>
                      <div className="mt-2 text-sm text-cyan-300">{founder.innovationScore}/{MAX_INNOVATION_SCORE}</div>
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
                  <div key={founder._id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-white">{founder.displayName}</div>
                        <div className="text-sm text-slate-400">Live score {founder.innovationScore}/{MAX_INNOVATION_SCORE}</div>
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
                    className="flex items-start justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-4"
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

            {startupId ? <FundingProgressBar startupId={startupId} /> : null}

            {!hasExpressedInterest && startupId ? (
              <ExpressInterestCard
                startupId={startupId}
                startupName={detail.startup.name}
                variant="banner"
              />
            ) : null}

            {hasExpressedInterest && startupId ? (
              <LiveActivityFeed startupId={startupId} maxItems={20} />
            ) : null}

            {alreadyBidded ? (
              <Card className="border-cyan-500/30 bg-cyan-500/5 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <Badge className="w-fit border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                    Already Bidded
                  </Badge>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={onTrackInterest}>
                      Track
                    </Button>
                    <Button variant="ghost" onClick={handleClose}>
                      Close
                    </Button>
                  </div>
                </div>
              </Card>
            ) : hasExpressedInterest ? (
            <Card className="space-y-4 border-t border-slate-800 p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Investment Offer
                  </div>
                  <div className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                    Choose the investor type, enter the money and equity you are proposing, then send it to the founder for review.
                  </div>
                </div>
                <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100 lg:max-w-xs">
                  This is not a closed deal yet. It starts the founder negotiation and admin review path.
                </div>
              </div>

              <div className="grid gap-2 text-xs text-slate-400 sm:grid-cols-3">
                {interestNextSteps.map((step, index) => (
                  <div key={step} className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold text-cyan-300">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setInvestorType('penny');
                    setChosenRole('observer');
                  }}
                  aria-pressed={investorType === 'penny'}
                  disabled={!canChoosePenny}
                  className={`rounded-2xl border p-4 text-left ${
                    investorType === 'penny' ? 'border-cyan-400 bg-cyan-500/10' : 'border-slate-800 bg-slate-900'
                  } ${!canChoosePenny ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  <div className="font-semibold text-white">{investorTypeGuidance.penny.title}</div>
                  <div className="mt-2 text-sm text-slate-400">{investorTypeGuidance.penny.subtitle}</div>
                  <div className="mt-4 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                    <span>Ticket: {investorTypeGuidance.penny.range}</span>
                    <span>Role: {investorTypeGuidance.penny.role}</span>
                  </div>
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
                  aria-pressed={investorType === 'sole'}
                  disabled={!canChooseSole}
                  className={`rounded-2xl border p-4 text-left ${
                    investorType === 'sole' ? 'border-amber-400 bg-amber-500/10' : 'border-slate-800 bg-slate-900'
                  } ${!canChooseSole ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  <div className="font-semibold text-white">{investorTypeGuidance.sole.title}</div>
                  <div className="mt-2 text-sm text-slate-400">{investorTypeGuidance.sole.subtitle}</div>
                  <div className="mt-4 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                    <span>Ticket: {investorTypeGuidance.sole.range}</span>
                    <span>Role: {investorTypeGuidance.sole.role}</span>
                  </div>
                  {!canChooseSole ? (
                    <div className="mt-2 text-xs text-amber-300">A sole investor is already assigned to this startup.</div>
                  ) : null}
                </button>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
                <span className="font-semibold text-white">{investorTypeGuidance[investorType].title}: </span>
                {investorTypeGuidance[investorType].note}
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-500">
                    <span>Amount (INR)</span>
                    {touchedFields.has('amount') && !amountError && proposedAmountINR.trim() && (
                      <span className="text-emerald-400" aria-label="Valid">&#10003;</span>
                    )}
                  </div>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={proposedAmountINR}
                    className={amountError ? 'border-red-500 focus:ring-red-500' : ''}
                    onKeyDown={(event) => {
                      if (event.key === '-' || event.key === 'e' || event.key === 'E' || event.key === '+') {
                        event.preventDefault();
                      }
                    }}
                    onChange={(event) => {
                      setTouchedFields((prev) => new Set(prev).add('amount'));
                      setProposedAmountINR(sanitizeAmountInput(event.target.value));
                    }}
                    onBlur={() => setTouchedFields((prev) => new Set(prev).add('amount'))}
                  />
                  {amountError && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-red-400">
                      <span>!</span> {amountError}
                    </div>
                  )}
                  {!amountError ? (
                    <div className="mt-1 text-xs text-slate-500">
                      {investorType === 'penny'
                        ? `Allowed range: ${investorTypeGuidance.penny.range}.`
                        : 'Enter the lead investment amount you want the founder to review.'}
                    </div>
                  ) : null}
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-500">
                    <span>Equity %</span>
                    {touchedFields.has('equity') && !equityError && proposedEquityPercent.trim() && (
                      <span className="text-emerald-400" aria-label="Valid">&#10003;</span>
                    )}
                  </div>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={proposedEquityPercent}
                    className={equityError ? 'border-red-500 focus:ring-red-500' : ''}
                    onKeyDown={(event) => {
                      if (event.key === '-' || event.key === 'e' || event.key === 'E' || event.key === '+') {
                        event.preventDefault();
                      }
                    }}
                    onChange={(event) => {
                      setTouchedFields((prev) => new Set(prev).add('equity'));
                      setProposedEquityPercent(sanitizeEquityInput(event.target.value));
                    }}
                    onBlur={() => setTouchedFields((prev) => new Set(prev).add('equity'))}
                  />
                  {equityError && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-red-400">
                      <span>!</span> {equityError}
                    </div>
                  )}
                  {!equityError ? (
                    <div className="mt-1 text-xs text-slate-500">
                      {investorType === 'penny'
                        ? 'Penny investor equity is capped at 5%.'
                        : chosenRole === 'director'
                          ? 'Director role requires at least 51% equity.'
                          : 'Set the equity you expect for this offer.'}
                    </div>
                  ) : null}
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
                  <div className="mt-1 text-xs text-slate-500">
                    Founder and admin review will confirm final authority after acceptance.
                  </div>
                </div>
              </div>

              {submissionError || validationError ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {submissionError || validationError}
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1 text-sm text-slate-400">
                  <div>
                    {detail.canExpressInterest
                      ? 'Ready to send after you review the profile, pitch deck, and offer terms.'
                      : 'This startup is not accepting any new investor interest right now.'}
                  </div>
                  <div>
                    Sending locks in this offer as your submitted interest. You can follow founder responses from the investor dashboard.
                  </div>
                  {draftIsDirty ? <div className="text-cyan-300">Draft saved locally for this startup.</div> : null}
                </div>
                <div className="flex gap-2">
                  {draftIsDirty && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        if (startupId) {
                          persistDraft(startupId, { investorType, proposedAmountINR, proposedEquityPercent, chosenRole });
                        }
                      }}
                    >
                      Save Draft
                    </Button>
                  )}
                  <Button
                    onClick={handleExpressInterest}
                    disabled={!canSubmitInterest || isExpressingInterest}
                  >
                    {isExpressingInterest ? 'Sending...' : 'Submit Investment Offer'}
                  </Button>
                </div>
              </div>
            </Card>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
