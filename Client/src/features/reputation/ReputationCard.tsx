import { useQuery } from '@tanstack/react-query';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { reputationApi, ReputationData, BadgeId } from '../../api/reputation.api';

const formatINR = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
    notation: value >= 100_000 ? 'compact' : 'standard',
  }).format(value);

const BADGE_STYLES: Record<BadgeId, string> = {
  early_supporter: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  top_investor: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  trend_spotter: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
  most_funded: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  fast_growing: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  investor_favorite: 'border-pink-500/30 bg-pink-500/10 text-pink-300',
};

type Props = {
  userId?: string;
  variant?: 'full' | 'compact';
  className?: string;
};

export const ReputationCard = ({ userId, variant = 'full', className }: Props) => {
  const query = useQuery<ReputationData>({
    queryKey: ['reputation', userId ?? 'me'],
    queryFn: async () => {
      const res = userId ? await reputationApi.forUser(userId) : await reputationApi.me();
      return res.data.data;
    },
  });

  if (query.isLoading) {
    return (
      <Card className={className ? `${className} p-5` : 'p-5'}>
        <div className="flex items-center justify-center"><Spinner /></div>
      </Card>
    );
  }

  if (!query.data) {
    return (
      <Card className={className ? `${className} p-5` : 'p-5'}>
        <div className="text-sm text-slate-400">No reputation data.</div>
      </Card>
    );
  }

  const data = query.data;
  const isInvestor = data.kind === 'investor';

  return (
    <Card className={className ? `${className} p-5` : 'p-5'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            {isInvestor ? 'Investor Reputation' : 'Founder Reputation'}
          </div>
          <div className="mt-1 text-sm text-slate-400">
            {data.badges.length === 0
              ? 'Earn badges by participating actively.'
              : `${data.badges.length} badge${data.badges.length === 1 ? '' : 's'} earned`}
          </div>
        </div>
        {data.badges.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {data.badges.map((b) => (
              <Badge
                key={b.id}
                className={BADGE_STYLES[b.id] ?? BADGE_STYLES.top_investor}
                title={b.description}
              >
                {b.label}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {variant === 'full' && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {isInvestor ? (
            <>
              <Stat label="Interests" value={data.totalInterests} />
              <Stat label="Active Bids" value={data.totalActiveBids} />
              <Stat label="Accepted" value={data.totalAcceptedBids} />
              <Stat label="Committed" value={formatINR(data.totalCommittedAmount)} />
              <Stat
                label="Accept Rate"
                value={`${(data.acceptanceRate * 100).toFixed(0)}%`}
              />
              <Stat
                label="Avg Response"
                value={
                  data.averageResponseHours === null
                    ? '—'
                    : `${data.averageResponseHours.toFixed(1)}h`
                }
              />
            </>
          ) : (
            <>
              <Stat label="Startups" value={data.totalStartups} />
              <Stat label="Accepted Bids" value={data.totalAcceptedBids} />
              <Stat label="Funded" value={formatINR(data.totalFundedAmount)} />
              <Stat label="Interested" value={data.totalInterestedInvestors} />
            </>
          )}
        </div>
      )}

      {data.badges.length > 0 && variant === 'full' && (
        <div className="mt-5 space-y-2">
          {data.badges.map((b) => (
            <div
              key={b.id}
              className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3"
            >
              <Badge className={BADGE_STYLES[b.id] ?? BADGE_STYLES.top_investor}>
                {b.label}
              </Badge>
              <div className="text-sm text-slate-300">{b.description}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
    <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</div>
    <div className="mt-1 font-semibold text-white">{value}</div>
  </div>
);

export default ReputationCard;
