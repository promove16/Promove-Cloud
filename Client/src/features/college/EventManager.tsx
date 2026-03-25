import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { collegeApi } from '../../api/college.api';
import { eventApi } from '../../api/event.api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';

const eventTypes = [
  'Industry Connect Session',
  'Placement Hackathon',
  'Innovation Drive',
  'Other',
] as const;

export default function EventManager() {
  const queryClient = useQueryClient();
  type EventFormState = {
    title: string;
    type: (typeof eventTypes)[number];
    date: string;
    description: string;
  };
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<EventFormState>({
    title: '',
    type: eventTypes[0],
    date: '',
    description: '',
  });

  const eventsQuery = useQuery({
    queryKey: ['college-events'],
    queryFn: collegeApi.listEvents,
  });

  const createMutation = useMutation({
    mutationFn: collegeApi.createEvent,
    onSuccess: async () => {
      setForm({ title: '', type: eventTypes[0], date: '', description: '' });
      setShowCreate(false);
      await queryClient.invalidateQueries({ queryKey: ['college-events'] });
    },
  });

  const computeMutation = useMutation({
    mutationFn: eventApi.computeRankings,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['college-events'] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Events</h1>
          <p className="mt-2 text-slate-400">Create and track institution events</p>
        </div>
        <Button onClick={() => setShowCreate((value) => !value)}>+ Create Event</Button>
      </div>

      {showCreate ? (
        <Card className="p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Event title"
            />
            <select
              value={form.type}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  type: event.target.value as (typeof eventTypes)[number],
                }))
              }
              className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
            >
              {eventTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <Input
              type="datetime-local"
              value={form.date}
              onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
            />
            <div />
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Describe the event"
              className="min-h-32 rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white md:col-span-2"
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={() =>
                createMutation.mutate({
                  ...form,
                  date: new Date(form.date).toISOString(),
                  targetRoles: ['student'],
                })
              }
              disabled={createMutation.isPending || !form.title || !form.date || !form.description}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Event'}
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="space-y-4">
        {(eventsQuery.data ?? []).map((event) => (
          <Card key={event._id} className="p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-cyan-300">
                  <CalendarDays className="h-4 w-4" />
                  {event.type}
                </div>
                <h2 className="text-2xl font-semibold text-white">{event.title}</h2>
                <p className="mt-3 max-w-3xl text-slate-400">{event.description}</p>
                <div className="mt-4 text-sm text-slate-500">
                  {new Date(event.scheduledAt).toLocaleString('en-IN')} • {event.participantsCount} participants
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => computeMutation.mutate(event._id)}>
                  Compute Rankings
                </Button>
                <Button variant="secondary" title="Submission scores are added from the event API">
                  Add Submission Score
                </Button>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
                Event Rankings
              </div>
              <div className="mb-4 text-sm text-slate-400">
                Composite = (Submission × 60%) + (Innovation Score × 40%)
              </div>
              <div className="space-y-3">
                {event.rankings.length === 0 ? (
                  <div className="text-sm text-slate-500">
                    Rankings will appear here after computation.
                  </div>
                ) : (
                  event.rankings.map((ranking) => (
                    <div
                      key={`${event._id}-${ranking.studentId}`}
                      className="grid grid-cols-[80px,1fr,140px,140px,140px] gap-4 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4"
                    >
                      <div className="font-semibold text-white">{ranking.rank}</div>
                      <div className="font-semibold text-white">{ranking.studentName}</div>
                      <div className="text-slate-300">{ranking.compositeScore}</div>
                      <div className="text-slate-400">{ranking.innovationScore}</div>
                      <div className="text-slate-400">{ranking.submissionScore}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
