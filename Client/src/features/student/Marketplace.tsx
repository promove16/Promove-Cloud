import { startTransition, useDeferredValue, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../app/components/DashboardLayout';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  BriefcaseBusiness,
  ChevronDown,
  ChevronUp,
  Clock3,
  Code2,
  Compass,
  ExternalLink,
  Eye,
  FolderKanban,
  GitFork,
  Github,
  Globe,
  GraduationCap,
  Linkedin,
  MapPin,
  MessageCircle,
  Search,
  Sparkles,
  Star,
  Users,
  X,
} from 'lucide-react';
import { marketplaceApi, MarketplaceProfile, MarketplaceRole } from '../../api/marketplace.api';
import { recruiterApi } from '../../api/recruiter.api';
import type { RecruiterJobView } from '../../types/recruiter.types';
import { UserRole } from '../../types/roles.types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';

const tabs: Array<{
  id: MarketplaceRole;
  label: string;
  eyebrow: string;
  description: string;
  accent: string;
  icon: typeof Compass;
}> = [
  {
    id: 'mentor',
    label: 'Mentors',
    eyebrow: 'Mentors',
    description: 'Find operators and advisors who can unblock decisions on product, execution, and launch.',
    accent: 'from-cyan-400/20 via-cyan-400/5 to-transparent',
    icon: Compass,
  },
  {
    id: 'investor',
    label: 'Investor',
    eyebrow: 'Investor',
    description: 'Review investors by sector fit, public proof, and startup readiness signals before outreach.',
    accent: 'from-emerald-400/20 via-emerald-400/5 to-transparent',
    icon: Building2,
  },
  {
    id: 'recruiter',
    label: 'Recruiters',
    eyebrow: 'Recruiters',
    description: 'Browse recruiters with live opportunities and move into applications or direct messages quickly.',
    accent: 'from-amber-400/20 via-amber-400/5 to-transparent',
    icon: BriefcaseBusiness,
  },
];

const roleCopy: Record<MarketplaceRole, string> = {
  student: 'Discover student builders through public proof, project work, and active startup participation.',
  school: 'Discover schools coordinating student innovation, mentorship programs, and institutional support.',
  college: 'Discover colleges coordinating student innovation, hiring events, and institutional support.',
  mentor: 'Discover mentors with real public context across skills, experience highlights, and project work.',
  investor: 'Review investors with clearer sector fit, public links, and richer readiness signals before you connect.',
  recruiter: 'Browse recruiters with live jobs, fuller public profiles, and one-click applications from the same workspace.',
};

type RecruiterBrowseMode = 'jobs' | 'recruiters';
type JobPostedWindow = 'any' | '7d' | '30d';
type JobSortBy = 'recommended' | 'recent' | 'score' | 'applicants';

type MarketplaceRecruiterJob = RecruiterJobView & {
  recruiterName: string;
  recruiterAvatar?: string;
  recruiterHeadline?: string;
  recruiterLocation?: string;
};

const formatCompactNumber = (value: number) =>
  new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

const formatMonthYear = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
  });
};

const formatDateRange = (startDate?: string, endDate?: string | null, isCurrent?: boolean) => {
  const start = formatMonthYear(startDate);
  const end = isCurrent ? 'Present' : formatMonthYear(endDate) ?? 'Recent';

  if (start && end) {
    return `${start} - ${end}`;
  }

  return start ?? end ?? null;
};

const getMarketplaceSearchText = (profile: MarketplaceProfile) =>
  [
    profile.displayName,
    profile.role,
    profile.domain,
    profile.headline,
    profile.location,
    profile.bio,
    ...(profile.skills ?? []).map((skill) => `${skill.name} ${skill.level}`),
    ...(profile.experienceHighlights ?? []).map((experience) =>
      [experience.title, experience.company, experience.location, experience.description, ...experience.skills].join(' '),
    ),
    ...(profile.educationHighlights ?? []).map((education) =>
      [education.institution, education.degree, education.fieldOfStudy, education.grade].join(' '),
    ),
    ...(profile.portfolioHighlights ?? []).map((project) =>
      [project.title, project.description, ...project.techStack, ...project.languages].join(' '),
    ),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const getRecruiterJobSearchText = (job: MarketplaceRecruiterJob) =>
  [
    job.title,
    job.company,
    job.domain,
    job.location,
    job.type,
    job.description,
    job.recruiterName,
    job.recruiterHeadline,
    `innovation score ${job.minimumInnovationScore}`,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const formatRelativeDate = (value?: string) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const diff = Date.now() - date.getTime();
  const day = 1000 * 60 * 60 * 24;

  if (diff < day) {
    return 'Posted today';
  }

  const days = Math.floor(diff / day);

  if (days < 7) {
    return `Posted ${days} day${days === 1 ? '' : 's'} ago`;
  }

  const weeks = Math.floor(days / 7);

  if (weeks < 5) {
    return `Posted ${weeks} week${weeks === 1 ? '' : 's'} ago`;
  }

  return `Posted ${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
};

const getJobDescriptionHighlights = (description: string) =>
  description
    .split(/[\n.]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3);

const getInsightCounts = (profile: MarketplaceProfile) => ({
  skills: profile.insightCounts?.skills ?? profile.skills?.length ?? 0,
  experience: profile.insightCounts?.experience ?? profile.experienceHighlights?.length ?? 0,
  education: profile.insightCounts?.education ?? profile.educationHighlights?.length ?? 0,
  portfolioProjects:
    profile.insightCounts?.portfolioProjects ?? profile.portfolioHighlights?.length ?? 0,
});

function ProfileAvatar({
  profile,
  size = 'large',
}: {
  profile: MarketplaceProfile;
  size?: 'compact' | 'small' | 'large';
}) {
  const containerClassName =
    size === 'compact'
      ? 'h-12 w-12 rounded-xl text-base'
      : size === 'small'
        ? 'h-14 w-14 rounded-2xl text-lg'
        : 'h-16 w-16 rounded-3xl text-xl';

  return (
    <div
      className={`flex items-center justify-center bg-gradient-to-br from-cyan-500 to-emerald-500 font-bold text-white ${containerClassName}`}
    >
      {profile.avatar ? (
        <img
          src={profile.avatar}
          alt={profile.displayName}
          className={`object-cover ${containerClassName}`}
        />
      ) : (
        profile.displayName.slice(0, 1).toUpperCase()
      )}
    </div>
  );
}

function ProfileSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-cyan-300">
        {icon}
        <span>{title}</span>
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

function ProfileLinkChips({
  profile,
  tone = 'dark',
}: {
  profile: MarketplaceProfile;
  tone?: 'dark' | 'light';
}) {
  const linkItems = [
    profile.links?.websiteUrl
      ? { href: profile.links.websiteUrl, label: 'Website', icon: <Globe className="h-4 w-4" /> }
      : null,
    profile.links?.githubUrl
      ? { href: profile.links.githubUrl, label: 'GitHub', icon: <Github className="h-4 w-4" /> }
      : null,
    profile.links?.linkedinUrl
      ? { href: profile.links.linkedinUrl, label: 'LinkedIn', icon: <Linkedin className="h-4 w-4" /> }
      : null,
  ].filter(Boolean) as Array<{ href: string; label: string; icon: ReactNode }>;

  if (linkItems.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {linkItems.map((link) => (
        <a
          key={link.label}
          href={link.href}
          target="_blank"
          rel="noreferrer"
          className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium transition ${
            tone === 'light'
              ? 'border border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:text-slate-950'
              : 'border border-slate-700 bg-slate-900/70 text-slate-200 hover:border-cyan-500/40 hover:text-white'
          }`}
        >
          {link.icon}
          <span>{link.label}</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ))}
    </div>
  );
}

