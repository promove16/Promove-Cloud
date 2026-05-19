import { Badge } from '../../components/ui/Badge';
import { useStartupFunding } from '../../hooks/useStartupFunding';
import { useStartupInterest } from '../../hooks/useStartupInterest';

const formatINR = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
    notation: value >= 100_000 ? 'compact' : 'standard',
  }).format(value);

type Props = {
  startupId: string;
  className?: string;
};

/**
 * Slim funding + interest strip designed to live inside marketplace cards.
 * Renders nothing when there is no activity yet so quiet startups stay quiet.
 */
export const MarketplaceStartupStats = ({ startupId, className }: Props) => {
  const { snapshot, isLoading: fundingLoading } = useStartupFunding(startupId);
  const { summary, isLoading: interestLoading } = useStartupInterest(startupId);

  if (fundingLoading || interestLoading) {
    return <div className={`h-10 animate-pulse rounded-xl bg-slate-800/40 ${className ?? ''}`} />;
  }

  const interestedCount = summary.interestedCount;
  const investorCount = snapshot?.investorCount ?? 0;
  const currentFunding = snapshot?.currentFunding ?? 0;
  const fundingGoal = snapshot?.fundingGoal;
  const percentFunded =
    fundingGoal && fundingGoal > 0
      ? Math.min(100, (currentFunding / fundingGoal) * 100)
      : null;

  const hasAnyActivity = interestedCount > 0 || investorCount > 0 || currentFunding > 0;
  if (!hasAnyActivity) return null;

  return (
    <div className={`mt-3 space-y-2 ${className ?? ''}`}>
      {percentFunded !== null ? (
        <div>
          <div className="flex items-baseline justify-between text-xs text-slate-400">
            <span className="font-medium text-slate-300">{formatINR(currentFunding)} raised</span>
            <span>
              {percentFunded.toFixed(0)}% of {formatINR(fundingGoal!)}
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 transition-all duration-500"
              style={{ width: `${percentFunded}%` }}
            />
          </div>
        </div>
      ) : currentFunding > 0 ? (
        <div className="text-xs text-slate-400">
          <span className="font-medium text-slate-300">{formatINR(currentFunding)}</span> raised
          so far
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {interestedCount > 0 ? (
          <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
            {interestedCount} interested
          </Badge>
        ) : null}
        {investorCount > 0 ? (
          <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
            {investorCount} {investorCount === 1 ? 'investor' : 'investors'}
          </Badge>
        ) : null}
        {snapshot?.fundingStatus === 'fully_funded' ? (
          <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
            Fully Funded
          </Badge>
        ) : null}
        {summary.isInterested ? (
          <Badge className="border-purple-500/30 bg-purple-500/10 text-purple-300">
            You're interested
          </Badge>
        ) : null}
      </div>
    </div>
  );
};

export default MarketplaceStartupStats;
