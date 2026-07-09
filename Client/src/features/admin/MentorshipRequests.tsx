import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock3, GraduationCap, MapPin, Search, X, Landmark, School } from 'lucide-react';
import { adminApi } from '../../api/admin.api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import type { InstitutionMentorshipProgram } from '../../types/mentorship.types';
import { getApiErrorMessage } from '../../utils/apiError';
import {
  createPickerOnlyDateTimeInputHandlers,
  emptyAssignmentDraft,
  type AssignmentDraft,
} from './mentorshipAdminShared';
import { MentorSearchField } from './MentorSearchField';
import { toast } from 'sonner';

const formatDateTimeDisplay = (value?: string) =>
  value
    ? new Date(value).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Not provided';

const toDateTimeLocalValue = (value?: string) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
};

const getRequestedVenue = (program: InstitutionMentorshipProgram) =>
  program.venue?.trim() ||
  program.institution.location?.trim() ||
  program.institution.locations?.find((location) => location.trim())?.trim() ||
  '';

const getDefaultDraft = (program: InstitutionMentorshipProgram): AssignmentDraft => {
  const requestedVenue = getRequestedVenue(program);
  const deliveryMode = program.deliveryMode;
  const isOnline = deliveryMode === 'Online';

  return {
    ...emptyAssignmentDraft(),
    scheduledAt: toDateTimeLocalValue(program.scheduledAt ?? program.preferredDate),
    deliveryMode,
    platform: isOnline ? (program.platform === 'Offline' ? 'Google Meet' : program.platform) : 'Offline',
    meetingLink: isOnline ? program.meetingLink ?? '' : '',
    venue: isOnline ? '' : requestedVenue,
    adminNotes: program.adminNotes ?? '',
  };
};

