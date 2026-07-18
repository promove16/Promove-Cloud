import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BriefcaseBusiness, CalendarDays, Sparkles, Trophy, Users } from 'lucide-react';
import { eventApi } from '../../api/event.api';
import { recruiterApi } from '../../api/recruiter.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { useAuthStore } from '../../store/authStore';

const badgeClassFor = (category?: 'internal' | 'hiring') =>
  category === 'hiring'
    ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
    : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300';

export default function StudentEventsPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState<'events' | 'drives'>('events');

  const eventsQuery = useQuery({
    queryKey: ['student', 'events'],
    queryFn: eventApi.listMyInstitutionEvents,
    enabled: activeTab === 'events',
  });

  const drivesQuery = useQuery({
    queryKey: ['student', 'drives'],
    queryFn: eventApi.listMyInstitutionDrives,
    enabled: activeTab === 'drives',
  });

  const joinMutation = useMutation({
    mutationFn: eventApi.joinEvent,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['student', 'events'] });
    },
  });

  const registerDriveMutation = useMutation({
    mutationFn: recruiterApi.registerForDrive,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['student', 'drives'] });
    },
  });

  const events = eventsQuery.data ?? [];
  const drives = drivesQuery.data ?? [];
  const institutionName = user?.institutionProfile?.institutionName ?? 'your institution';
  const currentUserId = user?._id ?? null;
  const userInnovationScore = user?.innovationScore ?? 0;

  const eventStats = useMemo(() => {
    const hiring = events.filter((event) => event.category === 'hiring').length;
    const upcoming = events.filter((event) => new Date(event.scheduledAt).getTime() >= Date.now()).length;
    return {
      total: events.length,
      hiring,
      upcoming,
    };
  }, [events]);

  const driveStats = useMemo(() => {
    const active = drives.filter((drive) => drive.isActive).length;
    const registered = drives.filter((drive) =>
      drive.registeredStudents.some((reg) => reg.studentId === currentUserId)
    ).length;
    return {
      total: drives.length,
      active,
      registered,
    };
  }, [drives, currentUserId]);

  const getDriveTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'Placement Drive':
        return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
      case 'Internship Drive':
        return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300';
      default:
        return 'border-amber-500/30 bg-amber-500/10 text-amber-300'; // Hackathon
    }
  };

  return (
    <div className="space-y-6">
      <header className="border-b border-slate-800 pb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-cyan-300 font-semibold">
            <Sparkles className="h-4 w-4" />
            Ecosystem Events
          </div>
          <h1 className="text-2xl font-semibold text-white">
            {activeTab === 'events' ? 'My Events & Hackathons' : 'Campus Opportunities'}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {activeTab === 'events'
              ? `Explore internal and hiring events available only for ${institutionName}.`
              : `View direct placements, internships, and hackathons scheduled for ${institutionName}.`}
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="inline-flex rounded-full border border-slate-800 bg-slate-950 p-1 self-start sm:self-center">
          <button
            type="button"
            onClick={() => setActiveTab('events')}
            className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
              activeTab === 'events'
                ? 'bg-slate-100 text-slate-950'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Events & Hackathons
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('drives')}
            className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
              activeTab === 'drives'
                ? 'bg-slate-100 text-slate-950'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Campus Opportunities
          </button>
        </div>
      </header>

      {activeTab === 'events' ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <Card className="p-5 bg-[#0b1329] border-slate-800">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-5 w-5 text-cyan-300" />
                <div>
                  <div className="text-2xl font-semibold text-white">{eventStats.total}</div>
                  <div className="text-sm text-slate-400">Total events</div>
                </div>
              </div>
            </Card>
            <Card className="p-5 bg-[#0b1329] border-slate-800">
              <div className="flex items-center gap-3">
                <Trophy className="h-5 w-5 text-amber-300" />
                <div>
                  <div className="text-2xl font-semibold text-white">{eventStats.hiring}</div>
                  <div className="text-sm text-slate-400">Hiring events</div>
                </div>
              </div>
            </Card>
            <Card className="p-5 bg-[#0b1329] border-slate-800">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-emerald-300" />
                <div>
                  <div className="text-2xl font-semibold text-white">{eventStats.upcoming}</div>
                  <div className="text-sm text-slate-400">Upcoming</div>
                </div>
              </div>
            </Card>
          </section>

          {eventsQuery.isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : null}

          {eventsQuery.isError ? (
            <Card className="border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-100">
              Unable to load your events right now.
            </Card>
          ) : null}

          {!eventsQuery.isLoading && !eventsQuery.isError && events.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="text-lg font-semibold text-white">No events available yet</div>
              <p className="mt-2 text-sm text-slate-400">
                Your college or school will see new registrations here as soon as events are published.
              </p>
            </Card>
          ) : null}

          <div className="grid gap-4">
            {events.map((event) => {
              const joined = Boolean(currentUserId) && event.participants.some((participant) => participant.studentId === currentUserId);
              const isUpcoming = new Date(event.scheduledAt).getTime() >= Date.now();

              return (
                <Card key={event._id} className="p-6 border-slate-800 bg-[#0b1329]">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.28em] text-slate-400 font-semibold">
                        <span>{event.type}</span>
                        <Badge className={badgeClassFor(event.category)}>
                          {event.category === 'hiring' ? 'Hiring Event' : 'Internal Event'}
                        </Badge>
                        <Badge className={isUpcoming ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-900 text-slate-300'}>
                          {isUpcoming ? 'Upcoming' : 'Completed'}
                        </Badge>
                      </div>
                      <h2 className="text-xl font-semibold text-white">{event.title}</h2>
                      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{event.description}</p>
                      <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500 font-medium">
                        <span>{new Date(event.scheduledAt).toLocaleString('en-IN')}</span>
                        <span>•</span>
                        <span>{event.participantsCount} participants</span>
                        {event.recruiterName ? (
                          <>
                            <span>•</span>
                            <span>
                              Hosted by: <strong className="text-slate-400">{event.recruiterName}</strong>
                              {event.companyName ? ` (${event.companyName})` : event.recruiterCompany ? ` (${event.recruiterCompany})` : ''}
                            </span>
                          </>
                        ) : null}
                        {event.jobTitle ? (
                          <>
                            <span>•</span>
                            <span className="text-cyan-400 font-medium">Job: {event.jobTitle}</span>
                          </>
                        ) : null}
                        {typeof event.minimumInnovationScore === 'number' && event.category === 'hiring' ? (
                          <>
                            <span>•</span>
                            <span>Min. Score: {event.minimumInnovationScore}</span>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-col items-stretch gap-3 sm:min-w-44">
                      <Button
                        onClick={() => joinMutation.mutate(event._id)}
                        disabled={joined || joinMutation.isPending || !isUpcoming}
                      >
                        {joined ? 'Already Registered' : joinMutation.isPending && joinMutation.variables === event._id ? 'Registering...' : 'Register'}
                      </Button>
                      {event.rankings.length > 0 ? (
                        <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-300 text-center font-medium">
                          Rankings published
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {event.rankings.length > 0 ? (
                    <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950 p-4">
                      <div className="mb-3 text-xs uppercase tracking-[0.28em] text-cyan-300 font-semibold">Leaderboard Snapshot</div>
                      <div className="space-y-2">
                        {event.rankings.slice(0, 3).map((ranking) => (
                          <div
                            key={`${event._id}-${ranking.studentId}`}
                            className="flex items-center justify-between rounded-xl border border-slate-800 px-4 py-3 text-sm"
                          >
                            <div className="font-semibold text-white">
                              #{ranking.rank} {ranking.studentName}
                            </div>
                            <div className="text-slate-400 font-medium">Composite {ranking.compositeScore}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <Card className="p-5 bg-[#0b1329] border-slate-800">
              <div className="flex items-center gap-3">
                <BriefcaseBusiness className="h-5 w-5 text-cyan-300" />
                <div>
                  <div className="text-2xl font-semibold text-white">{driveStats.total}</div>
                  <div className="text-sm text-slate-400">Total opportunities</div>
                </div>
              </div>
            </Card>
            <Card className="p-5 bg-[#0b1329] border-slate-800">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-5 w-5 text-emerald-300" />
                <div>
                  <div className="text-2xl font-semibold text-white">{driveStats.active}</div>
                  <div className="text-sm text-slate-400">Active opportunities</div>
                </div>
              </div>
            </Card>
            <Card className="p-5 bg-[#0b1329] border-slate-800">
              <div className="flex items-center gap-3">
                <Trophy className="h-5 w-5 text-amber-300" />
                <div>
                  <div className="text-2xl font-semibold text-white">{driveStats.registered}</div>
                  <div className="text-sm text-slate-400">Registered drives</div>
                </div>
              </div>
            </Card>
          </section>

          {drivesQuery.isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : null}

          {drivesQuery.isError ? (
            <Card className="border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-100">
              Unable to load your campus opportunities right now.
            </Card>
          ) : null}

          {!drivesQuery.isLoading && !drivesQuery.isError && drives.length === 0 ? (
            <Card className="p-8 text-center bg-slate-950 border-slate-800">
              <BriefcaseBusiness className="mx-auto h-12 w-12 text-slate-600 mb-3" />
              <h3 className="text-lg font-semibold text-white">No campus opportunities yet</h3>
              <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">
                No active placement drives, internships, or hackathons have been scheduled by recruiters for your college yet. Check back soon!
              </p>
            </Card>
          ) : null}

          <div className="grid gap-4">
            {drives.map((drive) => {
              const joined = drive.registeredStudents.some((reg) => reg.studentId === currentUserId);
              const myRegistration = drive.registeredStudents.find((reg) => reg.studentId === currentUserId);
              const meetsRequirements = userInnovationScore >= drive.minimumInnovationScore;
              const isUpcoming = new Date(drive.scheduledAt).getTime() >= Date.now();

              return (
                <Card key={drive._id} className="p-6 border-slate-800 bg-[#0b1329]">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.28em] text-slate-400 font-semibold">
                        <Badge className={getDriveTypeBadgeClass(drive.type)}>{drive.type}</Badge>
                        <Badge className={drive.isActive ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-900 text-slate-300'}>
                          {drive.isActive ? 'Active' : 'Closed'}
                        </Badge>
                      </div>
                      <h2 className="text-xl font-bold text-white">{drive.title}</h2>
                      <p className="text-slate-400 text-sm leading-relaxed max-w-3xl">{drive.description}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2 text-xs text-slate-500 font-medium">
                        <span>
                          Hosted by: <strong className="text-slate-400">{drive.recruiterName}</strong> ({drive.recruiterCompany})
                        </span>
                        <span>•</span>
                        <span>
                          Date: <strong className="text-slate-400">{new Date(drive.scheduledAt).toLocaleString('en-IN')}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Min. Innovation Score: <strong className="text-slate-400">{drive.minimumInnovationScore}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Participants: <strong className="text-slate-400">{drive.registeredStudents.length}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-stretch gap-3 sm:min-w-44">
                      {joined ? (
                        <div className="space-y-2">
                          <Button disabled className="w-full">
                            Registered
                          </Button>
                          {typeof myRegistration?.submissionScore === 'number' ? (
                            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-2.5 text-xs text-emerald-400 text-center font-bold font-mono">
                              Score: {myRegistration.submissionScore}
                            </div>
                          ) : (
                            <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-xs text-slate-400 text-center font-medium">
                              Assessment Pending
                            </div>
                          )}
                        </div>
                      ) : !drive.isActive || !isUpcoming ? (
                        <Button disabled>Closed</Button>
                      ) : !meetsRequirements ? (
                        <div className="space-y-2">
                          <Button disabled className="opacity-50">
                            Locked
                          </Button>
                          <div className="text-rose-400 text-xs font-semibold text-center leading-normal">
                            Requires innovation score of {drive.minimumInnovationScore} (You have {userInnovationScore})
                          </div>
                        </div>
                      ) : (
                        <Button
                          onClick={() => registerDriveMutation.mutate(drive._id)}
                          disabled={registerDriveMutation.isPending}
                        >
                          {registerDriveMutation.isPending && registerDriveMutation.variables === drive._id
                            ? 'Registering...'
                            : 'Register Now'}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
