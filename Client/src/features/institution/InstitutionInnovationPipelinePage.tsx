import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  Award,
  Boxes,
  CalendarDays,
  ChevronRight,
  CircleDot,
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
import { Spinner } from '../../components/ui/Spinner';
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

const SECTION_META: Record<
  InnovationSection,
  {
    title: string;
    itemLabel: string;
    accentClassName: string;
    icon: typeof FolderKanban;
  }
> = {
  projects: {
    title: 'Projects',
    itemLabel: 'Project',
    accentClassName: 'border-cyan-500/40 bg-cyan-500/12 text-cyan-200',
    icon: FolderKanban,
  },
  patents: {
    title: 'Patents',
    itemLabel: 'Patent',
    accentClassName: 'border-emerald-500/40 bg-emerald-500/12 text-emerald-200',
    icon: Award,
  },
  startups: {
    title: 'Startups',
    itemLabel: 'Startup',
    accentClassName: 'border-amber-500/40 bg-amber-500/12 text-amber-200',
    icon: Rocket,
  },
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

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

const sortByDateDesc = <T,>(items: T[], getDate: (item: T) => string) =>
  [...items].sort(
    (left, right) =>
      new Date(getDate(right)).getTime() - new Date(getDate(left)).getTime(),
  );

const patentTone = (status: string) => {
  switch (status) {
    case 'approved':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    case 'under_review':
      return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300';
    case 'rejected':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-300';
    default:
      return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  }
};

const startupTone = (status?: string | null) => {
  switch (status) {
    case 'approved':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    case 'changes_requested':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
    default:
      return 'border-slate-700 bg-slate-900 text-slate-300';
  }
};

const getLatestVisibleDate = (values: string[]) => {
  if (values.length === 0) {
    return '-';
  }

  return formatDate(
    [...values].sort(
      (left, right) => new Date(right).getTime() - new Date(left).getTime(),
    )[0],
  );
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
  const activeMeta = SECTION_META[activeSection];

  const projectsQuery = useQuery({
    queryKey: ['institution-projects', mode],
    queryFn: fetchProjects,
  });
  const patentsQuery = useQuery({
    queryKey: ['institution-patents', mode],
    queryFn: fetchPatents,
  });
  const startupsQuery = useQuery({
    queryKey: ['institution-startups', mode],
    queryFn: fetchStartups,
  });

  const projects = useMemo(
    () => sortByDateDesc(projectsQuery.data ?? [], (project) => project.updatedAt),
    [projectsQuery.data],
  );
  const patents = useMemo(
    () => sortByDateDesc(patentsQuery.data ?? [], (patent) => patent.submittedAt),
    [patentsQuery.data],
  );
  const startups = useMemo(
    () => sortByDateDesc(startupsQuery.data ?? [], (startup) => startup.updatedAt),
    [startupsQuery.data],
  );

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

  const sectionPathMap: Record<InnovationSection, string> = {
    projects: `${basePath}/projects`,
    patents: `${basePath}/patents`,
    startups: `${basePath}/startups`,
  };

  const sectionCountMap: Record<InnovationSection, number> = {
    projects: projects.length,
    patents: patents.length,
    startups: startups.length,
  };

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
  const underReviewPatentCount = patents.filter(
    (patent) => patent.status === 'under_review',
  ).length;
  const launchedStartupCount = startups.filter((startup) =>
    Boolean(startup.launchedAt),
  ).length;
  const reviewStartupCount = startups.filter(
    (startup) => startup.reviewStatus !== 'approved',
  ).length;

  const heroMetrics = [
    {
      label: 'Projects',
      value: projects.length,
      helper:
        projects.length > 0
          ? `${averageProjectProgress}% avg progress`
          : 'No records',
    },
    {
      label: 'Patents',
      value: patents.length,
      helper:
        patents.length > 0
          ? `${approvedPatentCount} approved`
          : 'No records',
    },
    {
      label: 'Startups',
      value: startups.length,
      helper:
        startups.length > 0
          ? `${launchedStartupCount} launched`
          : 'No records',
    },
  ];

  const activeItemCount =
    activeSection === 'projects'
      ? projects.length
      : activeSection === 'patents'
        ? patents.length
        : startups.length;

  const activeLatestDate =
    activeSection === 'projects'
      ? getLatestVisibleDate(projects.map((project) => project.updatedAt))
      : activeSection === 'patents'
        ? getLatestVisibleDate(patents.map((patent) => patent.submittedAt))
        : getLatestVisibleDate(startups.map((startup) => startup.updatedAt));

  const activeSnapshotValue =
    activeSection === 'projects'
      ? `${averageProjectProgress}% avg progress`
      : activeSection === 'patents'
        ? `${underReviewPatentCount} under review`
        : `${reviewStartupCount} in review`;

  const activeLoading =
    activeSection === 'projects'
      ? projectsQuery.isLoading
      : activeSection === 'patents'
        ? patentsQuery.isLoading
        : startupsQuery.isLoading;

  const renderProjectList = () =>
    projects.length === 0 ? (
      <div className="flex min-h-[260px] items-center justify-center text-sm text-slate-500">
        No active institution projects are available yet.
      </div>
    ) : (
      <div className="space-y-2">
        {projects.map((project) => {
          const isActive = project._id === selectedProject?._id;

          return (
            <button
              key={project._id}
              type="button"
              onClick={() => navigate(`${basePath}/projects/${project._id}`)}
              className={`group w-full border-b border-l-2 px-4 py-4 text-left transition ${
                isActive
                  ? 'border-b-cyan-500/20 border-l-cyan-400 bg-cyan-500/8'
                  : 'border-b-slate-800 border-l-transparent hover:border-b-slate-700 hover:border-l-slate-600 hover:bg-slate-950'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate text-base font-semibold text-white">
                      {project.title}
                    </div>
                    <Badge>{project.stage}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-400">
                    <span>{project.studentName}</span>
                    <span>{project.category}</span>
                  </div>
                </div>
                <ChevronRight
                  className={`h-4 w-4 shrink-0 transition ${
                    isActive
                      ? 'translate-x-1 text-cyan-300'
                      : 'text-slate-600 group-hover:translate-x-1 group-hover:text-slate-300'
                  }`}
                />
              </div>
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-500">
                  <span>Progress</span>
                  <span className="text-slate-300">{project.progressPercent}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-900">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-cyan-400 via-cyan-300 to-sky-400"
                    style={{ width: `${project.progressPercent}%` }}
                  />
                </div>
                <div className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-600">
                  Updated {formatDate(project.updatedAt)}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );

  const renderPatentList = () =>
    patents.length === 0 ? (
      <div className="flex min-h-[260px] items-center justify-center text-sm text-slate-500">
        No patent records are available for this institution yet.
      </div>
    ) : (
      <div className="space-y-2">
        {patents.map((patent) => {
          const isActive = patent._id === selectedPatent?._id;

          return (
            <button
              key={patent._id}
              type="button"
              onClick={() => navigate(`${basePath}/patents/${patent._id}`)}
              className={`group w-full border-b border-l-2 px-4 py-4 text-left transition ${
                isActive
                  ? 'border-b-emerald-500/20 border-l-emerald-400 bg-emerald-500/8'
                  : 'border-b-slate-800 border-l-transparent hover:border-b-slate-700 hover:border-l-slate-600 hover:bg-slate-950'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-white">
                    {patent.projectTitle}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge className={patentTone(patent.status)}>
                      {formatStatusLabel(patent.status)}
                    </Badge>
                  </div>
                  <div className="mt-3 text-sm text-slate-400">
                    {patent.studentName}
                  </div>
                </div>
                <ChevronRight
                  className={`h-4 w-4 shrink-0 transition ${
                    isActive
                      ? 'translate-x-1 text-emerald-300'
                      : 'text-slate-600 group-hover:translate-x-1 group-hover:text-slate-300'
                  }`}
                />
              </div>
              <div className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-600">
                Submitted {formatDate(patent.submittedAt)}
              </div>
            </button>
          );
        })}
      </div>
    );

  const renderStartupList = () =>
    startups.length === 0 ? (
      <div className="flex min-h-[260px] items-center justify-center text-sm text-slate-500">
        No startup records are available for this institution yet.
      </div>
    ) : (
      <div className="space-y-2">
        {startups.map((startup) => {
          const isActive = startup._id === selectedStartup?._id;

          return (
            <button
              key={startup._id}
              type="button"
              onClick={() => navigate(`${basePath}/startups/${startup._id}`)}
              className={`group w-full border-b border-l-2 px-4 py-4 text-left transition ${
                isActive
                  ? 'border-b-amber-500/20 border-l-amber-400 bg-amber-500/8'
                  : 'border-b-slate-800 border-l-transparent hover:border-b-slate-700 hover:border-l-slate-600 hover:bg-slate-950'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate text-base font-semibold text-white">
                      {startup.name}
                    </div>
                    <Badge>{startup.stage}</Badge>
                  </div>
                  <div className="mt-2 line-clamp-2 text-sm text-slate-400">
                    {startup.tagline}
                  </div>
                </div>
                <ChevronRight
                  className={`h-4 w-4 shrink-0 transition ${
                    isActive
                      ? 'translate-x-1 text-amber-300'
                      : 'text-slate-600 group-hover:translate-x-1 group-hover:text-slate-300'
                  }`}
                />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-600">
                <span>{startup.activeProducts} products</span>
                <span>{startup.teamSize} team</span>
                <span>Updated {formatDate(startup.updatedAt)}</span>
              </div>
            </button>
          );
        })}
      </div>
    );

  const renderProjectDetail = () =>
    selectedProject ? (
      <div className="space-y-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{selectedProject.stage}</Badge>
              <Badge className="border-slate-700 bg-slate-900 text-slate-300">
                {selectedProject.category}
              </Badge>
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white">
              {selectedProject.title}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              Project owned by {selectedProject.studentName}. Review progress, stage, and
              category here.
            </p>
          </div>
          <Button
            variant="outline"
            className="border-cyan-400/50 bg-cyan-500/10 text-cyan-50 hover:border-cyan-300 hover:bg-cyan-500/18"
            onClick={() =>
              navigate(getStudentPortfolioViewPath(selectedProject.studentId))
            }
          >
            View Student Journey
          </Button>
        </div>

        <div className="grid gap-4 border-t border-slate-800 pt-6 md:grid-cols-4">
          {[
            {
              label: 'Owner',
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
              className="border-b border-slate-800 pb-4"
            >
              <Icon className="h-5 w-5 text-cyan-300" />
              <div className="mt-4 text-[11px] uppercase tracking-[0.28em] text-slate-500">
                {label}
              </div>
              <div className="mt-2 text-lg font-semibold text-white">{value}</div>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-800 pt-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
                Delivery Momentum
              </div>
              <div className="mt-2 text-xl font-semibold text-white">
                {selectedProject.progressPercent}% completion signal
              </div>
            </div>
            <div className="text-sm text-slate-400">
              Updated {formatDate(selectedProject.updatedAt)}
            </div>
          </div>
          <div className="mt-5 h-3 rounded-full bg-slate-900">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-violet-400"
              style={{ width: `${selectedProject.progressPercent}%` }}
            />
          </div>
        </div>
      </div>
    ) : (
      <div className="flex min-h-[360px] items-center justify-center text-sm text-slate-500">
        No project is selected yet.
      </div>
    );

  const renderPatentDetail = () =>
    selectedPatent ? (
      <div className="space-y-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={patentTone(selectedPatent.status)}>
                {formatStatusLabel(selectedPatent.status)}
              </Badge>
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white">
              {selectedPatent.projectTitle}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              Patent submitted by {selectedPatent.studentName}. Review filing status and
              submission details here.
            </p>
          </div>
          <Button
            variant="outline"
            className="border-emerald-400/50 bg-emerald-500/10 text-emerald-50 hover:border-emerald-300 hover:bg-emerald-500/18"
            onClick={() =>
              navigate(getStudentPortfolioViewPath(selectedPatent.studentId))
            }
          >
            View Student Journey
          </Button>
        </div>

        <div className="grid gap-4 border-t border-slate-800 pt-6 md:grid-cols-3">
          {[
            {
              label: 'Inventor',
              value: selectedPatent.studentName,
              Icon: UserRound,
            },
            {
              label: 'Review Status',
              value: formatStatusLabel(selectedPatent.status),
              Icon: Award,
            },
            {
              label: 'Filed On',
              value: formatDate(selectedPatent.submittedAt),
              Icon: CalendarDays,
            },
          ].map(({ label, value, Icon }) => (
            <div
              key={label}
              className="border-b border-slate-800 pb-4"
            >
              <Icon className="h-5 w-5 text-emerald-300" />
              <div className="mt-4 text-[11px] uppercase tracking-[0.28em] text-slate-500">
                {label}
              </div>
              <div className="mt-2 text-lg font-semibold capitalize text-white">
                {value}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-800 pt-6">
          <div className="flex items-center gap-3">
            <CircleDot className="h-4 w-4 text-emerald-300" />
            <div className="text-sm text-slate-300">
              Patent signal entered the protection lane on {formatDate(selectedPatent.submittedAt)}.
            </div>
          </div>
        </div>
      </div>
    ) : (
      <div className="flex min-h-[360px] items-center justify-center text-sm text-slate-500">
        No patent record is selected yet.
      </div>
    );

  const renderStartupDetail = () =>
    selectedStartup ? (
      <div className="space-y-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{selectedStartup.stage}</Badge>
              <Badge className="border-slate-700 bg-slate-900 text-slate-300">
                {selectedStartup.category}
              </Badge>
              <Badge className={startupTone(selectedStartup.reviewStatus)}>
                {formatStatusLabel(selectedStartup.reviewStatus)}
              </Badge>
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white">
              {selectedStartup.name}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              Startup record for {institutionLabel.toLowerCase()} innovators. Review founders,
              team, products, and launch status here.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-slate-300">
            <TrendingUp className="h-4 w-4 text-amber-300" />
            {selectedStartup.launchedAt
              ? `Launched ${formatDate(selectedStartup.launchedAt)}`
              : 'Launch pending'}
          </div>
        </div>

        <div className="grid gap-4 border-t border-slate-800 pt-6 md:grid-cols-4">
          {[
            {
              label: 'Founders',
              value: selectedStartup.founderNames.join(', ') || 'Not mapped',
              Icon: Users2,
            },
            {
              label: 'Products',
              value: String(selectedStartup.activeProducts),
              Icon: Boxes,
            },
            {
              label: 'Team Size',
              value: String(selectedStartup.teamSize),
              Icon: Users2,
            },
            {
              label: 'Last Update',
              value: formatDate(selectedStartup.updatedAt),
              Icon: CalendarDays,
            },
          ].map(({ label, value, Icon }) => (
            <div
              key={label}
              className="border-b border-slate-800 pb-4"
            >
              <Icon className="h-5 w-5 text-amber-300" />
              <div className="mt-4 text-[11px] uppercase tracking-[0.28em] text-slate-500">
                {label}
              </div>
              <div className="mt-2 text-lg font-semibold text-white">{value}</div>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-800 pt-6">
          <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
            Venture Signal
          </div>
          <div className="mt-3 text-xl font-semibold text-white">
            {selectedStartup.tagline}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {selectedStartup.founderNames.length > 0 ? (
              selectedStartup.founderNames.map((founder) => (
                <span
                  key={founder}
                  className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-sm text-slate-300"
                >
                  {founder}
                </span>
              ))
            ) : (
              <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-sm text-slate-500">
                Founder mapping pending
              </span>
            )}
          </div>
        </div>
      </div>
    ) : (
      <div className="flex min-h-[360px] items-center justify-center text-sm text-slate-500">
        No startup is selected yet.
      </div>
    );

  return (
    <div className="space-y-8">
      <InstitutionWorkspaceHeader
        mode={mode}
        eyebrow="Student Workspace"
        title="Innovation Pipeline"
        description={`Track projects, patents, and startups for your ${institutionLabel.toLowerCase()} in one place.`}
      />

      <section className="border-b border-slate-800 pb-8">
        <div className="flex flex-col gap-6">
          <div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-cyan-300">
              Overview
            </div>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-white md:text-4xl">
              Review student innovation records without switching pages.
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
              Pick a tab, select a record from the list, and inspect the details on the right.
            </p>
          </div>

          <div className="grid gap-4 border-t border-slate-800 pt-6 sm:grid-cols-2 xl:grid-cols-4">
            {heroMetrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4"
              >
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  {metric.label}
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">{metric.value}</div>
                <div className="mt-1 text-sm text-slate-400">{metric.helper}</div>
              </div>
            ))}
            <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                Last Updated
              </div>
              <div className="mt-2 text-2xl font-semibold text-white">{activeLatestDate}</div>
              <div className="mt-1 text-sm text-slate-400">{activeSnapshotValue}</div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3 border-t border-slate-800 pt-6">
          {PIPELINE_TABS.map((tab) => {
            const isActive = tab.id === activeSection;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => navigate(sectionPathMap[tab.id])}
                className={`group flex min-w-[190px] flex-1 items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition ${
                  isActive
                    ? `${SECTION_META[tab.id].accentClassName} shadow-[0_0_0_1px_rgba(255,255,255,0.03)]`
                    : 'border-slate-700 bg-slate-950 text-slate-200 hover:border-slate-500 hover:bg-slate-900'
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`rounded-xl border p-2 ${
                      isActive
                        ? SECTION_META[tab.id].accentClassName
                        : 'border-slate-700 bg-slate-900 text-slate-400'
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{tab.label}</div>
                    <div
                      className={`mt-1 text-xs ${
                        isActive ? 'text-inherit/80' : 'text-slate-500'
                      }`}
                    >
                      {sectionCountMap[tab.id]} records
                    </div>
                  </div>
                </div>
                <div
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    isActive
                      ? 'border-current/30 bg-black/10'
                      : 'border-slate-700 text-slate-400'
                  }`}
                >
                  {tab.label}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.92fr,1.35fr]">
        <section className="min-w-0 xl:border-r xl:border-slate-800 xl:pr-8">
          <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
                {activeMeta.title}
              </div>
              <div className="mt-2 text-2xl font-semibold text-white">
                All {activeMeta.title.toLowerCase()}
              </div>
            </div>
            <div
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${activeMeta.accentClassName}`}
            >
              {activeItemCount} records
            </div>
          </div>

          <div className="mt-5">
            {activeLoading ? (
              <div className="flex min-h-[260px] items-center justify-center">
                <Spinner />
              </div>
            ) : activeSection === 'projects' ? (
              renderProjectList()
            ) : activeSection === 'patents' ? (
              renderPatentList()
            ) : (
              renderStartupList()
            )}
          </div>
        </section>

        <section className="min-w-0 xl:pl-4">
          <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
                Selected {activeMeta.itemLabel}
              </div>
              <div className="mt-2 text-2xl font-semibold text-white">
                {activeSection === 'projects'
                  ? selectedProject?.title ?? 'No project selected'
                  : activeSection === 'patents'
                    ? selectedPatent?.projectTitle ?? 'No patent selected'
                    : selectedStartup?.name ?? 'No startup selected'}
              </div>
            </div>
            <div className="hidden items-center gap-2 text-sm text-slate-500 lg:inline-flex">
              <ArrowUpRight className="h-4 w-4" />
              Details
            </div>
          </div>

          <div className="mt-6">
            {activeLoading ? (
              <div className="flex min-h-[360px] items-center justify-center">
                <Spinner />
              </div>
            ) : activeSection === 'projects' ? (
              renderProjectDetail()
            ) : activeSection === 'patents' ? (
              renderPatentDetail()
            ) : (
              renderStartupDetail()
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
