import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, Eye, Sparkles } from 'lucide-react';
import { recruiterApi } from '../../api/recruiter.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { getStudentPortfolioViewPath } from '../marketplace/navigation';

export default function CollegeConnect() {
  const navigate = useNavigate();
  const [institution, setInstitution] = useState('');

  const collegesQuery = useQuery({
    queryKey: ['recruiter', 'colleges'],
    queryFn: recruiterApi.getColleges,
  });

  const studentsQuery = useQuery({
    queryKey: ['recruiter', 'college-students', institution],
    queryFn: () =>
      recruiterApi.getTalentPipeline({
        institution: institution || undefined,
        page: 1,
        limit: 24,
      }),
    enabled: Boolean(institution),
  });

  const colleges = useMemo(() => collegesQuery.data ?? [], [collegesQuery.data]);

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-cyan-300">
          <Sparkles className="h-4 w-4" />
          College Connect
        </div>
        <h1 className="text-3xl font-bold text-white">Partner institutions with strong innovation pipelines</h1>
        <p className="mt-2 text-slate-400">Use the cards below to focus your search on schools and colleges.</p>
      </div>

      {collegesQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {colleges.map((college) => (
            <Card key={college._id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-xl font-semibold text-white">{college.displayName}</div>
                    <div className="mt-1 text-sm text-slate-400">{college.location}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge className="border-slate-700 bg-slate-900 text-slate-300">
                        {college.focusLabel}
                      </Badge>
                      <Badge className="border-slate-700 bg-slate-900 text-slate-300">
                        {college.iicStarRating.toFixed(1)} IIC
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 text-right">
                  <div>
                    <div className="text-2xl font-bold text-white">{college.studentCount}</div>
                    <div className="text-xs text-slate-500">Students</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{college.placementVelocity}%</div>
                    <div className="text-xs text-slate-500">Placement velocity</div>
                  </div>
                </div>
              </div>
              <div className="mt-5 flex justify-end">
                <Button variant="secondary" onClick={() => setInstitution(college.displayName)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Students
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {institution ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Students in focus</div>
              <h2 className="mt-2 text-xl font-semibold text-white">{institution}</h2>
            </div>
            <Button variant="secondary" onClick={() => setInstitution('')}>
              Clear
            </Button>
          </div>
          {studentsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : (
            (studentsQuery.data?.items?.length ?? 0) === 0 ? (
              <Card className="p-6 text-sm text-slate-400">
                No bridged students are currently available for this institution.
              </Card>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {(studentsQuery.data?.items ?? []).map((student) => (
                  <Card key={student._id} className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-500 text-white">
                          {student.avatar ? (
                            <img src={student.avatar} alt={student.displayName} className="h-12 w-12 rounded-2xl object-cover" />
                          ) : (
                            student.displayName.slice(0, 1).toUpperCase()
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-white">{student.displayName}</div>
                          <div className="mt-1 text-sm text-slate-400">
                            {student.institution?.name ?? institution} - {student.activeProject?.title ?? 'No active workspace'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-white">{student.innovationScore}</div>
                        <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Score</div>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Button onClick={() => navigate(getStudentPortfolioViewPath(student._id))}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Profile
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )
          )}
        </div>
      ) : null}

    </div>
  );
}
