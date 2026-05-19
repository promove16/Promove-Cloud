import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useStartupFunding } from '../../hooks/useStartupFunding';

const formatINR = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
    notation: value >= 100_000 ? 'compact' : 'standard',
  }).format(value);

const statusLabel: Record<string, string> = {
  open: 'Open for Investment',
  partial: 'Partially Funded',
  fully_funded: 'Fully Funded',
  closed: 'Closed',
};

const statusClass: Record<string, string> = {
  open: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  partial: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  fully_funded: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  closed: 'border-slate-700 bg-slate-900 text-slate-400',
};

type Props = {
  startupId: string;
  compact?: boolean;
  className?: string;
};

export const FundingProgressBar = ({ startupId, compact = false, className }: Props) => {
  const { snapshot, isLoading } = useStartupFunding(startupId);

  if (isLoading || !snapshot) {
    return (
      <Card className={className ? `${className} p-4` : 'p-4'}>
        <div className="h-20 animate-pulse rounded-lg bg-slate-800/40" />
      </Card>
    );
  }

  const {
    fundingGoal,
    currentFunding,
    percentFunded,
    remaining,
    investorCount,
    interestedInvestorCount,
    availableEquity,
    fundingStatus,
  } = snapshot;

  const showProgress = typeof percentFunded === 'number' && fundingGoal && fundingGoal > 0;
  const pct = showProgress ? Math.min(100, Math.max(0, percentFunded!)) : 0;

  return (
    <Card className={className ? `${className} p-5` : 'p-5'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Virtual Funding Progress
        </div>
        <Badge className={statusClass[fundingStatus] ?? statusClass.open}>
          {statusLabel[fundingStatus] ?? 'Open'}
        </Badge>
      </div>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <div className="text-2xl font-bold text-white">{formatINR(currentFunding)}</div>
        {fundingGoal ? (
          <div className="text-sm text-slate-400">raised of {formatINR(fundingGoal)} goal</div>
        ) : (
          <div className="text-sm text-slate-400">raised so far</div>
        )}
      </div>

      {showProgress && (
        <div className="mt-3">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-cyan-500 to-purple-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-slate-400">
            <span>{pct.toFixed(1)}% funded</span>
            {typeof remaining === 'number' && remaining > 0 ? (
              <span>{formatINR(remaining)} to goal</span>
            ) : null}
          </div>
        </div>
      )}

      {!compact && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Investors" value={investorCount} />
          <Stat label="Interested" value={interestedInvestorCount} />
          <Stat label="Equity Available" value={`${availableEquity.toFixed(1)}%`} />
          <Stat
            label="Status"
            value={statusLabel[fundingStatus] ?? 'Open'}
            valueClassName="text-sm"
          />
        </div>
      )}
    </Card>
  );
};

const Stat = ({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string | number;
  valueClassName?: string;
}) => (
  <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
    <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</div>
    <div className={`mt-1 font-semibold text-white ${valueClassName ?? 'text-base'}`}>{value}</div>
  </div>
);

export default FundingProgressBar;
