import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Sparkles, Trophy, Users } from 'lucide-react';
import { eventApi } from '../../api/event.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuthStore } from '../../store/authStore';

const badgeClassFor = (category?: 'internal' | 'hiring') =>
  category === 'hiring'
    ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
    : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300';

export default function StudentEventsPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  const eventsQuery = useQuery({
    queryKey: ['student', 'events'],
    queryFn: eventApi.listMyInstitutionEvents,
  });

  const joinMutation = useMutation({
    mutationFn: eventApi.joinEvent,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['student', 'events'] });
    },
  });

  const events = eventsQuery.data ?? [];
  const institutionName = user?.institutionProfile?.institutionName ?? 'your institution';
  const currentUserId = user?._id ?? null;

  const stats = useMemo(() => {
    const hiring = events.filter((event) => event.category === 'hiring').length;
    const upcoming = events.filter((event) => new Date(event.scheduledAt).getTime() >= Date.now()).length;
    return {
      total: events.length,
      hiring,
      upcoming,
    };
  }, [events]);

  return (
    <div className="space-y-6">
      <header className="border-b border-slate-800 pb-4">
        <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-cyan-300">
          <Sparkles className="h-4 w-4" />
          Events
        </div>
        <h1 className="text-2xl font-semibold text-white">My events</h1>
        <p className="mt-1 text-sm text-slate-400">
          Explore internal and hiring events available only for {institutionName}.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-cyan-300" />
            <div>
              <div className="text-2xl font-semibold text-white">{stats.total}</div>
              <div className="text-sm text-slate-400">Total events</div>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <Trophy className="h-5 w-5 text-amber-300" />
            <div>
              <div className="text-2xl font-semibold text-white">{stats.hiring}</div>
              <div className="text-sm text-slate-400">Hiring events</div>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-emerald-300" />
            <div>
              <div className="text-2xl font-semibold text-white">{stats.upcoming}</div>
              <div className="text-sm text-slate-400">Upcoming</div>
            </div>
          </div>
        </Card>
      </section>

      {eventsQuery.isLoading ? <Card className="p-6 text-sm text-slate-400">Loading events...</Card> : null}

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
            <Card key={event._id} className="p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.28em] text-slate-400">
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
                  <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-500">
                    <span>{new Date(event.scheduledAt).toLocaleString('en-IN')}</span>
                    <span>{event.participantsCount} participants</span>
                    {event.recruiterName ? <span>Hosted by {event.recruiterName}</span> : null}
                    {typeof event.minimumInnovationScore === 'number' && event.category === 'hiring' ? (
                      <span>Minimum score {event.minimumInnovationScore}</span>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col items-stretch gap-3 sm:min-w-44">
                  <Button
                    onClick={() => joinMutation.mutate(event._id)}
                    disabled={joined || joinMutation.isPending}
                  >
                    {joined ? 'Already Registered' : joinMutation.isPending && joinMutation.variables === event._id ? 'Registering...' : 'Register'}
                  </Button>
                  {event.rankings.length > 0 ? (
                    <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-300">
                      Rankings published
                    </div>
                  ) : null}
                </div>
              </div>

              {event.rankings.length > 0 ? (
                <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <div className="mb-3 text-xs uppercase tracking-[0.28em] text-cyan-300">Leaderboard Snapshot</div>
                  <div className="space-y-2">
                    {event.rankings.slice(0, 3).map((ranking) => (
                      <div
                        key={`${event._id}-${ranking.studentId}`}
                        className="flex items-center justify-between rounded-xl border border-slate-800 px-4 py-3 text-sm"
                      >
                        <div className="font-medium text-white">
                          #{ranking.rank} {ranking.studentName}
                        </div>
                        <div className="text-slate-400">Composite {ranking.compositeScore}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
