import { Building2, CalendarClock, UserCheck } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { MentorshipProgramPanel } from './MentorshipProgramPanel';
import {
  CreateInstitutionMentorshipProgramInput,
  InstitutionMentorshipProgramView,
} from '../../types/mentorship.types';

type InstitutionMentorshipPageProps = {
  queryKey: string;
  institutionLabel: 'School' | 'College';
  description: string;
  fetchPrograms: () => Promise<InstitutionMentorshipProgramView>;
  createProgram: (payload: CreateInstitutionMentorshipProgramInput) => Promise<unknown>;
};

export function InstitutionMentorshipPage({
  queryKey,
  institutionLabel,
  description,
  fetchPrograms,
  createProgram,
}: InstitutionMentorshipPageProps) {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 text-xs uppercase tracking-[0.3em] text-cyan-300">{institutionLabel} Workspace</div>
        <h1 className="text-3xl font-bold text-white">Mentorship Requests</h1>
        <p className="mt-2 max-w-3xl text-slate-400">{description}</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {[
          {
            title: 'Submit Request',
            body: `${institutionLabel} submits the mentorship program request with preferred timing, format, and outcomes.`,
            icon: Building2,
          },
          {
            title: 'Admin Approval',
            body: 'Admin reviews the request, confirms logistics, and approves only when the session is ready to schedule.',
            icon: UserCheck,
          },
          {
            title: 'Conflict-Free Assignment',
            body: 'A mentor is assigned only if they are available for the requested time window without overlap.',
            icon: CalendarClock,
          },
        ].map((item) => (
          <Card key={item.title} className="p-5">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900">
              <item.icon className="h-6 w-6 text-cyan-300" />
            </div>
            <div className="text-lg font-semibold text-white">{item.title}</div>
            <p className="mt-2 text-sm leading-6 text-slate-400">{item.body}</p>
          </Card>
        ))}
      </div>

      <MentorshipProgramPanel
        queryKey={queryKey}
        heading={`${institutionLabel} mentorship requests`}
        description={`Track pending approvals, assigned mentors, and reviewed requests for your ${institutionLabel.toLowerCase()}.`}
        fetchPrograms={fetchPrograms}
        createProgram={createProgram}
      />
    </div>
  );
}
