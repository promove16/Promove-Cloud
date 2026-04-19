import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Users } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import type { DashboardEvent } from '../../types/school.types';
import { InstitutionWorkspaceHeader } from './InstitutionWorkspaceHeader';

type Props = {
  mode: 'school' | 'college';
  title: string;
  subtitle: string;
  basePath: string;
  fetchEvents: () => Promise<DashboardEvent[]>;
};

const formatDate = (value: string) =>
  new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

export function InstitutionEventsPageBase({
  mode,
  title,
  subtitle,
  basePath,
  fetchEvents,
}: Props) {
  const navigate = useNavigate();
  const params = useParams<{ eventId?: string }>();
  const selectedEventId = params.eventId;

  const eventsQuery = useQuery({
    queryKey: ['institution-events', mode],
    queryFn: fetchEvents,
  });

  const events = eventsQuery.data ?? [];
  const selectedEvent = useMemo(
    () => events.find((event) => event._id === selectedEventId) ?? events[0],
    [events, selectedEventId],
  );

  return (
    <div className="space-y-6">
      <InstitutionWorkspaceHeader
        mode={mode}
        eyebrow="Events"
        title={title}
        description={subtitle}
        tabsAction={
          <Button variant="secondary" onClick={() => navigate(basePath)}>
            Back to Overview
          </Button>
        }
      />

      {eventsQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : null}

      {selectedEvent ? (
        <Card className="p-6">
          <div className="mb-2 flex items-center gap-2">
            <Badge>{selectedEvent.type}</Badge>
          </div>
          <h2 className="text-2xl font-semibold text-white">{selectedEvent.title}</h2>
          <p className="mt-3 text-slate-400">{selectedEvent.description}</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <CalendarDays className="h-5 w-5 text-cyan-300" />
              <div className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-500">Scheduled At</div>
              <div className="mt-2 text-lg font-semibold text-white">{formatDate(selectedEvent.scheduledAt)}</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <Users className="h-5 w-5 text-cyan-300" />
              <div className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-500">Participants</div>
              <div className="mt-2 text-lg font-semibold text-white">{selectedEvent.participantsCount}</div>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4">
        {events.map((event) => (
          <Card
            key={event._id}
            className={`cursor-pointer p-5 transition-colors hover:border-slate-700 ${
              event._id === selectedEvent?._id ? 'border-cyan-500/40' : ''
            }`}
            onClick={() => navigate(`${basePath}/events/${event._id}`)}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-semibold text-white">{event.title}</h3>
                  <Badge>{event.type}</Badge>
                </div>
                <div className="mt-2 text-sm text-slate-400">{event.description}</div>
              </div>
              <div className="text-right text-sm text-slate-500">
                <div>{formatDate(event.scheduledAt)}</div>
                <div className="mt-1">{event.participantsCount} participants</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {!eventsQuery.isLoading && events.length === 0 ? (
        <Card className="p-6 text-sm text-slate-400">No upcoming institution events are available yet.</Card>
      ) : null}
    </div>
  );
}
