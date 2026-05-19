import { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useStartupInterest } from '../../hooks/useStartupInterest';

type Props = {
  startupId: string;
  startupName?: string;
  variant?: 'inline' | 'banner';
  onExpressed?: () => void;
};

export const ExpressInterestCard = ({
  startupId,
  startupName,
  variant = 'inline',
  onExpressed,
}: Props) => {
  const { summary, isLoading, expressInterest, isExpressing } = useStartupInterest(startupId);
  const [showMessage, setShowMessage] = useState(false);
  const [message, setMessage] = useState('');

  if (isLoading) {
    return (
      <Card className="p-5">
        <div className="h-24 animate-pulse rounded-xl bg-slate-800/40" />
      </Card>
    );
  }

  if (summary.isInterested) {
    return null;
  }

  const handleExpress = () => {
    expressInterest(message.trim() || undefined);
    onExpressed?.();
  };

  return (
    <Card
      className={
        variant === 'banner'
          ? 'border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 p-6'
          : 'border-cyan-500/30 bg-cyan-500/5 p-5'
      }
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-cyan-500/40 bg-cyan-500/10 text-cyan-300">
              Locked preview
            </Badge>
            <Badge className="border-slate-700 bg-slate-900 text-slate-300">
              {summary.interestedCount} interested
            </Badge>
          </div>
          <div className="text-lg font-semibold text-white">
            Express interest in {startupName ?? 'this startup'} to unlock bidding
          </div>
          <div className="max-w-2xl text-sm leading-6 text-slate-400">
            You'll get access to financials, team details, growth metrics, the pitch deck and
            the bidding panel. The founder will be notified. You can withdraw any time.
          </div>
        </div>

        <div className="flex flex-col gap-2 lg:items-end">
          <Button
            onClick={handleExpress}
            disabled={isExpressing}
            className="min-w-[180px]"
          >
            {isExpressing ? 'Expressing…' : 'Express Interest'}
          </Button>
          <button
            type="button"
            onClick={() => setShowMessage((v) => !v)}
            className="text-xs text-cyan-300 underline-offset-2 hover:underline"
          >
            {showMessage ? 'Hide message' : 'Add an optional note'}
          </button>
        </div>
      </div>

      {showMessage && (
        <div className="mt-4">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
            placeholder="Share why you're interested (optional, max 1000 chars)…"
            className="h-24 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
            maxLength={1000}
          />
          <div className="mt-1 text-right text-xs text-slate-500">{message.length}/1000</div>
        </div>
      )}
    </Card>
  );
};

export default ExpressInterestCard;