export default function MentorshipRequests() {
  const queryClient = useQueryClient();
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, AssignmentDraft>>({});
  
  // Interactive filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');

  const programsQuery = useQuery({
    queryKey: ['admin-mentorship-programs'],
    queryFn: () => adminApi.getMentorshipPrograms(),
  });
  const mentorsQuery = useQuery({
    queryKey: ['admin-mentors'],
    queryFn: adminApi.getMentors,
  });

  const reviewMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Parameters<typeof adminApi.reviewMentorshipProgram>[1];
    }) => adminApi.reviewMentorshipProgram(id, payload),
    onSuccess: () => {
      toast.success('Mentorship request reviewed successfully.');
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-mentorship-programs'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-mentors'] }),
      ]);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Unable to review the mentorship request right now.'));
    },
  });

  const pendingPrograms = useMemo(
    () => (programsQuery.data?.items ?? []).filter((item) => item.status === 'Pending'),
    [programsQuery.data?.items],
  );
  
  const mentors = mentorsQuery.data ?? [];

  // Filter requests list
  const filteredRequests = useMemo(() => {
    let result = [...pendingPrograms];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.institution.displayName.toLowerCase().includes(q) ||
          p.objective.toLowerCase().includes(q) ||
          p.preferredExpertise?.toLowerCase().includes(q) ||
          p.requestedBy.displayName.toLowerCase().includes(q)
      );
    }

    if (deliveryFilter !== 'All') {
      result = result.filter((p) => p.deliveryMode === deliveryFilter);
    }

    if (typeFilter !== 'All') {
      result = result.filter((p) => p.institution.type === typeFilter);
    }

    return result;
  }, [pendingPrograms, searchTerm, deliveryFilter, typeFilter]);

  const getDraft = (program: InstitutionMentorshipProgram) =>
    assignmentDrafts[program._id] ?? getDefaultDraft(program);
    
  const updateDraft = (program: InstitutionMentorshipProgram, patch: Partial<AssignmentDraft>) =>
    setAssignmentDrafts((current) => ({
      ...current,
      [program._id]: { ...(current[program._id] ?? getDefaultDraft(program)), ...patch },
    }));

  return (
    <div className="space-y-6">
      <Card className="border-slate-800 bg-slate-950 p-6 shadow-2xl">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-white">Pending requests</h2>
        </div>

        {/* Search and Filters row */}
        <div className="mt-6 flex flex-col gap-4 border-t border-slate-800/80 pt-6 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              type="text"
              placeholder="Search requests by title, school name, expertise..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-slate-800 bg-slate-900/50 pl-10 text-white placeholder-slate-500 focus:border-cyan-500"
            />
            {searchTerm ? (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-4 shrink-0">
            {/* Filter by delivery mode */}
            <div className="flex items-center gap-2">
              <select
                value={deliveryFilter}
                onChange={(e) => setDeliveryFilter(e.target.value)}
                className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
              >
                <option value="All">All Delivery Modes</option>
                <option value="Online">Online Sessions</option>
                <option value="Offline">Offline Sessions</option>
              </select>
            </div>

            {/* Filter by type */}
            <div className="flex items-center gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
              >
                <option value="All">All Institution Types</option>
                <option value="school">Schools Only</option>
                <option value="college">Colleges Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Requests cards lists */}
        <div className="mt-8 space-y-6">
          {programsQuery.isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner />
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/10 py-16 text-center">
              <div className="rounded-full bg-slate-900 p-4 text-slate-600">
                <GraduationCap className="h-8 w-8" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">No pending requests</h3>
              <p className="mt-2 text-sm text-slate-400 max-w-sm">
                There are currently no pending mentorship requests matching your search or filters.
              </p>
            </div>
          ) : (
            filteredRequests.map((program) => {
              const draft = getDraft(program);
              const requestedVenue = getRequestedVenue(program);
              const requestedSchedule = formatDateTimeDisplay(program.preferredDate);
              const isSchool = program.institution.type === 'school';
              
              return (
                <div
                  key={program._id}
                  className="group relative overflow-hidden rounded-[24px] border border-slate-800 bg-slate-900/20 p-6 transition-all duration-300 hover:border-slate-700/80 hover:bg-slate-900/40"
                >
                  {/* Top category strip */}
                  <div className={`absolute top-0 inset-x-0 h-[2.5px] bg-gradient-to-r ${
                    isSchool ? 'from-amber-500 to-orange-500' : 'from-rose-500 to-pink-500'
                  } opacity-80`} />

                  <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                    
                    {/* Left main info */}
                    <div className="min-w-0 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              isSchool 
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}>
                              {isSchool ? <School className="h-3 w-3" /> : <Landmark className="h-3 w-3" />}
                              {isSchool ? 'School Request' : 'College Request'}
                            </span>
                            <h3 className="mt-3 text-lg font-bold text-white group-hover:text-cyan-300 transition duration-150">
                              {program.title}
                            </h3>
                            <p className="text-sm font-medium text-slate-400 mt-1">
                              {program.institution.displayName}
                            </p>
                          </div>
                          
                        </div>

                        {/* Objectives description */}
                        <p className="mt-4 text-sm leading-relaxed text-slate-300 whitespace-pre-line">
                          {program.objective}
                        </p>
                      </div>

                      {/* Metadata chips */}
                      <div className="mt-4 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-md border border-slate-800 bg-slate-950 px-2.5 py-1 text-slate-400">
                          {program.expectedParticipants} participants
                        </span>
                        <span className="rounded-md border border-slate-800 bg-slate-950 px-2.5 py-1 text-slate-400">
                          {program.durationMinutes} min
                        </span>
                        <span className="rounded-md border border-slate-800 bg-slate-950 px-2.5 py-1 text-slate-400">
                          {program.deliveryMode}
                        </span>
                        {program.preferredExpertise ? (
                          <span className="rounded-md border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-1 text-cyan-400">
                            {program.preferredExpertise}
                          </span>
                        ) : null}
                      </div>

                      {/* Schedule + requester inline row */}
                      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1.5">
                          <Clock3 className="h-3.5 w-3.5" />
                          <span className="text-slate-300">{requestedSchedule}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          <span className="text-slate-300">
                            {program.deliveryMode === 'Online'
                              ? program.platform
                              : requestedVenue || 'Venue TBD'}
                          </span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span>By</span>
                          <span className="text-slate-300">{program.requestedBy.displayName}</span>
                          <span>·</span>
                          <span>{program.requestedBy.email}</span>
                        </span>
                      </div>
                      {program.deliveryMode === 'Online' && program.meetingLink ? (
                        <div className="mt-2 text-xs">
                          <a href={program.meetingLink} target="_blank" rel="noreferrer" className="break-all font-mono text-cyan-400 underline hover:text-cyan-300">
                            {program.meetingLink}
                          </a>
                        </div>
                      ) : null}
                    </div>

                    {/* Right scheduling sidebar container */}
                    <aside className="rounded-2xl border border-slate-800 bg-slate-950 p-4 sm:p-5 flex flex-col justify-between">
                      <div className="space-y-4">
                        <div className="space-y-3">
                          <MentorSearchField
                            mentors={mentors}
                            value={draft.mentorId}
                            onChange={(mentorId) => updateDraft(program, { mentorId })}
                            preferredExpertise={program.preferredExpertise}
                          />

                          <div>
                            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-500">Schedule</label>
                            <input
                              type="datetime-local"
                              value={draft.scheduledAt}
                              onChange={(event) => updateDraft(program, { scheduledAt: event.target.value })}
                              {...createPickerOnlyDateTimeInputHandlers(() => updateDraft(program, { scheduledAt: '' }))}
                              className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                            />
                          </div>

                          <div className="grid gap-3 grid-cols-2">
                            <div>
                              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-500">Mode</label>
                              <select
                                value={draft.deliveryMode}
                                onChange={(event) => {
                                  const deliveryMode = event.target.value as AssignmentDraft['deliveryMode'];
                                  updateDraft(program, {
                                    deliveryMode,
                                    platform: deliveryMode === 'Online' ? 'Google Meet' : 'Offline',
                                    meetingLink: deliveryMode === 'Online' ? draft.meetingLink : '',
                                    venue: deliveryMode === 'Offline' ? draft.venue || requestedVenue : '',
                                  });
                                }}
                                className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                              >
                                <option value="Online">Online</option>
                                <option value="Offline">Offline</option>
                              </select>
                            </div>

                            <div>
                              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-500">Platform</label>
                              <select
                                value={draft.platform}
                                onChange={(event) =>
                                  updateDraft(program, {
                                    platform: event.target.value as AssignmentDraft['platform'],
                                  })
                                }
                                className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                              >
                                {draft.deliveryMode === 'Online' ? (
                                  <>
                                    <option value="Google Meet">Google Meet</option>
                                    <option value="Microsoft Teams">Microsoft Teams</option>
                                    <option value="Zoom">Zoom</option>
                                  </>
                                ) : (
                                  <option value="Offline">Offline</option>
                                )}
                              </select>
                            </div>
                          </div>

                          {draft.deliveryMode === 'Online' ? (
                            <div>
                              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-500">Link</label>
                              <input
                                value={draft.meetingLink}
                                onChange={(event) => updateDraft(program, { meetingLink: event.target.value })}
                                placeholder="Paste meeting URL"
                                className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                              />
                            </div>
                          ) : (
                            <div>
                              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-500">Venue</label>
                              <input
                                value={draft.venue}
                                onChange={(event) => updateDraft(program, { venue: event.target.value })}
                                placeholder="Venue location"
                                className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                              />
                            </div>
                          )}

                          <div>
                            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-500">Notes</label>
                            <textarea
                              value={draft.adminNotes}
                              onChange={(event) => updateDraft(program, { adminNotes: event.target.value })}
                              placeholder="Internal notes"
                              className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none min-h-16"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 flex gap-2 pt-2 border-t border-slate-900">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            const rejectionReason = window.prompt('Enter rejection reason:')?.trim();
                            if (!rejectionReason) return;
                            reviewMutation.mutate({
                              id: program._id,
                              payload: {
                                decision: 'rejected',
                                rejectionReason,
                                ...(draft.adminNotes.trim() ? { adminNotes: draft.adminNotes.trim() } : {}),
                              },
                            });
                          }}
                          disabled={reviewMutation.isPending}
                          className="w-full text-xs font-semibold py-2 rounded-xl"
                        >
                          Reject
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() =>
                            reviewMutation.mutate({
                              id: program._id,
                              payload: {
                                decision: 'assigned',
                                mentorId: draft.mentorId,
                                scheduledAt: new Date(draft.scheduledAt).toISOString(),
                                deliveryMode: draft.deliveryMode,
                                platform: draft.platform,
                                ...(draft.deliveryMode === 'Online' && draft.meetingLink.trim()
                                  ? { meetingLink: draft.meetingLink.trim() }
                                  : {}),
                                ...(draft.deliveryMode === 'Offline' && draft.venue.trim()
                                  ? { venue: draft.venue.trim() }
                                  : {}),
                                ...(draft.adminNotes.trim() ? { adminNotes: draft.adminNotes.trim() } : {}),
                              },
                            })
                          }
                          disabled={reviewMutation.isPending || !draft.mentorId || !draft.scheduledAt}
                          className="w-full text-xs font-semibold py-2 rounded-xl"
                        >
                          Assign
                        </Button>
                      </div>
                    </aside>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}