function MarketplaceProfileDrawer({
  profileId,
  open,
  onClose,
}: {
  profileId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const profileQuery = useQuery({
    queryKey: ['marketplace', 'profile', profileId],
    queryFn: () => marketplaceApi.getProfile(profileId!),
    enabled: open && Boolean(profileId),
  });
  const profile = profileQuery.data;
  const counts = profile ? getInsightCounts(profile) : null;

  const getQueryType = (role: string) => {
    switch (role) {
      case 'mentor': return 'project_mentor';
      case 'investor': return 'investor';
      case 'recruiter': return 'recruiter';
      default: return 'general';
    }
  };

  const handleMessage = () => {
    if (profile) {
      const storageKey = `dm_first_contact_${profile._id}`;
      if (!localStorage.getItem(storageKey)) {
        localStorage.setItem(storageKey, 'true');
      }
      navigate(`/dashboard/messages/${profile._id}?queryType=${getQueryType(profile.role)}`);
      onClose();
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 backdrop-blur-sm">
      <button type="button" aria-label="Close profile" className="flex-1" onClick={onClose} />
      <aside className="h-full w-full max-w-2xl overflow-y-auto border-l border-slate-800 bg-slate-950 px-6 py-6 shadow-2xl shadow-black/40">
        {profileQuery.isLoading || !profile || !counts ? (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <ProfileAvatar profile={profile} />
                <div>
                  <div className="text-xs uppercase tracking-[0.25em] text-cyan-300">Marketplace Profile</div>
                  <h2 className="mt-2 text-2xl font-bold text-white">{profile.displayName}</h2>
                  <div className="mt-2 text-sm capitalize text-slate-400">{profile.role}</div>
                  {profile.headline ? (
                    <p className="mt-3 max-w-xl text-sm text-slate-300">{profile.headline}</p>
                  ) : null}
                  {profile.location ? (
                    <div className="mt-3 inline-flex items-center gap-2 text-sm text-slate-400">
                      <MapPin className="h-4 w-4 text-cyan-300" />
                      <span>{profile.location}</span>
                    </div>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-800 p-2 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex gap-3">
              <Button onClick={handleMessage} className="flex-1">
                <MessageCircle className="mr-2 h-4 w-4" />
                Message
              </Button>
              <Button variant="secondary" onClick={onClose} className="flex-1">
                Close
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <Card className="p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Skills</div>
                <div className="mt-3 text-2xl font-semibold text-white">{counts.skills}</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Experience</div>
                <div className="mt-3 text-2xl font-semibold text-white">{counts.experience}</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Education</div>
                <div className="mt-3 text-2xl font-semibold text-white">{counts.education}</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Projects</div>
                <div className="mt-3 text-2xl font-semibold text-white">{counts.portfolioProjects}</div>
              </Card>
            </div>

            <ProfileSection title="Overview" icon={<Sparkles className="h-4 w-4" />}>
              <div className="space-y-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Domain</div>
                  <div className="mt-2 text-lg font-semibold text-white">
                    {profile.domain ?? 'General innovation support'}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">About</div>
                  <p className="mt-2 leading-7 text-slate-300">
                    {profile.bio ??
                      'This member has not added a public bio yet, but their profile is active in the marketplace.'}
                  </p>
                </div>
                <ProfileLinkChips profile={profile} />
              </div>
            </ProfileSection>

            {(profile.skills ?? []).length > 0 ? (
              <ProfileSection title="Skills" icon={<Code2 className="h-4 w-4" />}>
                <div className="flex flex-wrap gap-2">
                  {profile.skills?.map((skill) => (
                    <span
                      key={`${skill.name}-${skill.level}`}
                      className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-sm text-cyan-100"
                    >
                      {skill.name}
                      <span className="ml-2 text-xs uppercase tracking-[0.18em] text-cyan-300">{skill.level}</span>
                    </span>
                  ))}
                </div>
              </ProfileSection>
            ) : null}

            {(profile.experienceHighlights ?? []).length > 0 ? (
              <ProfileSection title="Experience Highlights" icon={<BriefcaseBusiness className="h-4 w-4" />}>
                <div className="space-y-3">
                  {profile.experienceHighlights?.map((experience) => (
                    <div
                      key={`${experience.title}-${experience.company}`}
                      className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="text-base font-semibold text-white">{experience.title}</div>
                          <div className="mt-1 text-sm text-cyan-300">{experience.company}</div>
                        </div>
                        <div className="text-sm text-slate-400">
                          {formatDateRange(experience.startDate, experience.endDate, experience.isCurrent)}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-400">
                        <span className="capitalize">{experience.type.replace(/_/g, ' ')}</span>
                        {experience.location ? <span>{experience.location}</span> : null}
                      </div>
                      {experience.description ? (
                        <p className="mt-3 text-sm leading-6 text-slate-300">{experience.description}</p>
                      ) : null}
                      {experience.skills.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {experience.skills.map((skill) => (
                            <span
                              key={`${experience.title}-${skill}`}
                              className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-200"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </ProfileSection>
            ) : null}

            {(profile.educationHighlights ?? []).length > 0 ? (
              <ProfileSection title="Education" icon={<GraduationCap className="h-4 w-4" />}>
                <div className="space-y-3">
                  {profile.educationHighlights?.map((education) => (
                    <div
                      key={`${education.institution}-${education.degree ?? ''}`}
                      className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
                    >
                      <div className="text-base font-semibold text-white">{education.institution}</div>
                      <div className="mt-1 text-sm text-cyan-300">
                        {[education.degree, education.fieldOfStudy].filter(Boolean).join(' in ') || 'Academic profile'}
                      </div>
                      <div className="mt-2 text-sm text-slate-400">
                        {education.startYear ?? 'Start'} - {education.isCurrent ? 'Present' : education.endYear ?? 'Recent'}
                      </div>
                      {education.grade ? <div className="mt-2 text-sm text-slate-300">Grade: {education.grade}</div> : null}
                    </div>
                  ))}
                </div>
              </ProfileSection>
            ) : null}

            {(profile.portfolioHighlights ?? []).length > 0 ? (
              <ProfileSection title="Projects" icon={<FolderKanban className="h-4 w-4" />}>
                <div className="space-y-3">
                  {profile.portfolioHighlights?.map((project) => (
                    <div key={project.title} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="text-base font-semibold text-white">{project.title}</div>
                          {project.description ? (
                            <p className="mt-2 text-sm leading-6 text-slate-300">{project.description}</p>
                          ) : null}
                        </div>
                        <div className="flex gap-2">
                          {project.liveUrl ? (
                            <a
                              href={project.liveUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:text-white"
                            >
                              <Globe className="h-4 w-4" />
                              Live
                            </a>
                          ) : null}
                          {project.repoUrl ? (
                            <a
                              href={project.repoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:text-white"
                            >
                              <Github className="h-4 w-4" />
                              Repo
                            </a>
                          ) : null}
                        </div>
                      </div>
                      {project.techStack.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {project.techStack.map((tech) => (
                            <span
                              key={`${project.title}-${tech}`}
                              className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-200"
                            >
                              {tech}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-400">
                        <span className="inline-flex items-center gap-1.5">
                          <Star className="h-4 w-4 text-cyan-300" />
                          {project.stars} stars
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <GitFork className="h-4 w-4 text-cyan-300" />
                          {project.forks} forks
                        </span>
                        {project.languages.length > 0 ? <span>{project.languages.join(', ')}</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </ProfileSection>
            ) : null}

            {profile.githubStats ? (
              <ProfileSection title="GitHub Footprint" icon={<Github className="h-4 w-4" />}>
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Repos</div>
                    <div className="mt-2 text-xl font-semibold text-white">{profile.githubStats.totalRepos}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Stars</div>
                    <div className="mt-2 text-xl font-semibold text-white">{profile.githubStats.totalStars}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Forks</div>
                    <div className="mt-2 text-xl font-semibold text-white">{profile.githubStats.totalForks}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">1Y Contributions</div>
                    <div className="mt-2 text-xl font-semibold text-white">{profile.githubStats.contributionsLastYear}</div>
                  </div>
                </div>
                {profile.githubStats.topLanguages.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {profile.githubStats.topLanguages.map((language) => (
                      <span
                        key={language.language}
                        className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-sm text-cyan-100"
                      >
                        {language.language}
                        <span className="ml-2 text-xs text-cyan-300">{language.percentage}%</span>
                      </span>
                    ))}
                  </div>
                ) : null}
              </ProfileSection>
            ) : null}
          </div>
        )}
      </aside>
    </div>
  );
}

function RecruiterJobCard({
  recruiterId,
  recruiterName,
  onApplyFeedback,
}: {
  recruiterId: string;
  recruiterName: string;
  onApplyFeedback: (tone: 'success' | 'error', message: string) => void;
}) {
  const [appliedJobIds, setAppliedJobIds] = useState<string[]>([]);
  const [pendingJobIds, setPendingJobIds] = useState<string[]>([]);
  const jobsQuery = useQuery({
    queryKey: ['marketplace', 'recruiter-jobs', recruiterId],
    queryFn: () => recruiterApi.getPublicJobs(recruiterId),
    enabled: Boolean(recruiterId),
  });

  const applyToJob = async (jobId: string) => {
    if (appliedJobIds.includes(jobId) || pendingJobIds.includes(jobId)) {
      return;
    }

    setPendingJobIds((current) => [...current, jobId]);

    try {
      await recruiterApi.applyToJob(jobId);
      setAppliedJobIds((current) => (current.includes(jobId) ? current : [...current, jobId]));
      await jobsQuery.refetch();
      onApplyFeedback('success', 'Applied! The recruiter can now contact you.');
    } catch {
      onApplyFeedback('error', 'Unable to apply to this job right now.');
    } finally {
      setPendingJobIds((current) => current.filter((id) => id !== jobId));
    }
  };

  if (jobsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3 border-t border-slate-800/80 pt-4">
      <div className="text-xs uppercase tracking-[0.25em] text-cyan-300">Open Job Posts</div>
      {(jobsQuery.data ?? []).length > 0 ? (
        (jobsQuery.data ?? []).map((job) => {
          const hasApplied = Boolean(job.hasApplied) || appliedJobIds.includes(job._id);
          const isPending = pendingJobIds.includes(job._id);

          return (
            <div key={job._id} className="border-b border-slate-800/80 py-4 last:border-b-0">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="font-semibold text-white">{job.title}</div>
                  <div className="mt-1 text-sm text-slate-400">
                    {job.company} - {job.location} - {job.type}
                  </div>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{job.description}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => applyToJob(job._id)}
                    disabled={hasApplied || isPending}
                    className={
                      hasApplied
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:border-emerald-500/40 hover:text-emerald-200'
                        : 'border-slate-700 bg-transparent text-slate-200 hover:border-slate-500 hover:bg-slate-900/40'
                    }
                  >
                    {isPending ? 'Applying...' : hasApplied ? 'Applied' : 'Apply'}
                  </Button>
                </div>
              </div>
            </div>
          );
        })
      ) : (
        <div className="text-sm text-slate-400">{recruiterName} has no active openings right now.</div>
      )}
    </div>
  );
}

function MarketplaceRecruiterJobCard({
  job,
  recruiterProfileId,
  onOpenRecruiter,
  onOpenDetails,
  onMessageRecruiter,
  onApplyFeedback,
}: {
  job: MarketplaceRecruiterJob;
  recruiterProfileId: string;
  onOpenRecruiter: (profileId: string) => void;
  onOpenDetails: (jobId: string) => void;
  onMessageRecruiter: (profileId: string) => void;
  onApplyFeedback: (tone: 'success' | 'error', message: string) => void;
}) {
  const [hasApplied, setHasApplied] = useState(Boolean(job.hasApplied));
  const [isPending, setIsPending] = useState(false);
  const postedLabel = formatRelativeDate(job.createdAt);
  const expiresLabel = formatMonthYear(job.expiresAt);
  const descriptionHighlights = getJobDescriptionHighlights(job.description);

  const handleApply = async () => {
    if (hasApplied || isPending) {
      return;
    }

    setIsPending(true);

    try {
      await recruiterApi.applyToJob(job._id);
      setHasApplied(true);
      onApplyFeedback('success', 'Applied! The recruiter can now contact you.');
    } catch {
      onApplyFeedback('error', 'Unable to apply to this job right now.');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <article className="border-b border-slate-800/80 py-6 last:border-b-0">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 xl:flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.24em] text-cyan-300">
              <span>{job.type}</span>
              <span className="text-slate-600">|</span>
              <span>{job.domain}</span>
              {postedLabel ? (
                <>
                  <span className="text-slate-600">|</span>
                  <span>{postedLabel}</span>
                </>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => onOpenDetails(job._id)}
              className="mt-3 text-left text-2xl font-semibold tracking-tight text-white transition hover:text-cyan-200"
            >
              {job.title}
            </button>

            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-slate-400">
              <span className="font-medium text-slate-200">{job.company}</span>
              <span className="text-slate-600">|</span>
              <span>{job.recruiterName}</span>
              <span className="text-slate-600">|</span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-cyan-300" />
                {job.location}
              </span>
            </div>

            <div className="mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-2 xl:grid-cols-4">
              <div className="border-l border-slate-700 pl-3">
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Min Score</div>
                <div className="mt-1 inline-flex items-center gap-1.5 text-white">
                  <Sparkles className="h-4 w-4 text-cyan-300" />
                  {job.minimumInnovationScore}
                </div>
              </div>
              <div className="border-l border-slate-700 pl-3">
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Applicants</div>
                <div className="mt-1 inline-flex items-center gap-1.5 text-white">
                  <Users className="h-4 w-4 text-cyan-300" />
                  {job.applicantCount}
                </div>
              </div>
              <div className="border-l border-slate-700 pl-3">
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Shortlisted</div>
                <div className="mt-1 text-white">{job.shortlistedCount}</div>
              </div>
              <div className="border-l border-slate-700 pl-3">
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Status</div>
                <div className={`mt-1 ${job.isActive ? 'text-emerald-300' : 'text-slate-400'}`}>
                  {job.isActive ? 'Actively hiring' : 'Closed'}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 xl:ml-8">
            <ProfileAvatar
              profile={{
                _id: recruiterProfileId,
                displayName: job.recruiterName,
                avatar: job.recruiterAvatar,
                role: UserRole.RECRUITER,
                headline: job.recruiterHeadline,
                location: job.recruiterLocation,
                insightCounts: { skills: 0, experience: 0, education: 0, portfolioProjects: 0 },
              }}
              size="compact"
            />
            <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">JD View</div>
          </div>
        </div>

        {descriptionHighlights.length > 0 ? (
          <div className="space-y-2 text-sm leading-6 text-slate-300">
            {descriptionHighlights.map((line) => (
              <div key={line} className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-cyan-300" />
                <span>{line}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm leading-6 text-slate-300">{job.description || 'Job description will appear here.'}</p>
        )}

        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2 text-xs text-slate-400">
            <span className="rounded-full border border-slate-700 px-3 py-1.5">{job.domain}</span>
            <span className="rounded-full border border-slate-700 px-3 py-1.5">{job.type}</span>
            <span className="rounded-full border border-slate-700 px-3 py-1.5">{job.location}</span>
            {expiresLabel ? <span className="rounded-full border border-slate-700 px-3 py-1.5">Expires {expiresLabel}</span> : null}
          </div>

          <div className="flex flex-wrap gap-2 xl:justify-end">
            <Button
              className="h-10 rounded-full bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-4 py-0 text-sm text-white hover:from-indigo-500 hover:to-fuchsia-500"
              disabled={hasApplied || isPending || !job.isActive}
              onClick={handleApply}
            >
              {isPending ? 'Applying...' : hasApplied ? 'Applied' : 'Apply now'}
            </Button>
            <Button
              variant="secondary"
              className="h-10 rounded-full border-slate-700 bg-transparent px-4 py-0 text-sm text-slate-200 hover:border-slate-500 hover:bg-slate-900/40"
              onClick={() => onOpenDetails(job._id)}
            >
              View details
            </Button>
            <Button
              variant="secondary"
              className="h-10 rounded-full border-slate-700 bg-transparent px-4 py-0 text-sm text-slate-200 hover:border-slate-500 hover:bg-slate-900/40"
              onClick={() => onOpenRecruiter(recruiterProfileId)}
            >
              <Eye className="mr-2 h-4 w-4" />
              Recruiter
            </Button>
            <Button
              variant="secondary"
              className="h-10 rounded-full border-slate-700 bg-transparent px-4 py-0 text-sm text-slate-200 hover:border-slate-500 hover:bg-slate-900/40"
              onClick={() => onMessageRecruiter(recruiterProfileId)}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Message
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function Marketplace() {
  const navigate = useNavigate();
  const [role, setRole] = useState<MarketplaceRole>('recruiter');
  const [recruiterBrowseMode, setRecruiterBrowseMode] = useState<RecruiterBrowseMode>('jobs');
  const [search, setSearch] = useState('');
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedExperienceBand, setSelectedExperienceBand] = useState<'all' | '0-1' | '2-4' | '5+'>('all');
  const [selectedDepthFilters, setSelectedDepthFilters] = useState<Array<'skills' | 'experience' | 'projects'>>([]);
  const [selectedJobTypes, setSelectedJobTypes] = useState<RecruiterJobView['type'][]>([]);
  const [selectedJobPostedWindow, setSelectedJobPostedWindow] = useState<JobPostedWindow>('any');
  const [sortBy, setSortBy] = useState<'recommended' | 'name' | 'experience' | 'projects'>('recommended');
  const [jobSortBy, setJobSortBy] = useState<JobSortBy>('recommended');
  const [expandedRecruiterId, setExpandedRecruiterId] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const activeTab = tabs.find((tab) => tab.id === role) ?? tabs[0];

  const profilesQuery = useQuery({
    queryKey: ['marketplace', role],
    queryFn: () => marketplaceApi.list(role),
  });

  const recruiterJobsQuery = useQuery({
    queryKey: ['marketplace', 'recruiter-jobs', (profilesQuery.data ?? []).map((profile) => profile._id).join(',')],
    enabled: role === 'recruiter' && Boolean(profilesQuery.data?.length),
    queryFn: async () => {
      const recruiters = profilesQuery.data ?? [];
      const jobGroups = await Promise.all(
        recruiters.map(async (profile) => {
          const jobs = await recruiterApi.getPublicJobs(profile._id);

          return jobs.map((job) => ({
            ...job,
            recruiterName: profile.displayName,
            recruiterAvatar: profile.avatar,
            recruiterHeadline: profile.headline ?? profile.role,
            recruiterLocation: profile.location,
          }));
        }),
      );

      return jobGroups.flat();
    },
  });

  const filterOptions = useMemo(() => {
    const profiles = profilesQuery.data ?? [];
    const domainCounts = new Map<string, number>();
    const locationCounts = new Map<string, number>();
    const experienceCounts = {
      '0-1': 0,
      '2-4': 0,
      '5+': 0,
    };
    const depthCounts = {
      skills: 0,
      experience: 0,
      projects: 0,
    };

    for (const profile of profiles) {
      const counts = getInsightCounts(profile);

      if (profile.domain) {
        domainCounts.set(profile.domain, (domainCounts.get(profile.domain) ?? 0) + 1);
      }

      if (profile.location) {
        locationCounts.set(profile.location, (locationCounts.get(profile.location) ?? 0) + 1);
      }

      if (counts.experience <= 1) {
        experienceCounts['0-1'] += 1;
      } else if (counts.experience <= 4) {
        experienceCounts['2-4'] += 1;
      } else {
        experienceCounts['5+'] += 1;
      }

      if (counts.skills > 0) {
        depthCounts.skills += 1;
      }

      if (counts.experience > 0) {
        depthCounts.experience += 1;
      }

      if (counts.portfolioProjects > 0) {
        depthCounts.projects += 1;
      }
    }

    return {
      domains: [...domainCounts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])),
      locations: [...locationCounts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])),
      experienceCounts,
      depthCounts,
    };
  }, [profilesQuery.data]);

  const jobFilterOptions = useMemo(() => {
    const jobs = recruiterJobsQuery.data ?? [];
    const domainCounts = new Map<string, number>();
    const locationCounts = new Map<string, number>();
    const typeCounts = new Map<RecruiterJobView['type'], number>();

    for (const job of jobs) {
      domainCounts.set(job.domain, (domainCounts.get(job.domain) ?? 0) + 1);
      locationCounts.set(job.location, (locationCounts.get(job.location) ?? 0) + 1);
      typeCounts.set(job.type, (typeCounts.get(job.type) ?? 0) + 1);
    }

    return {
      domains: [...domainCounts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])),
      locations: [...locationCounts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])),
      jobTypes: [...typeCounts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])),
    };
  }, [recruiterJobsQuery.data]);

  const profileList = useMemo(() => {
    const source = profilesQuery.data ?? [];
    let filtered = source;

    if (deferredSearch) {
      filtered = filtered.filter((profile) => getMarketplaceSearchText(profile).includes(deferredSearch));
    }

    if (selectedDomains.length > 0) {
      filtered = filtered.filter((profile) => Boolean(profile.domain) && selectedDomains.includes(profile.domain!));
    }

    if (selectedLocations.length > 0) {
      filtered = filtered.filter((profile) => Boolean(profile.location) && selectedLocations.includes(profile.location!));
    }

    if (selectedExperienceBand !== 'all') {
      filtered = filtered.filter((profile) => {
        const experienceCount = getInsightCounts(profile).experience;

        if (selectedExperienceBand === '0-1') {
          return experienceCount <= 1;
        }

        if (selectedExperienceBand === '2-4') {
          return experienceCount >= 2 && experienceCount <= 4;
        }

        return experienceCount >= 5;
      });
    }

    if (selectedDepthFilters.length > 0) {
      filtered = filtered.filter((profile) => {
        const counts = getInsightCounts(profile);

        return selectedDepthFilters.every((filter) => {
          if (filter === 'skills') {
            return counts.skills > 0;
          }

          if (filter === 'experience') {
            return counts.experience > 0;
          }

          return counts.portfolioProjects > 0;
        });
      });
    }

    const sortable = [...filtered];

    if (sortBy === 'name') {
      sortable.sort((left, right) => left.displayName.localeCompare(right.displayName));
    }

    if (sortBy === 'experience') {
      sortable.sort((left, right) => getInsightCounts(right).experience - getInsightCounts(left).experience);
    }

    if (sortBy === 'projects') {
      sortable.sort((left, right) => getInsightCounts(right).portfolioProjects - getInsightCounts(left).portfolioProjects);
    }

    return sortable;
  }, [deferredSearch, profilesQuery.data, selectedDepthFilters, selectedDomains, selectedExperienceBand, selectedLocations, sortBy]);

  const recruiterJobList = useMemo(() => {
    const source = recruiterJobsQuery.data ?? [];
    let filtered = source;

    if (deferredSearch) {
      filtered = filtered.filter((job) => getRecruiterJobSearchText(job).includes(deferredSearch));
    }

    if (selectedDomains.length > 0) {
      filtered = filtered.filter((job) => selectedDomains.includes(job.domain));
    }

    if (selectedLocations.length > 0) {
      filtered = filtered.filter((job) => selectedLocations.includes(job.location));
    }

    if (selectedJobTypes.length > 0) {
      filtered = filtered.filter((job) => selectedJobTypes.includes(job.type));
    }

    if (selectedJobPostedWindow !== 'any') {
      const cutoffDays = selectedJobPostedWindow === '7d' ? 7 : 30;
      const cutoff = Date.now() - cutoffDays * 24 * 60 * 60 * 1000;
      filtered = filtered.filter((job) => {
        const createdAt = new Date(job.createdAt).getTime();
        return !Number.isNaN(createdAt) && createdAt >= cutoff;
      });
    }

    const sortable = [...filtered];

    if (jobSortBy === 'recent' || jobSortBy === 'recommended') {
      sortable.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
    }

    if (jobSortBy === 'score') {
      sortable.sort((left, right) => left.minimumInnovationScore - right.minimumInnovationScore);
    }

    if (jobSortBy === 'applicants') {
      sortable.sort((left, right) => right.applicantCount - left.applicantCount);
    }

    return sortable;
  }, [
    deferredSearch,
    jobSortBy,
    recruiterJobsQuery.data,
    selectedDomains,
    selectedJobPostedWindow,
    selectedJobTypes,
    selectedLocations,
  ]);

  const marketplaceSummary = useMemo(() => {
    const profiles = profilesQuery.data ?? [];
    const domains = new Set<string>();
    let totalExperience = 0;
    let totalProjects = 0;
    let totalSkills = 0;

    for (const profile of profiles) {
      if (profile.domain) {
        domains.add(profile.domain);
      }

      const counts = getInsightCounts(profile);
      totalExperience += counts.experience;
      totalProjects += counts.portfolioProjects;
      totalSkills += counts.skills;
    }

    return {
      liveResults: profiles.length,
      representedDomains: domains.size,
      experienceSignals: totalExperience,
      portfolioProjects: totalProjects,
      trackedSkills: totalSkills,
    };
  }, [profilesQuery.data]);

  const recruiterJobsSummary = useMemo(() => {
    const jobs = recruiterJobsQuery.data ?? [];
    const domains = new Set<string>();
    const locations = new Set<string>();

    for (const job of jobs) {
      domains.add(job.domain);
      locations.add(job.location);
    }

    return {
      liveResults: jobs.length,
      representedDomains: domains.size,
      representedLocations: locations.size,
    };
  }, [recruiterJobsQuery.data]);

  const showBanner = (tone: 'success' | 'error', message: string) => {
    setBanner({ tone, message });
    window.setTimeout(() => setBanner(null), 3000);
  };

  const hasActiveFilters = Boolean(
    search.trim() ||
      selectedDomains.length > 0 ||
      selectedLocations.length > 0 ||
      (role === 'recruiter' && recruiterBrowseMode === 'jobs'
        ? selectedJobTypes.length > 0 || selectedJobPostedWindow !== 'any'
        : selectedExperienceBand !== 'all' || selectedDepthFilters.length > 0),
  );

  const toggleArrayFilter = <T extends string>(
    value: T,
    current: T[],
    setter: (value: T[]) => void,
  ) => {
    setter(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  return (
    <DashboardLayout role="student">
      <div className="flex h-full min-h-0 w-full flex-col gap-4 overflow-hidden text-white">
        <section className="flex-none overflow-x-auto">
          <div className="flex min-w-max items-center gap-10 border-b border-slate-800/90">
            {tabs.map((tab) => {
              const isActive = tab.id === role;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() =>
                    startTransition(() => {
                      setRole(tab.id);
                      setSearch('');
                      setSelectedDomains([]);
                      setSelectedLocations([]);
                      setSelectedExperienceBand('all');
                      setSelectedDepthFilters([]);
                      setSelectedJobTypes([]);
                      setSelectedJobPostedWindow('any');
                      setSortBy('recommended');
                      setJobSortBy('recommended');
                      setRecruiterBrowseMode(tab.id === 'recruiter' ? 'jobs' : 'recruiters');
                      setExpandedRecruiterId(null);
                    })
                  }
                  className={`inline-flex min-h-[3rem] items-center border-b-2 px-1 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'border-cyan-400 text-cyan-300'
                      : 'border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="flex min-h-0 flex-1 overflow-hidden border-y border-slate-800/80 bg-[linear-gradient(180deg,#101624_0%,#0c1220_100%)] text-slate-100">
          <div className="grid min-h-0 w-full gap-0 xl:grid-cols-[300px,minmax(0,1fr)] xl:divide-x xl:divide-slate-800/80">
            <aside className="flex min-h-0 flex-col px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Filters</div>
                  <h2 className="mt-2 text-2xl font-semibold text-white">All Filters</h2>
                </div>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setSelectedDomains([]);
                      setSelectedLocations([]);
                      setSelectedExperienceBand('all');
                      setSelectedDepthFilters([]);
                      setSelectedJobTypes([]);
                      setSelectedJobPostedWindow('any');
                    }}
                    className="text-sm font-medium text-cyan-300 transition hover:text-cyan-200"
                  >
                    Clear
                  </button>
                ) : null}
              </div>

              <div className="mt-6 min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
                <div className="border-t border-slate-800/80 pt-5">
                  <div className="mb-3 text-lg font-semibold text-white">Search</div>
                  <label className="relative block">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <Input
                      value={search}
                      onChange={(event) => {
                        const { value } = event.target;
                        startTransition(() => setSearch(value));
                      }}
                      placeholder={
                        role === 'recruiter' && recruiterBrowseMode === 'jobs'
                          ? 'Search job title, company or recruiter'
                          : `Search ${activeTab.label.toLowerCase()}, company or skill`
                      }
                      className="h-12 rounded-none border-0 border-b border-slate-700 bg-transparent pl-10 text-slate-100 focus:border-cyan-400 focus-visible:ring-0"
                    />
                  </label>
                </div>

                <div className="border-t border-slate-800/80 pt-5">
                  <div className="mb-3 text-lg font-semibold text-white">Domain</div>
                  <div className="space-y-3">
                    {(role === 'recruiter' && recruiterBrowseMode === 'jobs'
                      ? jobFilterOptions.domains
                      : filterOptions.domains
                    )
                      .slice(0, 5)
                      .map(([domain, count]) => (
                      <label key={domain} className="flex cursor-pointer items-center justify-between gap-3 text-sm text-slate-300">
                        <span className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedDomains.includes(domain)}
                            onChange={() => toggleArrayFilter(domain, selectedDomains, setSelectedDomains)}
                            className="h-4 w-4 rounded border-slate-600 bg-transparent text-cyan-400 focus:ring-cyan-500"
                          />
                          <span>{domain}</span>
                        </span>
                        <span className="text-slate-500">({count})</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="border-t border-slate-800/80 pt-5">
                  <div className="mb-3 text-lg font-semibold text-white">
                    {role === 'recruiter' && recruiterBrowseMode === 'jobs' ? 'Job type' : 'Experience'}
                  </div>
                  <div className="space-y-3">
                    {role === 'recruiter' && recruiterBrowseMode === 'jobs' ? (
                      <>
                        {jobFilterOptions.jobTypes.map(([jobType, count]) => (
                          <label key={jobType} className="flex cursor-pointer items-center justify-between gap-3 text-sm text-slate-300">
                            <span className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={selectedJobTypes.includes(jobType)}
                                onChange={() => toggleArrayFilter(jobType, selectedJobTypes, setSelectedJobTypes)}
                                className="h-4 w-4 rounded border-slate-600 bg-transparent text-cyan-400 focus:ring-cyan-500"
                              />
                              <span>{jobType}</span>
                            </span>
                            <span className="text-slate-500">({count})</span>
                          </label>
                        ))}
                      </>
                    ) : (
                      <>
                        {[
                          { label: '0-1 signals', value: '0-1' as const, count: filterOptions.experienceCounts['0-1'] },
                          { label: '2-4 signals', value: '2-4' as const, count: filterOptions.experienceCounts['2-4'] },
                          { label: '5+ signals', value: '5+' as const, count: filterOptions.experienceCounts['5+'] },
                        ].map((option) => (
                          <label key={option.value} className="flex cursor-pointer items-center justify-between gap-3 text-sm text-slate-300">
                            <span className="flex items-center gap-3">
                              <input
                                type="radio"
                                name="experience-band"
                                checked={selectedExperienceBand === option.value}
                                onChange={() => setSelectedExperienceBand(option.value)}
                                className="h-4 w-4 border-slate-600 bg-transparent text-cyan-400 focus:ring-cyan-500"
                              />
                              <span>{option.label}</span>
                            </span>
                            <span className="text-slate-500">({option.count})</span>
                          </label>
                        ))}
                        <button
                          type="button"
                          onClick={() => setSelectedExperienceBand('all')}
                          className={`text-sm ${selectedExperienceBand === 'all' ? 'font-medium text-cyan-300' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                          Any
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-800/80 pt-5">
                  <div className="mb-3 text-lg font-semibold text-white">Location</div>
                  <div className="space-y-3">
                    {(role === 'recruiter' && recruiterBrowseMode === 'jobs'
                      ? jobFilterOptions.locations
                      : filterOptions.locations
                    )
                      .slice(0, 5)
                      .map(([location, count]) => (
                      <label key={location} className="flex cursor-pointer items-center justify-between gap-3 text-sm text-slate-300">
                        <span className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedLocations.includes(location)}
                            onChange={() => toggleArrayFilter(location, selectedLocations, setSelectedLocations)}
                            className="h-4 w-4 rounded border-slate-600 bg-transparent text-cyan-400 focus:ring-cyan-500"
                          />
                          <span>{location}</span>
                        </span>
                        <span className="text-slate-500">({count})</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="border-t border-slate-800/80 pt-5">
                  <div className="mb-3 text-lg font-semibold text-white">
                    {role === 'recruiter' && recruiterBrowseMode === 'jobs' ? 'Posted' : 'Profile depth'}
                  </div>
                  <div className="space-y-3">
                    {role === 'recruiter' && recruiterBrowseMode === 'jobs' ? (
                      <>
                        {[
                          { label: 'Any time', value: 'any' as const },
                          { label: 'Last 7 days', value: '7d' as const },
                          { label: 'Last 30 days', value: '30d' as const },
                        ].map((option) => (
                          <label key={option.value} className="flex cursor-pointer items-center gap-3 text-sm text-slate-300">
                            <input
                              type="radio"
                              name="job-posted-window"
                              checked={selectedJobPostedWindow === option.value}
                              onChange={() => setSelectedJobPostedWindow(option.value)}
                              className="h-4 w-4 border-slate-600 bg-transparent text-cyan-400 focus:ring-cyan-500"
                            />
                            <span>{option.label}</span>
                          </label>
                        ))}
                      </>
                    ) : (
                      <>
                        {[
                          { label: 'Has skills', value: 'skills' as const, count: filterOptions.depthCounts.skills },
                          { label: 'Has experience', value: 'experience' as const, count: filterOptions.depthCounts.experience },
                          { label: 'Has projects', value: 'projects' as const, count: filterOptions.depthCounts.projects },
                        ].map((option) => (
                          <label key={option.value} className="flex cursor-pointer items-center justify-between gap-3 text-sm text-slate-300">
                            <span className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={selectedDepthFilters.includes(option.value)}
                                onChange={() =>
                                  setSelectedDepthFilters((current) =>
                                    current.includes(option.value)
                                      ? current.filter((item) => item !== option.value)
                                      : [...current, option.value],
                                  )
                                }
                                className="h-4 w-4 rounded border-slate-600 bg-transparent text-cyan-400 focus:ring-cyan-500"
                              />
                              <span>{option.label}</span>
                            </span>
                            <span className="text-slate-500">({option.count})</span>
                          </label>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </aside>

            <div className="flex min-h-0 flex-col px-5 py-4">
              <div className="flex-none border-b border-slate-800/80 pb-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-sm text-slate-500">
                      {role === 'recruiter' && recruiterBrowseMode === 'jobs'
                        ? recruiterJobList.length > 0
                          ? `1 - ${recruiterJobList.length} of ${recruiterJobsSummary.liveResults}`
                          : '0'
                        : profileList.length > 0
                          ? `1 - ${profileList.length} of ${marketplaceSummary.liveResults}`
                          : '0'}{' '}
                      <span className="font-semibold text-white">{activeTab.label}</span>
                    </div>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                      {role === 'recruiter' && recruiterBrowseMode === 'jobs'
                        ? 'Explore recruiter jobs'
                        : `Explore ${activeTab.label.toLowerCase()}`}
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                      {role === 'recruiter' && recruiterBrowseMode === 'jobs'
                        ? 'Scan open roles with recruiter identity, location, minimum innovation score, and a usable JD before you apply.'
                        : roleCopy[role]}
                    </p>
                    {role === 'recruiter' ? (
                      <div className="mt-4 inline-flex rounded-full border border-slate-800 bg-slate-950/70 p-1">
                        {([
                          { id: 'jobs', label: 'Jobs' },
                          { id: 'recruiters', label: 'Recruiters' },
                        ] as const).map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => {
                              setRecruiterBrowseMode(option.id);
                              setSearch('');
                              setSelectedDomains([]);
                              setSelectedLocations([]);
                              setSelectedExperienceBand('all');
                              setSelectedDepthFilters([]);
                              setSelectedJobTypes([]);
                              setSelectedJobPostedWindow('any');
                            }}
                            className={`rounded-full px-4 py-2 text-sm transition ${
                              recruiterBrowseMode === option.id
                                ? 'bg-cyan-500/15 text-cyan-200'
                                : 'text-slate-400 hover:text-slate-100'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="rounded-full border border-slate-700 bg-transparent px-4 py-2 text-sm text-slate-300">
                      {hasActiveFilters ? 'Filters applied' : role === 'recruiter' && recruiterBrowseMode === 'jobs' ? 'All jobs' : 'All profiles'}
                    </div>
                    <label className="flex items-center gap-3 border-b border-slate-700 px-1 py-3 text-sm text-slate-400">
                      <span>Sort by:</span>
                      <select
                        value={role === 'recruiter' && recruiterBrowseMode === 'jobs' ? jobSortBy : sortBy}
                        onChange={(event) =>
                          role === 'recruiter' && recruiterBrowseMode === 'jobs'
                            ? setJobSortBy(event.target.value as JobSortBy)
                            : setSortBy(event.target.value as 'recommended' | 'name' | 'experience' | 'projects')
                        }
                        className="bg-transparent font-medium text-white outline-none"
                      >
                        <option value="recommended">Recommended</option>
                        {role === 'recruiter' && recruiterBrowseMode === 'jobs' ? (
                          <>
                            <option value="recent">Most recent</option>
                            <option value="score">Lowest score</option>
                            <option value="applicants">Most applicants</option>
                          </>
                        ) : (
                          <>
                            <option value="name">Name</option>
                            <option value="experience">Experience</option>
                            <option value="projects">Projects</option>
                          </>
                        )}
                      </select>
                    </label>
                  </div>
                </div>

                {hasActiveFilters ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {search.trim() ? (
                      <span className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300">Search: {search.trim()}</span>
                    ) : null}
                    {selectedDomains.map((domain) => (
                      <span key={domain} className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300">
                        {domain}
                      </span>
                    ))}
                    {selectedLocations.map((location) => (
                      <span key={location} className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300">
                        {location}
                      </span>
                    ))}
                    {role === 'recruiter' && recruiterBrowseMode === 'jobs' ? (
                      <>
                        {selectedJobTypes.map((jobType) => (
                          <span key={jobType} className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300">
                            {jobType}
                          </span>
                        ))}
                        {selectedJobPostedWindow !== 'any' ? (
                          <span className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300">
                            Posted: {selectedJobPostedWindow === '7d' ? 'Last 7 days' : 'Last 30 days'}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <>
                        {selectedDepthFilters.map((filter) => (
                          <span key={filter} className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300">
                            {filter === 'skills' ? 'Has skills' : filter === 'experience' ? 'Has experience' : 'Has projects'}
                          </span>
                        ))}
                        {selectedExperienceBand !== 'all' ? (
                          <span className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300">
                            Experience: {selectedExperienceBand}
                          </span>
                        ) : null}
                      </>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {role === 'recruiter' && recruiterBrowseMode === 'jobs' ? (
                  <>
                    {recruiterJobsQuery.isLoading ? (
                      <div className="flex items-center justify-center border-b border-slate-800/80 px-6 py-16">
                        <Spinner />
                      </div>
                    ) : null}

                    {recruiterJobsQuery.isError ? (
                      <div className="border-b border-rose-500/30 bg-rose-500/10 px-6 py-5 text-sm text-rose-200">
                        Unable to load recruiter jobs right now.
                      </div>
                    ) : null}

                    {!recruiterJobsQuery.isLoading && !recruiterJobsQuery.isError && recruiterJobList.length === 0 ? (
                      <div className="border-b border-slate-800/80 px-8 py-10">
                        <div className="max-w-2xl space-y-3">
                          <div className="text-sm font-semibold text-cyan-300">No jobs found</div>
                          <h2 className="text-2xl font-semibold text-white">No recruiter jobs match these filters.</h2>
                          <p className="text-slate-400">
                            Try another job title, location, or domain. You can also clear filters to see the full job feed.
                          </p>
                        </div>
                      </div>
                    ) : null}

                    {!recruiterJobsQuery.isLoading &&
                      !recruiterJobsQuery.isError &&
                      recruiterJobList.map((job) => (
                        <MarketplaceRecruiterJobCard
                          key={job._id}
                          job={job}
                          recruiterProfileId={job.recruiterId}
                          onOpenRecruiter={setSelectedProfileId}
                          onOpenDetails={(targetJobId) => navigate(`/marketplace/jobs/${targetJobId}`)}
                          onApplyFeedback={showBanner}
                          onMessageRecruiter={(profileId) => {
                            const storageKey = `dm_first_contact_${profileId}`;
                            if (!localStorage.getItem(storageKey)) {
                              localStorage.setItem(storageKey, 'true');
                            }
                            navigate(`/dashboard/messages/${profileId}`);
                          }}
                        />
                      ))}
                  </>
                ) : (
                  <>
                    {profilesQuery.isLoading ? (
                      <div className="flex items-center justify-center border-b border-slate-800/80 px-6 py-16">
                        <Spinner />
                      </div>
                    ) : null}

                    {profilesQuery.isError ? (
                      <div className="border-b border-rose-500/30 bg-rose-500/10 px-6 py-5 text-sm text-rose-200">
                        Unable to load marketplace profiles right now.
                      </div>
                    ) : null}

                    {!profilesQuery.isLoading && !profilesQuery.isError && profileList.length === 0 ? (
                      <div className="border-b border-slate-800/80 px-8 py-10">
                        <div className="max-w-2xl space-y-3">
                          <div className="text-sm font-semibold text-cyan-300">No profiles found</div>
                          <h2 className="text-2xl font-semibold text-white">No marketplace members match these filters.</h2>
                          <p className="text-slate-400">
                            Try another keyword, location, or domain. You can also clear filters to see the full lane.
                          </p>
                        </div>
                      </div>
                    ) : null}

                    {!profilesQuery.isLoading &&
                      !profilesQuery.isError &&
                      profileList.map((profile) => {
                        const counts = getInsightCounts(profile);
                        const skillPreview = (profile.skills ?? []).slice(0, 4);

                        return (
                          <article
                            key={profile._id}
                            className="border-b border-slate-800/80 py-6 [content-visibility:auto] last:border-b-0"
                          >
                            <div className="flex flex-col gap-5">
                              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                <div className="min-w-0 xl:flex-1">
                                  <h3 className="text-2xl font-semibold tracking-tight text-white sm:text-[2rem]">
                                    {profile.displayName}
                                  </h3>
                                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-slate-400">
                                    <span className="font-medium text-slate-200">{profile.headline ?? profile.role}</span>
                                    {profile.location ? (
                                      <>
                                        <span className="text-slate-600">|</span>
                                        <span className="inline-flex items-center gap-1.5">
                                          <MapPin className="h-4 w-4 text-cyan-300" />
                                          {profile.location}
                                        </span>
                                      </>
                                    ) : null}
                                    {profile.domain ? (
                                      <>
                                        <span className="text-slate-600">|</span>
                                        <span>{profile.domain}</span>
                                      </>
                                    ) : null}
                                  </div>

                                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-400">
                                    <span>{counts.experience} experience items</span>
                                    <span>{counts.skills} skills</span>
                                    <span>{counts.portfolioProjects} projects</span>
                                  </div>
                                </div>

                                <div className="flex flex-col gap-3 xl:ml-8 xl:items-end">
                                  <div className="flex items-center gap-3 xl:justify-end">
                                    <ProfileAvatar profile={profile} size="compact" />
                                    <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Quick actions</div>
                                  </div>

                                  <div className="flex flex-wrap gap-2 xl:justify-end">
                                    <Button
                                      className="h-10 rounded-full bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-4 py-0 text-sm text-white hover:from-indigo-500 hover:to-fuchsia-500"
                                      onClick={() => {
                                        const storageKey = `dm_first_contact_${profile._id}`;
                                        if (!localStorage.getItem(storageKey)) {
                                          localStorage.setItem(storageKey, 'true');
                                        }
                                        navigate(`/dashboard/messages/${profile._id}`);
                                      }}
                                    >
                                      <MessageCircle className="mr-2 h-4 w-4" />
                                      Message
                                    </Button>
                                    <Button
                                      variant="secondary"
                                      className="h-10 rounded-full border-slate-700 bg-transparent px-4 py-0 text-sm text-slate-200 hover:border-slate-500 hover:bg-slate-900/40"
                                      onClick={() => setSelectedProfileId(profile._id)}
                                    >
                                      <Eye className="mr-2 h-4 w-4" />
                                      Profile
                                    </Button>
                                    {role === 'recruiter' ? (
                                      <Button
                                        variant="secondary"
                                        className="h-10 rounded-full border-slate-700 bg-transparent px-4 py-0 text-sm text-slate-200 hover:border-slate-500 hover:bg-slate-900/40"
                                        onClick={() =>
                                          setExpandedRecruiterId(expandedRecruiterId === profile._id ? null : profile._id)
                                        }
                                      >
                                        {expandedRecruiterId === profile._id ? (
                                          <ChevronUp className="mr-2 h-4 w-4" />
                                        ) : (
                                          <ChevronDown className="mr-2 h-4 w-4" />
                                        )}
                                        {expandedRecruiterId === profile._id ? 'Hide Jobs' : 'Jobs'}
                                      </Button>
                                    ) : null}
                                  </div>
                                </div>
                              </div>

                              <p className="max-w-4xl text-sm leading-6 text-slate-300">
                                {profile.bio ?? 'Public profile details will appear here as more marketplace members complete their profiles.'}
                              </p>

                              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                                <div className="min-w-0 xl:flex-1">
                                  {skillPreview.length > 0 ? (
                                    <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                                      {skillPreview.map((skill) => (
                                        <span key={`${profile._id}-${skill.name}`} className="rounded-full border border-slate-700 px-3 py-1.5">
                                          {skill.name}
                                        </span>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>

                                <div className="xl:ml-8 xl:max-w-[32rem] xl:flex-1 xl:self-end">
                                  <ProfileLinkChips profile={profile} />
                                </div>
                              </div>
                            </div>

                            {role === 'recruiter' && expandedRecruiterId === profile._id ? (
                              <RecruiterJobCard
                                recruiterId={profile._id}
                                recruiterName={profile.displayName}
                                onApplyFeedback={showBanner}
                              />
                            ) : null}
                          </article>
                        );
                      })}
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      <MarketplaceProfileDrawer
        profileId={selectedProfileId}
        open={Boolean(selectedProfileId)}
        onClose={() => setSelectedProfileId(null)}
      />
      {banner ? (
        <div
          className={`fixed bottom-6 right-6 z-50 max-w-sm rounded-2xl border px-4 py-3 shadow-2xl ${
            banner.tone === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-100'
          }`}
        >
          {banner.message}
        </div>
      ) : null}
    </DashboardLayout>
  );
}
