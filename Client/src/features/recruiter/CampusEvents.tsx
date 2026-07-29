import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardList,
  Plus,
  Search,
  SendHorizontal,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { eventApi } from '../../api/event.api';
import { recruiterApi } from '../../api/recruiter.api';
import { requestApi } from '../../api/request.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { toast } from 'sonner';
import { getApiErrorMessage } from '../../utils/apiError';
import { RECRUITER_PAGE_CONTENT_CLASS, RecruiterSectionHeader, recruiterCampusSectionItems } from './RecruiterSectionNav';
import { EventWorkspaceModal } from './EventWorkspaceModal';

const eventTypes = [
  'Placement Drive',
  'Internship Drive',
  'Hackathon',
  'Industry Connect Session',
  'Placement Hackathon',
  'Innovation Drive',
  'Other',
] as const;

type InviteFormState = {
  title: string;
  collegeId: string;
  type: (typeof eventTypes)[number];
  date: string;
  description: string;
  linkedJobId: string;
  minimumInnovationScore: string;
};

const createInviteForm = (): InviteFormState => ({
  title: '', collegeId: '', type: eventTypes[0], date: '', description: '', linkedJobId: '', minimumInnovationScore: '0',
});

const formatEventDate = (value: string) =>
  new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

type StatusFilter = 'all' | 'active' | 'closed';
type CampusEventsProps = { embedded?: boolean };

