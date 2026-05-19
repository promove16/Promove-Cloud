import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { agreementApi, AgreementView } from '../../api/agreement.api';

const formatINR = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);

const statusBadge = (status: AgreementView['status']) => {
  const map: Record<string, { label: string; cls: string }> = {
    generated: {
      label: 'Awaiting Acknowledgement',
      cls: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    },
    acknowledged_by_investor: {
      label: 'Investor Acknowledged',
      cls: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
    },
    acknowledged_by_founder: {
      label: 'Founder Acknowledged',
      cls: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
    },
    acknowledged_by_both: {
      label: 'Acknowledged by Both',
      cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    },
    voided: { label: 'Voided', cls: 'border-red-500/30 bg-red-500/10 text-red-300' },
  };
  const e = map[status] ?? map.generated;
  return <Badge className={e.cls}>{e.label}</Badge>;
};

type Props = {
  agreementId?: string;
  bidId?: string;
  currentUserId?: string;
  onLoaded?: (a: AgreementView) => void;
  className?: string;
};

export const AgreementViewer = ({
  agreementId,
  bidId,
  currentUserId,
  onLoaded,
  className,
}: Props) => {
  const queryClient = useQueryClient();

  const query = useQuery<AgreementView | null>({
    queryKey: agreementId
      ? (['agreement', 'id', agreementId] as const)
      : (['agreement', 'bid', bidId ?? 'noop'] as const),
    enabled: !!(agreementId || bidId),
    queryFn: async () => {
      if (agreementId) {
        const res = await agreementApi.get(agreementId);
        const data = res.data.data;
        onLoaded?.(data);
        return data;
      }
      if (bidId) {
        const res = await agreementApi.getByBid(bidId);
        const data = res.data.data;
        if (data) onLoaded?.(data);
        return data;
      }
      return null;
    },
  });

  const ackMutation = useMutation({
    mutationFn: async () => {
      if (!query.data) throw new Error('No agreement loaded');
      const res = await agreementApi.acknowledge(query.data._id);
      return res.data.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['agreement', 'id', data._id], data);
      if (bidId) queryClient.setQueryData(['agreement', 'bid', bidId], data);
      toast.success('Agreement acknowledged.');
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Could not acknowledge agreement';
      toast.error(message);
    },
  });

  if (query.isLoading) {
    return (
      <Card className={className ? `${className} p-6` : 'p-6'}>
        <div className="flex items-center justify-center"><Spinner /></div>
      </Card>
    );
  }

  const agreement = query.data;
  if (!agreement) {
    return (
      <Card className={className ? `${className} p-6` : 'p-6'}>
        <div className="text-sm text-slate-400">
          No agreement available yet. An agreement is generated once a bid is accepted.
        </div>
      </Card>
    );
  }

  const isInvestor = currentUserId === agreement.investorId;
  const isFounder = currentUserId === agreement.founderId;
  const myAck =
    (isInvestor && agreement.acknowledgedByInvestorAt) ||
    (isFounder && agreement.acknowledgedByFounderAt);

  return (
    <Card className={className ? `${className} p-6` : 'p-6'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Virtual Agreement
          </div>
          <div className="mt-1 text-lg font-bold text-white">{agreement.agreementNumber}</div>
          <div className="mt-1 text-xs text-slate-500">
            Generated {new Date(agreement.generatedAt).toLocaleString('en-IN')}
          </div>
        </div>
        {statusBadge(agreement.status)}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KV label="Amount" value={formatINR(agreement.terms.amount)} />
        <KV label="Equity" value={`${agreement.terms.equity}%`} />
        <KV label="Type" value={agreement.terms.bidType === 'sole' ? 'Sole' : 'Penny'} />
        <KV label="Role" value={agreement.terms.investorRole} />
      </div>

      <pre className="mt-5 max-h-[420px] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-300">
{agreement.bodyText}
      </pre>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-500">
          {agreement.acknowledgedByInvestorAt ? (
            <div>
              Investor acknowledged{' '}
              {new Date(agreement.acknowledgedByInvestorAt).toLocaleString('en-IN')}
            </div>
          ) : null}
          {agreement.acknowledgedByFounderAt ? (
            <div>
              Founder acknowledged{' '}
              {new Date(agreement.acknowledgedByFounderAt).toLocaleString('en-IN')}
            </div>
          ) : null}
        </div>
        {(isInvestor || isFounder) && !myAck ? (
          <Button onClick={() => ackMutation.mutate()} disabled={ackMutation.isPending}>
            {ackMutation.isPending ? 'Acknowledging…' : 'I Acknowledge'}
          </Button>
        ) : null}
      </div>
    </Card>
  );
};

const KV = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
    <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</div>
    <div className="mt-1 font-semibold text-white">{value}</div>
  </div>
);

export default AgreementViewer;
