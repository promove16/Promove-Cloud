import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FolderKanban, Gauge, Layers3, UserRound } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import type { RecentProject } from '../../types/school.types';

type Props = {
  mode: 'school' | 'college';
  title: string;
  subtitle: string;
  basePath: string;
  fetchProjects: () => Promise<RecentProject[]>;
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

export function InstitutionProjectsPageBase({
  mode,
  title,
  subtitle,
  basePath,
  fetchProjects,
}: Props) {
  const navigate = useNavigate();
  const params = useParams<{ projectId?: string }>();
  const selectedProjectId = params.projectId;

  const projectsQuery = useQuery({
    queryKey: ['institution-projects', mode],
    queryFn: fetchProjects,
  });

  const projects = projectsQuery.data ?? [];
  const selectedProject = useMemo(
    () => projects.find((project) => project._id === selectedProjectId) ?? projects[0],
    [projects, selectedProjectId],
  );

  const averageProgress =
    projects.length > 0
      ? Math.round(projects.reduce((sum, project) => sum + project.progressPercent, 0) / projects.length)
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Projects</div>
          <h1 className="mt-2 text-3xl font-bold text-white">{title}</h1>
          <p className="mt-2 text-slate-400">{subtitle}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Active Projects</div>
            <div className="mt-2 text-2xl font-bold text-white">{projects.length}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Avg Progress</div>
            <div className="mt-2 text-2xl font-bold text-white">{averageProgress}%</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Latest Update</div>
            <div className="mt-2 text-2xl font-bold text-white">
              {projects[0] ? formatDate(projects[0].updatedAt) : '-'}
            </div>
          </Card>
        </div>
      </div>

      {projectsQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : null}

      {selectedProject ? (
        <Card className="p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge>{selectedProject.stage}</Badge>
                <Badge className="border-slate-700 bg-slate-900 text-slate-300">{selectedProject.category}</Badge>
              </div>
              <h2 className="text-2xl font-semibold text-white">{selectedProject.title}</h2>
              <p className="mt-2 text-slate-400">
                Owned by {selectedProject.studentName}. This child page keeps project metadata and progress visible
                outside the dashboard summary card.
              </p>
            </div>
            <Button variant="secondary" onClick={() => navigate(`${basePath}/students/${selectedProject.studentId}`)}>
              View Student Journey
            </Button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            {[
              { label: 'Student Owner', value: selectedProject.studentName, Icon: UserRound },
              { label: 'Category', value: selectedProject.category, Icon: Layers3 },
              { label: 'Stage', value: selectedProject.stage, Icon: FolderKanban },
              { label: 'Progress', value: `${selectedProject.progressPercent}%`, Icon: Gauge },
            ].map(({ label, value, Icon }) => (
              <div key={label} className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <Icon className="h-5 w-5 text-cyan-300" />
                <div className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-500">{label}</div>
                <div className="mt-2 text-lg font-semibold text-white">{value}</div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-slate-400">Progress</span>
              <span className="font-semibold text-white">{selectedProject.progressPercent}%</span>
            </div>
            <div className="h-3 rounded-full bg-slate-800">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500"
                style={{ width: `${selectedProject.progressPercent}%` }}
              />
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4">
        {projects.map((project) => (
          <Card
            key={project._id}
            className={`cursor-pointer p-5 transition-colors hover:border-slate-700 ${
              project._id === selectedProject?._id ? 'border-cyan-500/40' : ''
            }`}
            onClick={() => navigate(`${basePath}/projects/${project._id}`)}
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-semibold text-white">{project.title}</h3>
                  <Badge>{project.stage}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-400">
                  <span>{project.studentName}</span>
                  <span>{project.category}</span>
                  <span>Updated {formatDate(project.updatedAt)}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-white">{project.progressPercent}%</div>
                <div className="text-sm text-slate-500">Progress</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {!projectsQuery.isLoading && projects.length === 0 ? (
        <Card className="p-6 text-sm text-slate-400">No active institution projects are available yet.</Card>
      ) : null}
    </div>
  );
}
