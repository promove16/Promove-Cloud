import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, Mail, ShieldCheck, Search, Sparkles } from 'lucide-react';
import { recruiterApi } from '../../api/recruiter.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { StudentProfileDrawer } from './StudentProfileDrawer';

const scoreMarks = [0, 50, 100, 150, 200];

export default function TalentSearch() {
  const [search, setSearch] = useState('');
  const [domain, setDomain] = useState('');
  const [institution, setInstitution] = useState('');
  const [minScore, setMinScore] = useState(0);
  const [maxScore, setMaxScore] = useState(200);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const params = useMemo(
    () => ({
      domain: domain || undefined,
      institution: institution || undefined,
      search: search || undefined,
      minScore,
      maxScore,
      page: 1,
      limit: 24,
    }),
    [domain, institution, maxScore, minScore, search],
  );

  const pipelineQuery = useQuery({
    queryKey: ['recruiter', 'talent', 'pipeline', params],
    queryFn: () => recruiterApi.getTalentPipeline(params),
    refetchInterval: 60_000,
  });

  const discoverQuery = useQuery({
    queryKey: ['recruiter', 'talent', 'discover', params],
    queryFn: () => recruiterApi.discoverTalent(params),
    refetchInterval: 60_000,
  });

  const pipelineStudents = pipelineQuery.data?.items ?? [];
  const discoverStudents = discoverQuery.data?.items ?? [];

  const handleShortlist = async (studentId: string) => {
    await recruiterApi.shortlistStudent(studentId);
    await pipelineQuery.refetch();
    await discoverQuery.refetch();
  };

  const renderStudentCard = (
    student: typeof pipelineStudents[number],
    kind: 'pipeline' | 'discover',
  ) => (
    <Card key={student._id} className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-500 text-lg font-bold text-white">
            {student.avatar ? (
              <img src={student.avatar} alt={student.displayName} className="h-14 w-14 rounded-2xl object-cover" />
            ) : (
              student.displayName.slice(0, 1).toUpperCase()
            )}
          </div>
          <div>
            <div className="text-xl font-semibold text-white">{student.displayName}</div>
            <div className="mt-1 text-sm text-slate-400">
              {student.institution?.name ?? 'Independent'} - {student.activeProject?.title ?? 'No active workspace'}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {student.skills.slice(0, 4).map((skill) => (
                <Badge key={skill} className="border-slate-700 bg-slate-900 text-slate-300">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">{student.innovationScore}</div>
          <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Score</div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Button onClick={() => setSelectedStudentId(student._id)}>
          <Eye className="mr-2 h-4 w-4" />
          View Profile
        </Button>
        {kind === 'discover' && !student.canContact ? (
          <Button data-testid="shortlist-btn" variant="secondary" onClick={() => handleShortlist(student._id)}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            Shortlist to Connect
          </Button>
        ) : null}
        {student.canContact && (
          <Button
            data-testid="message-btn"
            variant="secondary"
            onClick={() => recruiterApi.sendMessage(student._id, 'Thanks for connecting on ProMove.')}
          >
            <Mail className="mr-2 h-4 w-4" />
            Message
          </Button>
        )}
      </div>

      <div className="mt-4 h-2 rounded-full bg-slate-800">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
          style={{ width: `${Math.min((student.innovationScore / 200) * 100, 100)}%` }}
        />
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-cyan-300">
            <Sparkles className="h-4 w-4" />
            Talent Search
          </div>
          <h1 className="text-3xl font-bold text-white">Find the right students faster</h1>
          <p className="mt-2 text-slate-400">
            Pipeline students are contactable. Discover students stay visible, but not contactable, until a bridge exists.
          </p>
        </div>
        <Badge>{pipelineStudents.length + discoverStudents.length} visible students</Badge>
      </div>

      <Card className="p-5">
        <div className="grid gap-4 lg:grid-cols-4">
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.25em] text-slate-500">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-11" placeholder="Name or keyword" />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.25em] text-slate-500">Domain</label>
            <Input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="AgriTech, AI, HealthTech" />
          </div>
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.25em] text-slate-500">Institution</label>
            <Input value={institution} onChange={(event) => setInstitution(event.target.value)} placeholder="IIT Delhi, BITS Pilani" />
          </div>
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.25em] text-slate-500">Score Range</label>
            <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-300">
              {minScore} - {maxScore}
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.25em] text-slate-500">Minimum Score</label>
            <input
              type="range"
              min={0}
              max={200}
              step={1}
              value={minScore}
              onChange={(event) => setMinScore(Math.min(Number(event.target.value), maxScore))}
              className="w-full"
            />
            <div className="mt-2 flex justify-between text-xs text-slate-500">
              {scoreMarks.map((mark) => (
                <span key={mark}>{mark}</span>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.25em] text-slate-500">Maximum Score</label>
            <input
              type="range"
              min={0}
              max={200}
              step={1}
              value={maxScore}
              onChange={(event) => setMaxScore(Math.max(Number(event.target.value), minScore))}
              className="w-full"
            />
          </div>
        </div>
      </Card>

      <div className="grid gap-6">
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">My Pipeline</div>
              <h2 className="mt-2 text-xl font-semibold text-white">Students you can contact now</h2>
            </div>
            <Badge>{pipelineStudents.length}</Badge>
          </div>
          {pipelineQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {pipelineStudents.map((student) => renderStudentCard(student, 'pipeline'))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Discover</div>
              <h2 className="mt-2 text-xl font-semibold text-white">Broader search with contact gating</h2>
            </div>
            <Badge>{discoverStudents.length}</Badge>
          </div>
          {discoverQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {discoverStudents.map((student) => renderStudentCard(student, 'discover'))}
            </div>
          )}
        </section>
      </div>

      <StudentProfileDrawer
        studentId={selectedStudentId}
        open={Boolean(selectedStudentId)}
        onClose={() => setSelectedStudentId(null)}
        onChanged={() => {
          pipelineQuery.refetch();
          discoverQuery.refetch();
        }}
      />
    </div>
  );
}
