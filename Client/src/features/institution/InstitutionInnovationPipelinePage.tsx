import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Award,
  Boxes,
  CalendarDays,
  FolderKanban,
  Gauge,
  Layers3,
  Rocket,
  TrendingUp,
  UserRound,
  Users2,
} from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { OptionTabs } from '../../components/ui/OptionTabs';
import type {
  InstitutionPatent,
  InstitutionStartup,
  RecentProject,
} from '../../types/school.types';
import { getStudentPortfolioViewPath } from '../marketplace/navigation';
import { InstitutionWorkspaceHeader } from './InstitutionWorkspaceHeader';

type InnovationSection = 'projects' | 'patents' | 'startups';

type Props = {
  mode: 'school' | 'college';
  institutionLabel: 'School' | 'College';
  basePath: string;
  fetchProjects: () => Promise<RecentProject[]>;
  fetchPatents: () => Promise<InstitutionPatent[]>;
  fetchStartups: () => Promise<InstitutionStartup[]>;
};

const PIPELINE_TABS = [
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'patents', label: 'Patents', icon: Award },
  { id: 'startups', label: 'Startups', icon: Rocket },
] as const;

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const patentTone = (status: string) => {
  switch (status) {
    case 'approved':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    case 'under_review':
      return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300';
    case 'rejected':
      return 'border-red-500/30 bg-red-500/10 text-red-300';
    default:
      return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  }
};

const formatStatusLabel = (value?: string | null) =>
  (value ?? 'draft').replace(/_/g, ' ');

const getActiveSection = (pathname: string): InnovationSection => {
  if (pathname.includes('/patents')) {
    return 'patents';
  }

  if (pathname.includes('/startups')) {
    return 'startups';
  }

  return 'projects';
};

