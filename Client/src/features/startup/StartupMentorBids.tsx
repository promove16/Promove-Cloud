import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOutletContext, useParams } from 'react-router-dom';
import { mentorApi, type StartupMentorBid } from '../../api/mentor.api';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { Button } from '../../components/ui/Button';
import { toast } from 'sonner';
import { UserCheck, Check, X, Clock, Calendar, Award, Sparkles, Briefcase, MessageSquare } from 'lucide-react';
import { getApiErrorMessage } from '../../utils/apiError';

type StartupOutletContext = {
  startupId?: string;
};

const STATUS_STYLES: Record<StartupMentorBid['status'], { bg: string; text: string; border: string; label: string }> = {
  pending: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', label: 'Pending Review' },
  accepted: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', label: 'Accepted' },
  rejected: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20', label: 'Declined' },
  withdrawn: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20', label: 'Withdrawn' },
};

function MentorBidCard({
  bid,
  onRespond,
  isResponding,
}: {
  bid: StartupMentorBid;
  onRespond: (bidId: string, status: 'accepted' | 'rejected') => void;
  isResponding: boolean;
}) {
  const style = STATUS_STYLES[bid.status] ?? STATUS_STYLES.pending;
  const isPending = bid.status === 'pending';
  const mentor = bid.mentor;
  const displayName = mentor?.displayName || 'Anonymous Mentor';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <Card className="p-6 bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl hover:border-slate-700/80 transition-all duration-300 shadow-xl overflow-hidden flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3.5 min-w-0">
            {mentor?.avatar ? (
              <img
                src={mentor.avatar}
                alt={displayName}
                className="w-12 h-12 rounded-full object-cover border border-cyan-500/30 shrink-0"
              />
            ) : (
              <div className="w-12 h-12 shrink-0 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-inner">
                {initial}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h4 className="text-white font-semibold text-base truncate">{displayName}</h4>
                {typeof mentor?.innovationScore === 'number' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    <Sparkles className="w-3 h-3" /> {mentor.innovationScore} pts
                  </span>
                )}
              </div>
              <p className="text-slate-400 text-xs truncate mt-0.5">{mentor?.domain || bid.expertise || 'Expert Mentor'}</p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 border ${style.bg} ${style.text} ${style.border}`}>
            {style.label}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800/80">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Briefcase className="w-3.5 h-3.5 text-cyan-400" /> Expertise
            </div>
            <p className="text-slate-200 text-xs font-medium truncate">{bid.expertise}</p>
          </div>
          <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800/80">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Clock className="w-3.5 h-3.5 text-indigo-400" /> Availability
            </div>
            <p className="text-slate-200 text-xs font-medium truncate">{bid.hoursPerWeek} hrs/week</p>
          </div>
          <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800/80">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" /> Proposed Duration
            </div>
            <p className="text-slate-200 text-xs font-medium truncate">{bid.proposedDurationWeeks} weeks</p>
          </div>
          <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800/80">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Award className="w-3.5 h-3.5 text-purple-400" /> Submitted
            </div>
            <p className="text-slate-200 text-xs font-medium truncate">
              {new Date(bid.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
            </p>
          </div>
        </div>

        {bid.coverNote && (
          <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/60 mb-4">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-cyan-400" /> Cover Note
            </div>
            <p className="text-slate-300 text-xs leading-relaxed italic">&ldquo;{bid.coverNote}&rdquo;</p>
          </div>
        )}
      </div>

      {isPending && (
        <div className="flex gap-2 pt-2 border-t border-slate-800/80">
          <Button
            onClick={() => onRespond(bid._id, 'accepted')}
            disabled={isResponding}
            size="sm"
            className="flex-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors font-medium text-xs py-2"
          >
            <Check className="w-3.5 h-3.5 mr-1.5" /> Accept Mentor Proposal
          </Button>
          <Button
            onClick={() => onRespond(bid._id, 'rejected')}
            disabled={isResponding}
            size="sm"
            className="flex-1 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 transition-colors font-medium text-xs py-2"
          >
            <X className="w-3.5 h-3.5 mr-1.5" /> Decline
          </Button>
        </div>
      )}
    </Card>
  );
}

export function StartupMentorBids() {
  const params = useParams<{ startupId?: string }>();
  const context = useOutletContext<StartupOutletContext>();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');

  const startupId = params.startupId || context?.startupId;

  const bidsQuery = useQuery({
    queryKey: ['startup-mentor-bids', startupId],
    queryFn: () => mentorApi.getStartupMentorBids(startupId!),
    enabled: Boolean(startupId),
  });

  const respondMutation = useMutation({
    mutationFn: ({ bidId, status }: { bidId: string; status: 'accepted' | 'rejected' }) =>
      mentorApi.respondStartupMentorBid(startupId!, bidId, status),
    onSuccess: (_, variables) => {
      toast.success(variables.status === 'accepted' ? 'Mentor bid accepted!' : 'Mentor bid declined');
      queryClient.invalidateQueries({ queryKey: ['startup-mentor-bids', startupId] });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to update bid status'));
    },
  });

  const allBids = bidsQuery.data ?? [];

  const filteredBids = useMemo(() => {
    if (filter === 'all') return allBids;
    return allBids.filter((b) => b.status === filter);
  }, [allBids, filter]);

  const stats = useMemo(() => {
    return {
      total: allBids.length,
      pending: allBids.filter((b) => b.status === 'pending').length,
      accepted: allBids.filter((b) => b.status === 'accepted').length,
      rejected: allBids.filter((b) => b.status === 'rejected').length,
    };
  }, [allBids]);

  if (bidsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 bg-gradient-to-r from-cyan-950/40 via-slate-900 to-indigo-950/40 border border-cyan-500/20 rounded-3xl backdrop-blur-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 mb-2">
              <UserCheck className="w-3.5 h-3.5" /> Mentorship Deal Flow
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Mentor Proposals & Bids</h2>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              Review mentorship applications submitted by industry mentors for your startup. Accept bids to start working directly with expert guidance.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-2 bg-slate-900/80 border border-slate-800 rounded-2xl text-center min-w-[90px]">
              <span className="text-xs text-slate-400 block">Total</span>
              <span className="text-lg font-bold text-white">{stats.total}</span>
            </div>
            <div className="px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-center min-w-[90px]">
              <span className="text-xs text-amber-300/80 block">Pending</span>
              <span className="text-lg font-bold text-amber-400">{stats.pending}</span>
            </div>
            <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center min-w-[90px]">
              <span className="text-xs text-emerald-300/80 block">Accepted</span>
              <span className="text-lg font-bold text-emerald-400">{stats.accepted}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {(
          [
            { key: 'all', label: `All Proposals (${stats.total})` },
            { key: 'pending', label: `Pending (${stats.pending})` },
            { key: 'accepted', label: `Accepted (${stats.accepted})` },
            { key: 'rejected', label: `Declined (${stats.rejected})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
              filter === tab.key
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-950/40'
                : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Bid Grid */}
      {filteredBids.length > 0 ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredBids.map((bid) => (
            <MentorBidCard
              key={bid._id}
              bid={bid}
              onRespond={(bidId, status) => respondMutation.mutate({ bidId, status })}
              isResponding={respondMutation.isPending}
            />
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-2xl">
          <UserCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">No Mentor Proposals Found</h3>
          <p className="text-slate-400 text-sm mt-1 max-w-md mx-auto">
            {filter === 'all'
              ? 'Your startup has not received any mentor bids yet. Ensure your startup is launched to mentors to receive proposals!'
              : `No mentor bids matching '${filter}' status.`}
          </p>
        </Card>
      )}
    </div>
  );
}

export default StartupMentorBids;