export default function CampusEvents({ embedded = false }: CampusEventsProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isEventWorkspaceOpen, setIsEventWorkspaceOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isOutboundRequestsOpen, setIsOutboundRequestsOpen] = useState(false);
  const [scoreDraft, setScoreDraft] = useState({ studentId: '', score: '' });
  const [selectionDraft, setSelectionDraft] = useState({ studentId: '', jobId: '', note: '' });

  const [inviteForm, setInviteForm] = useState<InviteFormState>(createInviteForm);
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteSentNotice, setInviteSentNotice] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [collegeSearch, setCollegeSearch] = useState('');
  const [isCollegeDropdownOpen, setIsCollegeDropdownOpen] = useState(false);
  const collegeDropdownRef = useRef<HTMLDivElement>(null);

  const minDateTime = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const h = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d}T${h}:${mi}`;
  }, []);

  const hiringEventsQuery = useQuery({ queryKey: ['recruiter', 'hiring-events'], queryFn: recruiterApi.getHiringEvents });
  const collegesQuery = useQuery({ queryKey: ['recruiter', 'all-colleges'], queryFn: recruiterApi.getColleges });
  const jobsQuery = useQuery({ queryKey: ['recruiter', 'jobs'], queryFn: recruiterApi.getJobs });
  const outgoingRequestsQuery = useQuery({ queryKey: ['requests', 'outgoing'], queryFn: requestApi.outgoing });

  const availableColleges = collegesQuery.data ?? [];
  const allEvents = hiringEventsQuery.data ?? [];
  const outgoingRequests = outgoingRequestsQuery.data ?? [];
  const requestedEventId = searchParams.get('eventId');

  const filteredColleges = useMemo(() => {
    if (!collegeSearch.trim()) return availableColleges;
    const q = collegeSearch.toLowerCase();
    return availableColleges.filter((c) => c.displayName.toLowerCase().includes(q));
  }, [availableColleges, collegeSearch]);

  const selectedCollege = useMemo(() => availableColleges.find((c) => c._id === inviteForm.collegeId) ?? null, [availableColleges, inviteForm.collegeId]);

  const filteredEvents = useMemo(() =>
    allEvents.filter((e) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!e.title.toLowerCase().includes(q) && !e.collegeName.toLowerCase().includes(q)) return false;
      }
      if (statusFilter === 'active' && !e.isActive) return false;
      if (statusFilter === 'closed' && e.isActive) return false;
      return true;
    }),
    [allEvents, searchQuery, statusFilter],
  );

  useEffect(() => {
    if (allEvents.length === 0) { setSelectedEventId(null); setIsEventWorkspaceOpen(false); return; }
    if (requestedEventId && allEvents.some((e) => e._id === requestedEventId)) {
      setSelectedEventId(requestedEventId);
      setIsEventWorkspaceOpen(true);
      return;
    }
    if (!selectedEventId || !allEvents.some((e) => e._id === selectedEventId)) {
      setSelectedEventId(allEvents[0]._id);
    }
  }, [allEvents, requestedEventId, selectedEventId]);

  useEffect(() => {
    if (!isCollegeDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (collegeDropdownRef.current && !collegeDropdownRef.current.contains(e.target as Node)) {
        setIsCollegeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isCollegeDropdownOpen]);

  useEffect(() => {
    if (!isOutboundRequestsOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOutboundRequestsOpen(false);
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOutboundRequestsOpen]);

  const selectedEvent = useMemo(() => allEvents.find((e) => e._id === selectedEventId) ?? null, [allEvents, selectedEventId]);
  const activeJobs = useMemo(() => (jobsQuery.data ?? []).filter((j) => j.isActive), [jobsQuery.data]);

  const eventMetrics = useMemo(() => ({
    total: allEvents.length,
    active: allEvents.filter((e) => e.isActive).length,
    registrations: allEvents.reduce((s, e) => s + e.participantsCount, 0),
    ranked: allEvents.filter((e) => e.rankingsComputedAt).length,
  }), [allEvents]);

  const refreshData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['recruiter', 'hiring-events'] }),
      queryClient.invalidateQueries({ queryKey: ['recruiter', 'all-colleges'] }),
      queryClient.invalidateQueries({ queryKey: ['recruiter', 'jobs'] }),
      queryClient.invalidateQueries({ queryKey: ['requests'] }),
    ]);
  };

  const inviteMutation = useMutation({
    mutationFn: ({ collegeId, payload }: { collegeId: string; payload: Parameters<typeof recruiterApi.sendHiringEventInvite>[1] }) =>
      recruiterApi.sendHiringEventInvite(collegeId, payload),
    onSuccess: async (result) => {
      setInviteSentNotice(result.alreadyPending
        ? 'An invite for this event title is already pending with this college.'
        : 'Invite sent! The college will see it in their invitations center.');
      setInviteForm(createInviteForm());
      setInviteMessage('');
      setIsCreateModalOpen(false);
      await refreshData();
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: (requestId: string) => requestApi.withdraw(requestId),
    onSuccess: async () => { await refreshData(); },
  });

  const scoreMutation = useMutation({
    mutationFn: ({ eventId, studentId, score }: { eventId: string; studentId: string; score: number }) =>
      eventApi.addSubmissionScore(eventId, studentId, score),
    onSuccess: async () => {
      toast.success('Participant score saved.');
      setScoreDraft({ studentId: '', score: '' });
      await refreshData();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to save participant score.'));
    },
  });

  const computeMutation = useMutation({
    mutationFn: (eventId: string) => eventApi.computeRankings(eventId),
    onSuccess: async () => {
      toast.success('Rankings computed.');
      await refreshData();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to compute event rankings.'));
    },
  });

  const pipelineMutation = useMutation({
    mutationFn: ({ eventId, studentId, jobId, note }: { eventId: string; studentId: string; jobId: string; note?: string }) =>
      recruiterApi.selectStudentFromEvent(eventId, studentId, { jobId, note }),
    onSuccess: async (_, variables) => {
      toast.success('Candidate added to hiring pipeline.');
      setSelectionDraft({ studentId: '', jobId: '', note: '' });
      await refreshData();
      navigate(`/dashboard/recruiter/applications/${variables.studentId}?jobId=${variables.jobId}`);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to add candidate to pipeline.'));
    },
  });

  const closeEventMutation = useMutation({
    mutationFn: recruiterApi.closeEvent,
    onSuccess: async () => {
      toast.success('Event closed.');
      await refreshData();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to close event.'));
    },
  });

  const canCreateInvite =
    Boolean(inviteForm.title.trim()) && Boolean(inviteForm.collegeId) && Boolean(inviteForm.date) && Boolean(inviteForm.description.trim()) && availableColleges.length > 0;

  const openEventWorkspace = useCallback((eventId: string) => {
    setSelectedEventId(eventId);
    setScoreDraft({ studentId: '', score: '' });
    setSelectionDraft({ studentId: '', jobId: '', note: '' });
    setIsEventWorkspaceOpen(true);
    setSearchParams((c) => { const n = new URLSearchParams(c); n.set('eventId', eventId); return n; });
  }, [setSearchParams]);

  const closeEventWorkspace = useCallback(() => {
    setIsEventWorkspaceOpen(false);
    setSearchParams((c) => { const n = new URLSearchParams(c); n.delete('eventId'); return n; });
  }, [setSearchParams]);

  const openCreateModal = () => {
    setInviteForm(createInviteForm());
    setInviteMessage('');
    setInviteSentNotice('');
    setCollegeSearch('');
    setIsCollegeDropdownOpen(false);
    setIsCreateModalOpen(true);
  };

  const daysUntil = (v: string) => Math.ceil((new Date(v).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div className={`${RECRUITER_PAGE_CONTENT_CLASS} space-y-6`}>
      {!embedded ? (
        <RecruiterSectionHeader
          eyebrow="Campus Hiring"
          title="Campus Events"
          description="Manage campus drives and scored hiring events — send proposals to colleges for approval."
          navItems={recruiterCampusSectionItems}
        />
      ) : null}

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800">
              <ClipboardList className="h-5 w-5 text-slate-300" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{eventMetrics.total}</div>
              <div className="text-xs text-slate-400">Total Events</div>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
              <CalendarDays className="h-5 w-5 text-emerald-300" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{eventMetrics.active}</div>
              <div className="text-xs text-slate-400">Active Now</div>
            </div>
          </div>
          {eventMetrics.total > 0 && (
            <div className="mt-3 h-1.5 w-full rounded-full bg-slate-800">
              <div className="h-1.5 rounded-full bg-emerald-400 transition-all" style={{ width: `${Math.round((eventMetrics.active / eventMetrics.total) * 100)}%` }} />
            </div>
          )}
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10">
              <Users className="h-5 w-5 text-cyan-300" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{eventMetrics.registrations}</div>
              <div className="text-xs text-slate-400">Registrations</div>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
              <Trophy className="h-5 w-5 text-amber-300" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{eventMetrics.ranked}</div>
              <div className="text-xs text-slate-400">Ranked</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Page Title + CTA */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Event List</h2>
          <p className="mt-0.5 text-sm text-slate-400">{eventMetrics.total} events · {eventMetrics.active} active · {eventMetrics.registrations} registrations</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" onClick={() => setIsOutboundRequestsOpen(true)}>
            <ClipboardList className="mr-2 h-4 w-4" />
            Outbound Requests
            <span className="ml-2 rounded-full border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-[10px] text-slate-300">
              {outgoingRequests.length}
            </span>
          </Button>
          <Button onClick={openCreateModal}>
            <Plus className="mr-2 h-4 w-4" />
            Propose Event
          </Button>
        </div>
      </div>

      {/* Search + Filters */}
      <Card className="p-2.5">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search events or colleges..."
              className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 pl-9 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500/50 focus:outline-none" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-cyan-500/50 focus:outline-none">
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </Card>

      {/* Event List */}
      {hiringEventsQuery.isLoading ? (
        <div className="flex items-center justify-center py-12"><Spinner /></div>
      ) : filteredEvents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 px-5 py-12 text-center">
          <Trophy className="mx-auto h-8 w-8 text-slate-600" />
          <div className="mt-3 text-sm font-medium text-slate-400">
            {allEvents.length === 0 ? 'No events yet' : 'No events match filters'}
          </div>
          {allEvents.length === 0 && (
            <button onClick={openCreateModal} className="mt-2 text-sm text-cyan-400 hover:text-cyan-300">
              Propose your first event →
            </button>
          )}
        </div>
      ) : (
        <div>
          <div className="px-1 text-xs text-slate-500">{filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}</div>
          <div className="mt-2 grid gap-2 lg:grid-cols-2">
          {filteredEvents.map((event) => {
            const isSelected = isEventWorkspaceOpen && event._id === selectedEventId;
            const days = daysUntil(event.scheduledAt);
            return (
              <button key={event._id} onClick={() => openEventWorkspace(event._id)}
                className={`w-full rounded-xl border p-3 text-left transition-all active:scale-[0.99] ${isSelected ? 'border-cyan-400/40 bg-cyan-400/5 ring-1 ring-cyan-400/20' : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-800/50'}`}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                    <Trophy className="h-4 w-4 text-amber-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">{event.title}</div>
                        <div className="mt-0.5 truncate text-xs text-slate-400">{event.collegeName}</div>
                      </div>
                      <ChevronRight className={`mt-0.5 h-4 w-4 shrink-0 ${isSelected ? 'text-cyan-400' : 'text-slate-700'}`} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">{event.type}</span>
                      <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${event.isActive ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-800/60 text-slate-500'}`}>
                        {event.isActive ? '● Active' : '○ Closed'}
                      </span>
                      {event.rankingsComputedAt && <span className="inline-flex items-center rounded-md border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-medium text-cyan-300">Ranked</span>}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{event.participantsCount} students</span>
                      <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{days > 0 ? `${days}d away` : days === 0 ? 'Today' : 'Past'}</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
          </div>
        </div>
      )}

      {/* Outbound Requests Modal */}
      {isOutboundRequestsOpen && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-sm sm:p-6"
        onMouseDown={(event) => { if (event.target === event.currentTarget) setIsOutboundRequestsOpen(false); }}
      >
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby="outbound-requests-title"
        className="max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl overflow-y-auto p-5 shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Outbound Requests</div>
            <h2 id="outbound-requests-title" className="mt-2 text-xl font-semibold text-white">Sent Event Invites & Requests</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Track all invitations and event approval requests sent to colleges.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge className="border-slate-700 bg-slate-950 text-slate-300">{outgoingRequests.length} total</Badge>
            <button
              type="button"
              aria-label="Close outbound requests"
              onClick={() => setIsOutboundRequestsOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 text-slate-400 transition-colors hover:border-slate-700 hover:text-white active:scale-[0.98]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {outgoingRequestsQuery.isLoading ? (
          <div className="mt-5 space-y-2" aria-label="Loading sent requests">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-16 animate-pulse rounded-xl border border-slate-800 bg-slate-950/60" />
            ))}
          </div>
        ) : outgoingRequests.length > 0 ? (
          <div className="mt-5 divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40">
            {outgoingRequests.map((request) => {
              const title = (request.metadata?.title as string) || (request.metadata?.subject as string) || request.targetEntityTitle || 'Hiring Event Request';
              const collegeName = (request.metadata?.collegeName as string) || request.targetEntityTitle || 'Target College';
              const eventType = (request.metadata?.type as string) || 'Event Invite';
              const isPending = request.status === 'pending';

              let statusBadgeClass = 'border-slate-700 bg-slate-800 text-slate-300';
              if (request.status === 'pending') statusBadgeClass = 'border-amber-500/30 bg-amber-500/10 text-amber-300';
              else if (request.status === 'accepted') statusBadgeClass = 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
              else if (request.status === 'declined') statusBadgeClass = 'border-rose-500/30 bg-rose-500/10 text-rose-300';

              return (
                <div key={request._id} className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-white">{title}</span>
                      <Badge className={statusBadgeClass}>{request.status.toUpperCase()}</Badge>
                      <Badge className="border-slate-700 bg-slate-900 text-slate-300">{eventType}</Badge>
                    </div>
                    <div className="text-sm text-slate-400">
                      College: <strong className="text-slate-200">{collegeName}</strong> • Sent{' '}
                      {new Date(request.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                    {request.message ? <p className="mt-1 text-xs text-slate-400 italic">"{request.message}"</p> : null}
                  </div>
                  {isPending && (
                    <Button variant="outline" size="sm" className="self-start border-rose-500/30 text-rose-300 hover:bg-rose-500/10 md:self-center"
                      disabled={withdrawMutation.isPending} onClick={() => withdrawMutation.mutate(request._id)}>
                      {withdrawMutation.isPending && withdrawMutation.variables === request._id ? 'Withdrawing...' : 'Withdraw Request'}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-800 px-5 py-8 text-center">
            <div className="text-base font-semibold text-white">No sent requests yet</div>
            <p className="mt-1 text-sm text-slate-400">When you send event proposals, all sent requests will appear here with live status updates.</p>
          </div>
        )}
      </Card>
      </div>
      )}

      {/* ─── Create Event Modal (Proposal Only) ─── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setIsCreateModalOpen(false); }}>
          <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Campus Events</div>
                <h2 className="mt-1 text-xl font-semibold text-white">Send Event Proposal</h2>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 text-slate-400 transition-colors hover:border-slate-700 hover:text-white">
                ✕
              </button>
            </div>

            <div className="max-h-[calc(100vh-12rem)] space-y-4 overflow-y-auto px-6 py-5">
              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-sm text-cyan-200">
                Send an event proposal to a college. Once accepted by their placement department, the event will be published automatically.
              </div>

              {inviteSentNotice && (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{inviteSentNotice}</div>
              )}

              <div className="grid gap-1">
                <label className="text-xs font-medium text-slate-400">Event Title *</label>
                <Input value={inviteForm.title} onChange={(e) => setInviteForm((c) => ({ ...c, title: e.target.value }))} placeholder="Hiring event title" />
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-medium text-slate-400">College *</label>
                <div ref={collegeDropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => { setIsCollegeDropdownOpen((o) => !o); setCollegeSearch(''); }}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-left transition-colors hover:border-slate-700 focus:border-cyan-500/50 focus:outline-none"
                  >
                    {selectedCollege ? (
                      <span className="text-white">{selectedCollege.displayName}</span>
                    ) : (
                      <span className="text-slate-500">Select college...</span>
                    )}
                    <svg className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${isCollegeDropdownOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                  </button>
                  {isCollegeDropdownOpen && (
                    <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-2xl">
                      <div className="border-b border-slate-800 px-3 py-2">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                          <input
                            autoFocus
                            value={collegeSearch}
                            onChange={(e) => setCollegeSearch(e.target.value)}
                            placeholder="Search colleges..."
                            className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 pl-8 pr-3 text-xs text-white placeholder:text-slate-500 focus:border-cyan-500/50 focus:outline-none"
                          />
                          {collegeSearch && (
                            <button onClick={() => setCollegeSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="overflow-y-auto max-h-48 p-1">
                        {filteredColleges.length === 0 ? (
                          <div className="px-3 py-4 text-center text-xs text-slate-500">
                            {availableColleges.length === 0 ? 'No colleges available' : 'No colleges match your search'}
                          </div>
                        ) : (
                          filteredColleges.map((c) => (
                            <button
                              key={c._id}
                              type="button"
                              onClick={() => {
                                setInviteForm((prev) => ({ ...prev, collegeId: c._id }));
                                setIsCollegeDropdownOpen(false);
                                setCollegeSearch('');
                              }}
                              className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                                inviteForm.collegeId === c._id
                                  ? 'bg-cyan-500/10 text-cyan-300'
                                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                              }`}
                            >
                              <span className="truncate">{c.displayName}</span>
                              {inviteForm.collegeId === c._id && <Check className="h-4 w-4 shrink-0 text-cyan-400" />}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-medium text-slate-400">Event Type</label>
                <select value={inviteForm.type} onChange={(e) => setInviteForm((c) => ({ ...c, type: e.target.value as (typeof eventTypes)[number] }))}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white">
                  {eventTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-medium text-slate-400">Date & Time *</label>
                <Input type="datetime-local" value={inviteForm.date} min={minDateTime} onChange={(e) => setInviteForm((c) => ({ ...c, date: e.target.value }))} />
              </div>

              <div className="grid gap-1">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-slate-400">Linked Job</label>
                  <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-cyan-300">Optional</span>
                </div>
                <select value={inviteForm.linkedJobId} onChange={(e) => setInviteForm((c) => ({ ...c, linkedJobId: e.target.value }))}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white">
                  <option value="">Link to a job later</option>
                  {activeJobs.map((j) => <option key={j._id} value={j._id}>{j.title} | {j.company}</option>)}
                </select>
              </div>

              <div className="grid gap-1">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-slate-400">Minimum Innovation Score</label>
                  <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-cyan-300">Optional</span>
                </div>
                <Input type="number" min={0} value={inviteForm.minimumInnovationScore} onChange={(e) => setInviteForm((c) => ({ ...c, minimumInnovationScore: e.target.value }))} placeholder="0" />
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-medium text-slate-400">Description *</label>
                <textarea value={inviteForm.description} onChange={(e) => setInviteForm((c) => ({ ...c, description: e.target.value }))}
                  placeholder="Describe the hiring event, roles, expectations..."
                  className="min-h-28 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-500" />
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-medium text-slate-400">Message to College (optional)</label>
                <textarea value={inviteMessage} onChange={(e) => setInviteMessage(e.target.value)}
                  placeholder="Why this event benefits their students..."
                  className="min-h-20 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-500" />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-800 px-6 py-4">
              <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
              <Button onClick={() => inviteMutation.mutate({ collegeId: inviteForm.collegeId, payload: { title: inviteForm.title, type: inviteForm.type, date: new Date(inviteForm.date).toISOString(), description: inviteForm.description, minimumInnovationScore: Number(inviteForm.minimumInnovationScore || '0'), ...(inviteForm.linkedJobId ? { linkedJobId: inviteForm.linkedJobId } : {}), ...(inviteMessage.trim() ? { message: inviteMessage.trim() } : {}) } })}
                disabled={inviteMutation.isPending || !canCreateInvite}>
                <SendHorizontal className="mr-2 h-4 w-4" />
                {inviteMutation.isPending ? 'Sending...' : 'Send Proposal'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Event Workspace Modal ─── */}
      {selectedEvent && isEventWorkspaceOpen ? (
        <EventWorkspaceModal
          event={selectedEvent}
          activeJobs={activeJobs}
          scoreDraft={scoreDraft}
          setScoreDraft={setScoreDraft}
          selectionDraft={selectionDraft}
          setSelectionDraft={setSelectionDraft}
          isComputingRankings={computeMutation.isPending && computeMutation.variables === selectedEvent._id}
          isSavingScore={scoreMutation.isPending && scoreMutation.variables?.eventId === selectedEvent._id}
          isAddingToPipeline={pipelineMutation.isPending && pipelineMutation.variables?.eventId === selectedEvent._id}
          isClosingEvent={closeEventMutation.isPending && closeEventMutation.variables === selectedEvent._id}
          onClose={closeEventWorkspace}
          onComputeRankings={() => computeMutation.mutate(selectedEvent._id)}
          onSaveScore={() => scoreMutation.mutate({ eventId: selectedEvent._id, studentId: scoreDraft.studentId, score: Number(scoreDraft.score) })}
          onAddToPipeline={() => pipelineMutation.mutate({ eventId: selectedEvent._id, studentId: selectionDraft.studentId, jobId: selectionDraft.jobId, ...(selectionDraft.note.trim() ? { note: selectionDraft.note.trim() } : {}) })}
          onCloseEvent={() => closeEventMutation.mutate(selectedEvent._id)}
        />
      ) : null}
    </div>
  );
}