export function InstitutionInnovationPipelinePage({
  mode,
  institutionLabel,
  basePath,
  fetchProjects,
  fetchPatents,
  fetchStartups,
}: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams<{
    projectId?: string;
    patentId?: string;
    startupId?: string;
  }>();

  const activeSection = getActiveSection(location.pathname);

  const projectsQuery = useQuery({
    queryKey: ['institution-projects', mode],
    queryFn: fetchProjects,
    enabled: activeSection === 'projects',
  });
  const patentsQuery = useQuery({
    queryKey: ['institution-patents', mode],
    queryFn: fetchPatents,
    enabled: activeSection === 'patents',
  });
  const startupsQuery = useQuery({
    queryKey: ['institution-startups', mode],
    queryFn: fetchStartups,
    enabled: activeSection === 'startups',
  });

  const projects = projectsQuery.data ?? [];
  const patents = patentsQuery.data ?? [];
  const startups = startupsQuery.data ?? [];

  const selectedProject = useMemo(
    () => projects.find((project) => project._id === params.projectId) ?? projects[0],
    [params.projectId, projects],
  );
  const selectedPatent = useMemo(
    () => patents.find((patent) => patent._id === params.patentId) ?? patents[0],
    [params.patentId, patents],
  );
  const selectedStartup = useMemo(
    () => startups.find((startup) => startup._id === params.startupId) ?? startups[0],
    [params.startupId, startups],
  );

  const averageProjectProgress =
    projects.length > 0
      ? Math.round(
          projects.reduce((sum, project) => sum + project.progressPercent, 0) /
            projects.length,
        )
      : 0;

  const approvedPatentCount = patents.filter(
    (patent) => patent.status === 'approved',
  ).length;
  const launchedStartupCount = startups.filter((startup) =>
    Boolean(startup.launchedAt),
  ).length;

  const sectionPathMap: Record<InnovationSection, string> = {
    projects: `${basePath}/projects`,
    patents: `${basePath}/patents`,
    startups: `${basePath}/startups`,
  };

  const activeLoading =
    activeSection === 'projects'
      ? projectsQuery.isLoading
      : activeSection === 'patents'
        ? patentsQuery.isLoading
        : startupsQuery.isLoading;

  return (
    <div className="space-y-6">
      <InstitutionWorkspaceHeader
        mode={mode}
        eyebrow="Student Workspace"
        title="Innovation Pipeline"
        description={`Projects track build execution, patents capture protected IP, and startups represent commercialization. Keep them in one ${institutionLabel.toLowerCase()} workspace, but preserve their different lifecycle signals.`}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="p-5">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
            <FolderKanban className="h-5 w-5" />
          </div>
          <div className="text-lg font-semibold text-white">Projects</div>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Working student execution: active build stage, owner, category, and progress.
          </p>
        </Card>
        <Card className="p-5">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
            <Award className="h-5 w-5" />
          </div>
          <div className="text-lg font-semibold text-white">Patents</div>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Formal IP filings derived from innovation work, with submission and review status.
          </p>
        </Card>
        <Card className="p-5">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-300">
            <Rocket className="h-5 w-5" />
          </div>
          <div className="text-lg font-semibold text-white">Startups</div>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Commercialization entities created from validated work, with founders, team, and launch status.
          </p>
        </Card>
      </div>

      <Card className="p-2">
        <OptionTabs
          items={PIPELINE_TABS}
          activeId={activeSection}
          onChange={(section) => navigate(sectionPathMap[section])}
          aria-label="Innovation pipeline sections"
        />
      </Card>

      {activeSection === 'projects' ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Active Projects
              </div>
              <div className="mt-2 text-2xl font-bold text-white">
                {projects.length}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Avg Progress
              </div>
              <div className="mt-2 text-2xl font-bold text-white">
                {averageProjectProgress}%
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Latest Update
              </div>
              <div className="mt-2 text-2xl font-bold text-white">
                {projects[0] ? formatDate(projects[0].updatedAt) : '-'}
              </div>
            </Card>
          </div>

          {activeLoading ? (
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
                    <Badge className="border-slate-700 bg-slate-900 text-slate-300">
                      {selectedProject.category}
                    </Badge>
                  </div>
                  <h2 className="text-2xl font-semibold text-white">
                    {selectedProject.title}
                  </h2>
                  <p className="mt-2 text-slate-400">
                    Owned by {selectedProject.studentName}. Projects represent the live execution layer of the innovation pipeline.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() =>
                    navigate(getStudentPortfolioViewPath(selectedProject.studentId))
                  }
                >
                  View Student Journey
                </Button>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-4">
                {[
                  {
                    label: 'Student Owner',
                    value: selectedProject.studentName,
                    Icon: UserRound,
                  },
                  {
                    label: 'Category',
                    value: selectedProject.category,
                    Icon: Layers3,
                  },
                  {
                    label: 'Stage',
                    value: selectedProject.stage,
                    Icon: FolderKanban,
                  },
                  {
                    label: 'Progress',
                    value: `${selectedProject.progressPercent}%`,
                    Icon: Gauge,
                  },
                ].map(({ label, value, Icon }) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4"
                  >
                    <Icon className="h-5 w-5 text-cyan-300" />
                    <div className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-500">
                      {label}
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-slate-400">Progress</span>
                  <span className="font-semibold text-white">
                    {selectedProject.progressPercent}%
                  </span>
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
                  project._id === selectedProject?._id
                    ? 'border-cyan-500/40'
                    : ''
                }`}
                onClick={() => navigate(`${basePath}/projects/${project._id}`)}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-semibold text-white">
                        {project.title}
                      </h3>
                      <Badge>{project.stage}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-400">
                      <span>{project.studentName}</span>
                      <span>{project.category}</span>
                      <span>Updated {formatDate(project.updatedAt)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-white">
                      {project.progressPercent}%
                    </div>
                    <div className="text-sm text-slate-500">Progress</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {!activeLoading && projects.length === 0 ? (
            <Card className="p-6 text-sm text-slate-400">
              No active institution projects are available yet.
            </Card>
          ) : null}
        </>
      ) : null}

      {activeSection === 'patents' ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Patent Records
              </div>
              <div className="mt-2 text-2xl font-bold text-white">
                {patents.length}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Approved
              </div>
              <div className="mt-2 text-2xl font-bold text-white">
                {approvedPatentCount}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Latest Submission
              </div>
              <div className="mt-2 text-2xl font-bold text-white">
                {patents[0] ? formatDate(patents[0].submittedAt) : '-'}
              </div>
            </Card>
          </div>

          {activeLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : null}

          {selectedPatent ? (
            <Card className="p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Badge className={patentTone(selectedPatent.status)}>
                      {selectedPatent.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <h2 className="text-2xl font-semibold text-white">
                    {selectedPatent.projectTitle}
                  </h2>
                  <p className="mt-2 text-slate-400">
                    Patent activity filed by {selectedPatent.studentName}. Patents represent protected IP moving beyond raw execution.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() =>
                    navigate(getStudentPortfolioViewPath(selectedPatent.studentId))
                  }
                >
                  View Student Journey
                </Button>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {[
                  {
                    label: 'Student',
                    value: selectedPatent.studentName,
                    Icon: UserRound,
                  },
                  {
                    label: 'Status',
                    value: selectedPatent.status.replace(/_/g, ' '),
                    Icon: Award,
                  },
                  {
                    label: 'Submitted',
                    value: formatDate(selectedPatent.submittedAt),
                    Icon: CalendarDays,
                  },
                ].map(({ label, value, Icon }) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4"
                  >
                    <Icon className="h-5 w-5 text-cyan-300" />
                    <div className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-500">
                      {label}
                    </div>
                    <div className="mt-2 text-lg font-semibold capitalize text-white">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          <div className="grid gap-4">
            {patents.map((patent) => (
              <Card
                key={patent._id}
                className={`cursor-pointer p-5 transition-colors hover:border-slate-700 ${
                  patent._id === selectedPatent?._id
                    ? 'border-cyan-500/40'
                    : ''
                }`}
                onClick={() => navigate(`${basePath}/patents/${patent._id}`)}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-semibold text-white">
                        {patent.projectTitle}
                      </h3>
                      <Badge className={patentTone(patent.status)}>
                        {patent.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <div className="mt-2 text-sm text-slate-400">
                      {patent.studentName} | Submitted {formatDate(patent.submittedAt)}
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={(event) => {
                      event.stopPropagation();
                      navigate(getStudentPortfolioViewPath(patent.studentId));
                    }}
                  >
                    View Student
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {!activeLoading && patents.length === 0 ? (
            <Card className="p-6 text-sm text-slate-400">
              No patent records are available for this institution yet.
            </Card>
          ) : null}
        </>
      ) : null}

      {activeSection === 'startups' ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Startup Records
              </div>
              <div className="mt-2 text-2xl font-bold text-white">
                {startups.length}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Launched
              </div>
              <div className="mt-2 text-2xl font-bold text-white">
                {launchedStartupCount}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Latest Update
              </div>
              <div className="mt-2 text-2xl font-bold text-white">
                {startups[0] ? formatDate(startups[0].updatedAt) : '-'}
              </div>
            </Card>
          </div>

          {activeLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : null}

          {selectedStartup ? (
            <Card className="p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{selectedStartup.stage}</Badge>
                <Badge className="border-slate-700 bg-slate-900 text-slate-300">
                  {selectedStartup.category}
                </Badge>
                <Badge className="border-violet-500/30 bg-violet-500/10 text-violet-300">
                  {formatStatusLabel(selectedStartup.reviewStatus)}
                </Badge>
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                {selectedStartup.name}
              </h2>
              <p className="mt-2 text-slate-400">{selectedStartup.tagline}</p>

              <div className="mt-6 grid gap-4 md:grid-cols-4">
                {[
                  {
                    label: 'Founders',
                    value:
                      selectedStartup.founderNames.join(', ') || 'Not mapped',
                    Icon: Users2,
                  },
                  {
                    label: 'Active Products',
                    value: String(selectedStartup.activeProducts),
                    Icon: Boxes,
                  },
                  {
                    label: 'Team Size',
                    value: String(selectedStartup.teamSize),
                    Icon: Users2,
                  },
                  {
                    label: 'Launched',
                    value: selectedStartup.launchedAt
                      ? formatDate(selectedStartup.launchedAt)
                      : 'Not launched',
                    Icon: TrendingUp,
                  },
                ].map(({ label, value, Icon }) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4"
                  >
                    <Icon className="h-5 w-5 text-cyan-300" />
                    <div className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-500">
                      {label}
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          <div className="grid gap-4">
            {startups.map((startup) => (
              <Card
                key={startup._id}
                className={`cursor-pointer p-5 transition-colors hover:border-slate-700 ${
                  startup._id === selectedStartup?._id
                    ? 'border-cyan-500/40'
                    : ''
                }`}
                onClick={() => navigate(`${basePath}/startups/${startup._id}`)}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-semibold text-white">
                        {startup.name}
                      </h3>
                      <Badge>{startup.stage}</Badge>
                    </div>
                    <div className="mt-2 text-sm text-slate-400">
                      {startup.tagline}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                      <span>
                        {startup.founderNames.join(', ') || 'No founders mapped'}
                      </span>
                      <span>{startup.activeProducts} active products</span>
                      <span>{startup.teamSize} team members</span>
                      <span>Updated {formatDate(startup.updatedAt)}</span>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-slate-300">
                    {formatStatusLabel(startup.reviewStatus)}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {!activeLoading && startups.length === 0 ? (
            <Card className="p-6 text-sm text-slate-400">
              No startup records are available for this institution yet.
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
