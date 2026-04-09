import { FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Award,
  Briefcase,
  Copy,
  ExternalLink,
  Github,
  Globe,
  GraduationCap,
  Instagram,
  Linkedin,
  Link2,
  Rocket,
  Save,
  Trash2,
  Twitter,
  Youtube,
} from 'lucide-react';
import {
  GithubRepositoryChoice,
  PortfolioProject,
  ProfileCertification,
  ProfileEducation,
  ProfileExperience,
  ProfileSkill,
  SocialEnrichSummary,
  UserProfile,
  userApi,
} from '../../api/user.api';
import { startupApi } from '../../api/startup.api';
import { useAuthStore } from '../../store/authStore';
import { UserRole } from '../../types/roles.types';

const readError = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? fallback;

const buildSocialToast = (summary: SocialEnrichSummary) => {
  const chunks: string[] = [];

  if (summary.linkedinImported) {
    chunks.push(
      [
        summary.importedProfileFields ? `${summary.importedProfileFields} profile fields` : null,
        summary.importedExperience ? `${summary.importedExperience} experience items` : null,
        summary.importedEducation ? `${summary.importedEducation} education items` : null,
        summary.importedCertifications ? `${summary.importedCertifications} certifications` : null,
      ]
        .filter(Boolean)
        .join(', ') || 'LinkedIn data',
    );
  }

  if (summary.githubImported) {
    chunks.push(
      [
        summary.importedProjects ? `${summary.importedProjects} GitHub projects` : null,
        summary.importedSkills ? `${summary.importedSkills} skills` : null,
      ]
        .filter(Boolean)
        .join(', ') || 'GitHub data',
    );
  }

  if (chunks.length > 0) {
    return `Imported ${chunks.join(' and ')}.${summary.warnings[0] ? ` ${summary.warnings[0]}` : ''}`;
  }

  return summary.warnings[0] ?? 'No new social data was imported.';
};

type ProfileForm = {
  displayName: string;
  avatar: string;
  avatarWallpaper: string;
  bio: string;
  domain: string;
  headline: string;
  location: string;
  linkedinUrl: string;
  websiteUrl: string;
  twitterUrl: string;
  youtubeUrl: string;
  behanceUrl: string;
  dribbbleUrl: string;
  instagramUrl: string;
  researchGateUrl: string;
  mediumUrl: string;
  discoverableToRecruiters: boolean;
  skills: ProfileSkill[];
  experience: ProfileExperience[];
  education: ProfileEducation[];
  certifications: ProfileCertification[];
  portfolioProjects: PortfolioProject[];
  institutionProfile: {
    institutionName: string;
    location: string;
    totalStudentsEnrolled: string;
    academicYear: string;
    iicStarRating: string;
    organizationType: string;
    foundedYear: string;
    specialties: string[];
    locations: string[];
    alumniCount: string;
    employeeCount: string;
    contactEmail: string;
    contactPhone: string;
    stats: {
      totalInnovationActivities: string;
      patentsFiled: string;
      totalMentoringHours: string;
      startupsLaunched: string;
      industryCollaborations: string;
      totalHRConnections: string;
      studentsPlaced: string;
      directShortlistsThisQuarter: string;
      topHiringSector: string;
    };
  };
};

const newId = () => `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const toDateInput = (value: string | null | undefined) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

const fromListInput = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const parseYear = (value: string) => {
  const year = Number(value);
  return Number.isFinite(year) && year > 0 ? year : null;
};

const parseOptionalInteger = (value: string) => {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};

const toFormNumber = (value?: number | null) => (typeof value === 'number' ? String(value) : '');

const createInstitutionProfileForm = (profile?: UserProfile['institutionProfile']): ProfileForm['institutionProfile'] => ({
  institutionName: profile?.institutionName ?? '',
  location: profile?.location ?? '',
  totalStudentsEnrolled: toFormNumber(profile?.totalStudentsEnrolled),
  academicYear: profile?.academicYear ?? '',
  iicStarRating: toFormNumber(profile?.iicStarRating),
  organizationType: profile?.organizationType ?? '',
  foundedYear: toFormNumber(profile?.foundedYear),
  specialties: profile?.specialties ?? [],
  locations: profile?.locations ?? [],
  alumniCount: toFormNumber(profile?.alumniCount),
  employeeCount: toFormNumber(profile?.employeeCount),
  contactEmail: profile?.contactEmail ?? '',
  contactPhone: profile?.contactPhone ?? '',
  stats: {
    totalInnovationActivities: toFormNumber(profile?.stats?.totalInnovationActivities),
    patentsFiled: toFormNumber(profile?.stats?.patentsFiled),
    totalMentoringHours: toFormNumber(profile?.stats?.totalMentoringHours),
    startupsLaunched: toFormNumber(profile?.stats?.startupsLaunched),
    industryCollaborations: toFormNumber(profile?.stats?.industryCollaborations),
    totalHRConnections: toFormNumber(profile?.stats?.totalHRConnections),
    studentsPlaced: toFormNumber(profile?.stats?.studentsPlaced),
    directShortlistsThisQuarter: toFormNumber(profile?.stats?.directShortlistsThisQuarter),
    topHiringSector: profile?.stats?.topHiringSector ?? '',
  },
});

const emptySkill = (): ProfileSkill => ({
  name: '',
  category: 'other',
  source: 'manual',
  level: 'beginner',
  endorsements: 0,
  addedAt: new Date().toISOString(),
});

const emptyExperience = (): ProfileExperience => ({
  _id: newId(),
  title: '',
  company: '',
  type: 'internship',
  location: '',
  startDate: new Date().toISOString(),
  endDate: null,
  isCurrent: false,
  description: '',
  skills: [],
  source: 'manual',
  linkedinId: null,
});

const emptyEducation = (): ProfileEducation => ({
  _id: newId(),
  institution: '',
  degree: '',
  fieldOfStudy: '',
  startYear: undefined,
  endYear: null,
  isCurrent: false,
  grade: '',
  activities: '',
  description: '',
  source: 'manual',
});

const isInstitutionEducation = (item: ProfileEducation) => item.source === 'institution';

const emptyCertification = (): ProfileCertification => ({
  _id: newId(),
  name: '',
  issuingOrganization: '',
  issueDate: null,
  expiryDate: null,
  credentialId: '',
  credentialUrl: '',
  source: 'manual',
});

const emptyProject = (): PortfolioProject => ({
  _id: newId(),
  title: '',
  description: '',
  techStack: [],
  repoUrl: null,
  liveUrl: null,
  coverImageUrl: null,
  startDate: null,
  endDate: null,
  isCurrent: false,
  source: 'manual',
  githubRepoId: null,
  stars: 0,
  forks: 0,
  languages: [],
});

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/15 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/15 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
      />
    </label>
  );
}

function EditorSection({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#eef3f8] text-[#0a66c2]">{icon}</div>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function SmallButton({
  children,
  onClick,
  type = 'button',
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0a66c2] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#004182] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function RepoRow({ repo, checked, onToggle }: { repo: GithubRepositoryChoice; checked: boolean; onToggle: () => void }) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-1 h-4 w-4 rounded border-slate-400 text-[#0a66c2] focus:ring-[#0a66c2]"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-semibold text-slate-950 dark:text-white">{repo.fullName}</span>
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {repo.isPrivate ? 'Private' : 'Public'}
          </span>
          {repo.imported ? <span className="rounded-full bg-[#e3f9e5] px-2 py-0.5 text-[11px] font-semibold text-[#057642]">Imported</span> : null}
        </div>
        <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">{repo.description || 'No description added.'}</div>
        <div className="mt-2 text-xs text-slate-500">{[repo.primaryLanguage, `${repo.stars} stars`, `${repo.forks} forks`].filter(Boolean).join(' . ')}</div>
      </div>
    </label>
  );
}

export function UserProfilePage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const setUser = useAuthStore((state) => state.setUser);
  const currentUser = useAuthStore((state) => state.user);
  const [toast, setToast] = useState('');
  const [confirmLinkedinFetch, setConfirmLinkedinFetch] = useState(false);
  const [selectedRepoIds, setSelectedRepoIds] = useState<string[]>([]);
  const [form, setForm] = useState<ProfileForm>({
    displayName: '',
    avatar: '',
    avatarWallpaper: '',
    bio: '',
    domain: '',
    headline: '',
    location: '',
    linkedinUrl: '',
    websiteUrl: '',
    twitterUrl: '',
    youtubeUrl: '',
    behanceUrl: '',
    dribbbleUrl: '',
    instagramUrl: '',
    researchGateUrl: '',
    mediumUrl: '',
    discoverableToRecruiters: false,
    skills: [],
    experience: [],
    education: [],
    certifications: [],
    portfolioProjects: [],
    institutionProfile: createInstitutionProfileForm(),
  });

  const profileQuery = useQuery({ queryKey: ['profile', 'me'], queryFn: userApi.getMe });
  const profile = (profileQuery.data ?? currentUser ?? null) as UserProfile | null;
  const startupsQuery = useQuery({
    queryKey: ['startup', 'mine'],
    queryFn: startupApi.mine,
    enabled: currentUser?.role === UserRole.STUDENT,
  });

  useEffect(() => {
    if (!profileQuery.data) return;
    setForm({
      displayName: profileQuery.data.displayName ?? '',
      avatar: profileQuery.data.avatar ?? '',
      avatarWallpaper: profileQuery.data.avatarWallpaper ?? '',
      bio: profileQuery.data.bio ?? '',
      domain: profileQuery.data.domain ?? '',
      headline: profileQuery.data.headline ?? '',
      location: profileQuery.data.location ?? profileQuery.data.institutionProfile?.location ?? '',
      linkedinUrl: profileQuery.data.linkedinUrl ?? '',
      websiteUrl: profileQuery.data.websiteUrl ?? '',
      twitterUrl: profileQuery.data.twitterUrl ?? '',
      youtubeUrl: profileQuery.data.youtubeUrl ?? '',
      behanceUrl: profileQuery.data.behanceUrl ?? '',
      dribbbleUrl: profileQuery.data.dribbbleUrl ?? '',
      instagramUrl: profileQuery.data.instagramUrl ?? '',
      researchGateUrl: profileQuery.data.researchGateUrl ?? '',
      mediumUrl: profileQuery.data.mediumUrl ?? '',
      discoverableToRecruiters: profileQuery.data.discoverableToRecruiters ?? false,
      skills: profileQuery.data.skills ?? [],
      experience: profileQuery.data.experience ?? [],
      education: profileQuery.data.education ?? [],
      certifications: profileQuery.data.certifications ?? [],
      portfolioProjects: profileQuery.data.portfolioProjects ?? [],
      institutionProfile: createInstitutionProfileForm(profileQuery.data.institutionProfile),
    });
  }, [profileQuery.data]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const githubOauthAvailable = profile?.githubOAuthAvailable ?? currentUser?.githubOAuthAvailable ?? false;
  const githubConnected = Boolean(profile?.connectedAccounts?.github?.userId);
  const githubEnabled = Boolean((currentUser?.role === UserRole.STUDENT || currentUser?.role === UserRole.MENTOR) && (githubOauthAvailable || githubConnected));

  const githubRepositoriesQuery = useQuery({
    queryKey: ['profile', 'github-repositories'],
    queryFn: userApi.listGithubRepositories,
    enabled: githubConnected,
  });

  useEffect(() => {
    if (!githubRepositoriesQuery.data) return;
    setSelectedRepoIds(githubRepositoriesQuery.data.filter((repo) => repo.imported).map((repo) => repo.repoId));
  }, [githubRepositoriesQuery.data]);

  useEffect(() => {
    const githubStatus = searchParams.get('github');
    if (!githubStatus) return;

    if (githubStatus === 'connected') {
      setToast('GitHub connected. Your portfolio data has been refreshed.');
      void queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
      void queryClient.invalidateQueries({ queryKey: ['profile', 'github-repositories'] });
    } else if (githubStatus === 'error') {
      setToast(searchParams.get('message') ?? 'GitHub connection failed.');
    }

    const next = new URLSearchParams(searchParams);
    next.delete('github');
    next.delete('message');
    setSearchParams(next, { replace: true });
  }, [queryClient, searchParams, setSearchParams]);

  const updateMutation = useMutation({
    mutationFn: userApi.updateMe,
    onSuccess: (user) => {
      queryClient.setQueryData(['profile', 'me'], user);
      setUser(user);
      setToast('Portfolio profile saved.');
    },
    onError: (error) => setToast(readError(error, 'Unable to update your portfolio right now.')),
  });

  const socialMutation = useMutation({
    mutationFn: userApi.enrichFromSocialLinks,
    onSuccess: ({ user, summary }) => {
      queryClient.setQueryData(['profile', 'me'], user);
      setUser(user);
      setConfirmLinkedinFetch(false);
      setToast(buildSocialToast(summary));
    },
    onError: (error) => setToast(readError(error, 'Unable to fetch LinkedIn data right now.')),
  });

  const startGithubMutation = useMutation({
    mutationFn: () => userApi.startGithubOauth('/dashboard/profile'),
    onSuccess: ({ authorizationUrl }) => window.location.assign(authorizationUrl),
    onError: (error) => setToast(readError(error, 'Unable to start GitHub sign-in.')),
  });

  const importGithubMutation = useMutation({
    mutationFn: userApi.importGithubRepositories,
    onSuccess: ({ user, importedCount }) => {
      queryClient.setQueryData(['profile', 'me'], user);
      setUser(user);
      void queryClient.invalidateQueries({ queryKey: ['profile', 'github-repositories'] });
      setToast(`Imported ${importedCount} repositories into your portfolio.`);
    },
    onError: (error) => setToast(readError(error, 'Unable to import repositories.')),
  });

  const isBusy = updateMutation.isPending || socialMutation.isPending || startGithubMutation.isPending || importGithubMutation.isPending;
  const repoChoices = githubRepositoriesQuery.data ?? [];
  const publicProfileUrl = profile?.profileSlug && typeof window !== 'undefined' ? `${window.location.origin}/students/${profile.profileSlug}` : '';
  const isInstitutionRole = currentUser?.role === UserRole.SCHOOL || currentUser?.role === UserRole.COLLEGE;
  const currentSessionEducation = useMemo(
    () => form.education.find((item) => isInstitutionEducation(item)) ?? null,
    [form.education],
  );
  const editableEducation = useMemo(
    () => form.education.filter((item) => !isInstitutionEducation(item)),
    [form.education],
  );
  const completionStats = useMemo(
    () =>
      isInstitutionRole
        ? [
            { label: 'Specialties', value: form.institutionProfile.specialties.filter(Boolean).length },
            { label: 'Locations', value: form.institutionProfile.locations.filter(Boolean).length },
            {
              label: 'Metrics',
              value: [
                form.institutionProfile.stats.totalInnovationActivities,
                form.institutionProfile.stats.patentsFiled,
                form.institutionProfile.stats.startupsLaunched,
                form.institutionProfile.stats.industryCollaborations,
              ].filter((item) => item.trim()).length,
            },
            { label: 'Startups', value: startupsQuery.data?.length ?? 0 },
          ]
        : [
            { label: 'Skills', value: form.skills.filter((skill) => skill.name.trim()).length },
            { label: 'Experience', value: form.experience.filter((item) => item.title.trim()).length },
            { label: 'Education', value: form.education.filter((item) => item.institution.trim()).length },
            { label: 'Projects', value: form.portfolioProjects.filter((item) => item.title.trim()).length },
            { label: 'Startups', value: startupsQuery.data?.length ?? 0 },
          ],
    [form.education, form.experience, form.institutionProfile, form.portfolioProjects, form.skills, isInstitutionRole, startupsQuery.data?.length],
  );

  if (!currentUser) return null;

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await updateMutation.mutateAsync({
      displayName: form.displayName.trim(),
      avatar: form.avatar.trim(),
      avatarWallpaper: form.avatarWallpaper.trim(),
      bio: form.bio.trim(),
      domain: form.domain.trim(),
      headline: form.headline.trim(),
      location: form.location.trim(),
      linkedinUrl: form.linkedinUrl.trim(),
      websiteUrl: form.websiteUrl.trim(),
      twitterUrl: form.twitterUrl.trim(),
      youtubeUrl: form.youtubeUrl.trim(),
      behanceUrl: form.behanceUrl.trim(),
      dribbbleUrl: form.dribbbleUrl.trim(),
      instagramUrl: form.instagramUrl.trim(),
      researchGateUrl: form.researchGateUrl.trim(),
      mediumUrl: form.mediumUrl.trim(),
      discoverableToRecruiters: currentUser.role === UserRole.STUDENT ? form.discoverableToRecruiters : undefined,
      ...(isInstitutionRole
        ? {
            institutionProfile: {
              institutionName: form.institutionProfile.institutionName.trim(),
              location: form.institutionProfile.location.trim(),
              ...(parseOptionalInteger(form.institutionProfile.totalStudentsEnrolled) !== undefined
                ? { totalStudentsEnrolled: parseOptionalInteger(form.institutionProfile.totalStudentsEnrolled) }
                : {}),
              academicYear: form.institutionProfile.academicYear.trim(),
              ...(parseOptionalInteger(form.institutionProfile.iicStarRating) !== undefined
                ? { iicStarRating: parseOptionalInteger(form.institutionProfile.iicStarRating) }
                : {}),
              organizationType: form.institutionProfile.organizationType.trim(),
              ...(parseOptionalInteger(form.institutionProfile.foundedYear) !== undefined
                ? { foundedYear: parseOptionalInteger(form.institutionProfile.foundedYear) }
                : {}),
              specialties: form.institutionProfile.specialties.filter(Boolean),
              locations: form.institutionProfile.locations.filter(Boolean),
              ...(parseOptionalInteger(form.institutionProfile.alumniCount) !== undefined
                ? { alumniCount: parseOptionalInteger(form.institutionProfile.alumniCount) }
                : {}),
              ...(parseOptionalInteger(form.institutionProfile.employeeCount) !== undefined
                ? { employeeCount: parseOptionalInteger(form.institutionProfile.employeeCount) }
                : {}),
              contactEmail: form.institutionProfile.contactEmail.trim(),
              contactPhone: form.institutionProfile.contactPhone.trim(),
              stats: {
                ...(parseOptionalInteger(form.institutionProfile.stats.totalInnovationActivities) !== undefined
                  ? { totalInnovationActivities: parseOptionalInteger(form.institutionProfile.stats.totalInnovationActivities) }
                  : {}),
                ...(parseOptionalInteger(form.institutionProfile.stats.patentsFiled) !== undefined
                  ? { patentsFiled: parseOptionalInteger(form.institutionProfile.stats.patentsFiled) }
                  : {}),
                ...(parseOptionalInteger(form.institutionProfile.stats.totalMentoringHours) !== undefined
                  ? { totalMentoringHours: parseOptionalInteger(form.institutionProfile.stats.totalMentoringHours) }
                  : {}),
                ...(parseOptionalInteger(form.institutionProfile.stats.startupsLaunched) !== undefined
                  ? { startupsLaunched: parseOptionalInteger(form.institutionProfile.stats.startupsLaunched) }
                  : {}),
                ...(parseOptionalInteger(form.institutionProfile.stats.industryCollaborations) !== undefined
                  ? { industryCollaborations: parseOptionalInteger(form.institutionProfile.stats.industryCollaborations) }
                  : {}),
                ...(parseOptionalInteger(form.institutionProfile.stats.totalHRConnections) !== undefined
                  ? { totalHRConnections: parseOptionalInteger(form.institutionProfile.stats.totalHRConnections) }
                  : {}),
                ...(parseOptionalInteger(form.institutionProfile.stats.studentsPlaced) !== undefined
                  ? { studentsPlaced: parseOptionalInteger(form.institutionProfile.stats.studentsPlaced) }
                  : {}),
                ...(parseOptionalInteger(form.institutionProfile.stats.directShortlistsThisQuarter) !== undefined
                  ? { directShortlistsThisQuarter: parseOptionalInteger(form.institutionProfile.stats.directShortlistsThisQuarter) }
                  : {}),
                ...(form.institutionProfile.stats.topHiringSector.trim()
                  ? { topHiringSector: form.institutionProfile.stats.topHiringSector.trim() }
                  : {}),
              },
            },
          }
        : {
            skills: form.skills.filter((skill) => skill.name.trim()),
            experience: form.experience.filter((item) => item.title.trim() && item.company.trim()),
            education: form.education.filter((item) => !isInstitutionEducation(item) && item.institution.trim()),
            certifications: form.certifications.filter((item) => item.name.trim() && item.issuingOrganization.trim()),
            portfolioProjects: form.portfolioProjects.filter((item) => item.title.trim()),
          }),
    });
  };

  return (
    <div className="space-y-5">
      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg border border-[#0a66c2]/30 bg-white px-4 py-3 text-sm font-semibold text-[#0a66c2] shadow-2xl dark:bg-slate-950">
          {toast}
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#0a66c2]">Portfolio editor</div>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">
              {isInstitutionRole ? 'LinkedIn-style institution page' : 'LinkedIn-style profile contents'}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">
              {isInstitutionRole
                ? 'Schools and colleges use institution-page fields similar to LinkedIn Pages, with overview, specialties, locations, and outcomes instead of personal education and experience.'
                : 'Fill the same sections that render on the portfolio page. LinkedIn and GitHub can still be used as fast-fill sources.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/portfolio" className="inline-flex items-center justify-center rounded-full border border-[#0a66c2] px-4 py-2 text-sm font-semibold text-[#0a66c2] transition hover:bg-[#eef3f8]">
              View portfolio
            </Link>
            {publicProfileUrl ? (
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(publicProfileUrl);
                  setToast('Public link copied.');
                }}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[#0a66c2] px-4 py-2 text-sm font-semibold text-[#0a66c2] transition hover:bg-[#eef3f8]"
              >
                <Copy className="h-4 w-4" />
                Copy link
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <form className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]" onSubmit={saveProfile}>
        <div className="space-y-5">
          <EditorSection title="Intro" icon={<Linkedin className="h-5 w-5" />}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={isInstitutionRole ? 'Page name' : 'Name'} value={form.displayName} onChange={(value) => setForm((current) => ({ ...current, displayName: value }))} />
              <Field label="Avatar URL" type="url" value={form.avatar} onChange={(value) => setForm((current) => ({ ...current, avatar: value }))} />
              <Field label="Avatar wallpaper URL" type="url" value={form.avatarWallpaper} onChange={(value) => setForm((current) => ({ ...current, avatarWallpaper: value }))} />
              <Field label={isInstitutionRole ? 'Industry / focus' : 'Headline / domain'} value={form.domain} onChange={(value) => setForm((current) => ({ ...current, domain: value }))} placeholder={isInstitutionRole ? 'Higher education, K-12, research, innovation' : 'AI, robotics, full-stack engineering'} />
              <Field label={isInstitutionRole ? 'Tagline' : 'Headline'} value={form.headline} onChange={(value) => setForm((current) => ({ ...current, headline: value }))} placeholder={isInstitutionRole ? 'Building research, innovation, and placements at scale' : 'What should people notice first?'} />
              <Field label="LinkedIn URL" type="url" value={form.linkedinUrl} onChange={(value) => setForm((current) => ({ ...current, linkedinUrl: value }))} placeholder="https://linkedin.com/in/..." />
            </div>
            <div className="mt-4">
              <TextArea label="About" value={form.bio} onChange={(value) => setForm((current) => ({ ...current, bio: value }))} rows={5} />
            </div>
            {currentUser.role === UserRole.STUDENT ? (
              <label className="mt-4 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={form.discoverableToRecruiters}
                  onChange={(event) => setForm((current) => ({ ...current, discoverableToRecruiters: event.target.checked }))}
                  className="h-4 w-4 rounded border-slate-400 text-[#0a66c2] focus:ring-[#0a66c2]"
                />
                Visible to recruiters after launch
              </label>
            ) : null}
          </EditorSection>

          {isInstitutionRole ? (
            <>
              <EditorSection title="Institution details" icon={<GraduationCap className="h-5 w-5" />}>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    label="Institution name"
                    value={form.institutionProfile.institutionName}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        institutionProfile: { ...current.institutionProfile, institutionName: value },
                      }))
                    }
                  />
                  <Field
                    label="Headquarters / primary campus"
                    value={form.institutionProfile.location}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        location: value,
                        institutionProfile: { ...current.institutionProfile, location: value },
                      }))
                    }
                  />
                  <Field
                    label="Organization type"
                    value={form.institutionProfile.organizationType}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        institutionProfile: { ...current.institutionProfile, organizationType: value },
                      }))
                    }
                    placeholder={currentUser.role === UserRole.COLLEGE ? 'Private college, public university' : 'School, higher secondary school'}
                  />
                  <Field
                    label="Founded year"
                    type="number"
                    value={form.institutionProfile.foundedYear}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        institutionProfile: { ...current.institutionProfile, foundedYear: value },
                      }))
                    }
                  />
                  <Field
                    label="Total students"
                    type="number"
                    value={form.institutionProfile.totalStudentsEnrolled}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        institutionProfile: { ...current.institutionProfile, totalStudentsEnrolled: value },
                      }))
                    }
                  />
                  <Field
                    label="Academic year"
                    value={form.institutionProfile.academicYear}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        institutionProfile: { ...current.institutionProfile, academicYear: value },
                      }))
                    }
                    placeholder="2026-27"
                  />
                  <Field
                    label="Alumni count"
                    type="number"
                    value={form.institutionProfile.alumniCount}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        institutionProfile: { ...current.institutionProfile, alumniCount: value },
                      }))
                    }
                  />
                  <Field
                    label="Faculty / staff count"
                    type="number"
                    value={form.institutionProfile.employeeCount}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        institutionProfile: { ...current.institutionProfile, employeeCount: value },
                      }))
                    }
                  />
                  <Field
                    label="Public contact email"
                    type="email"
                    value={form.institutionProfile.contactEmail}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        institutionProfile: { ...current.institutionProfile, contactEmail: value },
                      }))
                    }
                  />
                  <Field
                    label="Public contact phone"
                    value={form.institutionProfile.contactPhone}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        institutionProfile: { ...current.institutionProfile, contactPhone: value },
                      }))
                    }
                  />
                  <Field
                    label="IIC rating"
                    type="number"
                    value={form.institutionProfile.iicStarRating}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        institutionProfile: { ...current.institutionProfile, iicStarRating: value },
                      }))
                    }
                  />
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Field
                    label="Specialties / programs"
                    value={form.institutionProfile.specialties.join(', ')}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        institutionProfile: { ...current.institutionProfile, specialties: fromListInput(value) },
                      }))
                    }
                    placeholder="Entrepreneurship, incubation, robotics, placements"
                  />
                  <Field
                    label="Additional locations"
                    value={form.institutionProfile.locations.join(', ')}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        institutionProfile: { ...current.institutionProfile, locations: fromListInput(value) },
                      }))
                    }
                    placeholder="Bengaluru, Hyderabad, Chennai"
                  />
                </div>
              </EditorSection>

              <EditorSection title="Outcomes & metrics" icon={<Rocket className="h-5 w-5" />}>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    label="Innovation activities"
                    type="number"
                    value={form.institutionProfile.stats.totalInnovationActivities}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        institutionProfile: {
                          ...current.institutionProfile,
                          stats: { ...current.institutionProfile.stats, totalInnovationActivities: value },
                        },
                      }))
                    }
                  />
                  <Field
                    label="Patents filed"
                    type="number"
                    value={form.institutionProfile.stats.patentsFiled}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        institutionProfile: {
                          ...current.institutionProfile,
                          stats: { ...current.institutionProfile.stats, patentsFiled: value },
                        },
                      }))
                    }
                  />
                  <Field
                    label="Mentoring hours"
                    type="number"
                    value={form.institutionProfile.stats.totalMentoringHours}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        institutionProfile: {
                          ...current.institutionProfile,
                          stats: { ...current.institutionProfile.stats, totalMentoringHours: value },
                        },
                      }))
                    }
                  />
                  <Field
                    label="Startups launched"
                    type="number"
                    value={form.institutionProfile.stats.startupsLaunched}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        institutionProfile: {
                          ...current.institutionProfile,
                          stats: { ...current.institutionProfile.stats, startupsLaunched: value },
                        },
                      }))
                    }
                  />
                  <Field
                    label="Industry collaborations"
                    type="number"
                    value={form.institutionProfile.stats.industryCollaborations}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        institutionProfile: {
                          ...current.institutionProfile,
                          stats: { ...current.institutionProfile.stats, industryCollaborations: value },
                        },
                      }))
                    }
                  />
                  <Field
                    label="HR connections"
                    type="number"
                    value={form.institutionProfile.stats.totalHRConnections}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        institutionProfile: {
                          ...current.institutionProfile,
                          stats: { ...current.institutionProfile.stats, totalHRConnections: value },
                        },
                      }))
                    }
                  />
                  <Field
                    label="Students placed"
                    type="number"
                    value={form.institutionProfile.stats.studentsPlaced}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        institutionProfile: {
                          ...current.institutionProfile,
                          stats: { ...current.institutionProfile.stats, studentsPlaced: value },
                        },
                      }))
                    }
                  />
                  <Field
                    label="Direct shortlists this quarter"
                    type="number"
                    value={form.institutionProfile.stats.directShortlistsThisQuarter}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        institutionProfile: {
                          ...current.institutionProfile,
                          stats: { ...current.institutionProfile.stats, directShortlistsThisQuarter: value },
                        },
                      }))
                    }
                  />
                  <Field
                    label="Top hiring sector"
                    value={form.institutionProfile.stats.topHiringSector}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        institutionProfile: {
                          ...current.institutionProfile,
                          stats: { ...current.institutionProfile.stats, topHiringSector: value },
                        },
                      }))
                    }
                  />
                </div>
              </EditorSection>
            </>
          ) : null}

          <EditorSection title="Links" icon={<Globe className="h-5 w-5" />}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Website" type="url" value={form.websiteUrl} onChange={(value) => setForm((current) => ({ ...current, websiteUrl: value }))} />
              <Field label="Twitter / X" type="url" value={form.twitterUrl} onChange={(value) => setForm((current) => ({ ...current, twitterUrl: value }))} />
              <Field label="YouTube" type="url" value={form.youtubeUrl} onChange={(value) => setForm((current) => ({ ...current, youtubeUrl: value }))} />
              <Field label="Instagram" type="url" value={form.instagramUrl} onChange={(value) => setForm((current) => ({ ...current, instagramUrl: value }))} />
              <Field label="Behance" type="url" value={form.behanceUrl} onChange={(value) => setForm((current) => ({ ...current, behanceUrl: value }))} />
              <Field label="Dribbble" type="url" value={form.dribbbleUrl} onChange={(value) => setForm((current) => ({ ...current, dribbbleUrl: value }))} />
              <Field label="ResearchGate" type="url" value={form.researchGateUrl} onChange={(value) => setForm((current) => ({ ...current, researchGateUrl: value }))} />
              <Field label="Medium / Blog" type="url" value={form.mediumUrl} onChange={(value) => setForm((current) => ({ ...current, mediumUrl: value }))} />
            </div>
          </EditorSection>

          {!isInstitutionRole ? (
          <EditorSection
            title="Skills"
            icon={<Award className="h-5 w-5" />}
            action={<SmallButton onClick={() => setForm((current) => ({ ...current, skills: [...current.skills, emptySkill()] }))}>Add skill</SmallButton>}
          >
            <div className="space-y-3">
              {form.skills.map((skill, index) => (
                <div key={`${skill.name}-${skill.addedAt}-${index}`} className="grid gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800 md:grid-cols-[1fr,160px,160px,auto]">
                  <Field label="Skill" value={skill.name} onChange={(value) => setForm((current) => ({ ...current, skills: current.skills.map((item, itemIndex) => itemIndex === index ? { ...item, name: value, source: item.source ?? 'manual' } : item) }))} />
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Category</span>
                    <select value={skill.category} onChange={(event) => setForm((current) => ({ ...current, skills: current.skills.map((item, itemIndex) => itemIndex === index ? { ...item, category: event.target.value as ProfileSkill['category'] } : item) }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                      <option value="programming">Programming</option>
                      <option value="design">Design</option>
                      <option value="business">Business</option>
                      <option value="research">Research</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Level</span>
                    <select value={skill.level} onChange={(event) => setForm((current) => ({ ...current, skills: current.skills.map((item, itemIndex) => itemIndex === index ? { ...item, level: event.target.value as ProfileSkill['level'] } : item) }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                      <option value="expert">Expert</option>
                    </select>
                  </label>
                  <button type="button" onClick={() => setForm((current) => ({ ...current, skills: current.skills.filter((_, itemIndex) => itemIndex !== index) }))} className="self-end rounded-full p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {form.skills.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700">No skills yet.</div> : null}
            </div>
          </EditorSection>
          ) : null}

          {!isInstitutionRole ? (
          <EditorSection
            title="Experience"
            icon={<Briefcase className="h-5 w-5" />}
            action={<SmallButton onClick={() => setForm((current) => ({ ...current, experience: [...current.experience, emptyExperience()] }))}>Add experience</SmallButton>}
          >
            <div className="space-y-4">
              {form.experience.map((item, index) => (
                <div key={item._id} className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Title" value={item.title} onChange={(value) => setForm((current) => ({ ...current, experience: current.experience.map((entry, itemIndex) => itemIndex === index ? { ...entry, title: value } : entry) }))} />
                    <Field label="Company" value={item.company} onChange={(value) => setForm((current) => ({ ...current, experience: current.experience.map((entry, itemIndex) => itemIndex === index ? { ...entry, company: value } : entry) }))} />
                    <Field label="Location" value={item.location} onChange={(value) => setForm((current) => ({ ...current, experience: current.experience.map((entry, itemIndex) => itemIndex === index ? { ...entry, location: value } : entry) }))} />
                    <Field label="Skills, comma separated" value={item.skills.join(', ')} onChange={(value) => setForm((current) => ({ ...current, experience: current.experience.map((entry, itemIndex) => itemIndex === index ? { ...entry, skills: fromListInput(value) } : entry) }))} />
                    <Field label="Start date" type="date" value={toDateInput(item.startDate)} onChange={(value) => setForm((current) => ({ ...current, experience: current.experience.map((entry, itemIndex) => itemIndex === index ? { ...entry, startDate: value ? new Date(value).toISOString() : entry.startDate } : entry) }))} />
                    <Field label="End date" type="date" value={toDateInput(item.endDate)} onChange={(value) => setForm((current) => ({ ...current, experience: current.experience.map((entry, itemIndex) => itemIndex === index ? { ...entry, endDate: value ? new Date(value).toISOString() : null } : entry) }))} />
                  </div>
                  <TextArea label="Description" value={item.description} onChange={(value) => setForm((current) => ({ ...current, experience: current.experience.map((entry, itemIndex) => itemIndex === index ? { ...entry, description: value } : entry) }))} rows={3} />
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <input type="checkbox" checked={item.isCurrent} onChange={(event) => setForm((current) => ({ ...current, experience: current.experience.map((entry, itemIndex) => itemIndex === index ? { ...entry, isCurrent: event.target.checked, endDate: event.target.checked ? null : entry.endDate } : entry) }))} className="h-4 w-4 rounded border-slate-400 text-[#0a66c2] focus:ring-[#0a66c2]" />
                      Current role
                    </label>
                    <button type="button" onClick={() => setForm((current) => ({ ...current, experience: current.experience.filter((_, itemIndex) => itemIndex !== index) }))} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              {form.experience.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700">No experience yet.</div> : null}
            </div>
          </EditorSection>
          ) : null}

          {!isInstitutionRole ? (
          <EditorSection
            title="Education"
            icon={<GraduationCap className="h-5 w-5" />}
            action={<SmallButton onClick={() => setForm((current) => ({ ...current, education: [...current.education, emptyEducation()] }))}>Add education</SmallButton>}
          >
            <div className="space-y-4">
              {currentSessionEducation ? (
                <div className="rounded-lg border border-cyan-200 bg-cyan-50/70 p-4 dark:border-cyan-900/60 dark:bg-cyan-950/20">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold text-slate-950 dark:text-white">Current session education</div>
                    <span className="rounded-full bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-300">
                      Invitation token
                    </span>
                  </div>
                  <div className="mt-3 space-y-1">
                    <div className="text-base font-semibold text-slate-950 dark:text-white">{currentSessionEducation.institution}</div>
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                      {[currentSessionEducation.degree, currentSessionEducation.fieldOfStudy].filter(Boolean).join(' in ') || 'Current academic profile'}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {profile?.institutionProfile?.academicYear ? `Academic year ${profile.institutionProfile.academicYear}` : null}
                      {currentSessionEducation.startYear ? `${profile?.institutionProfile?.academicYear ? ' . ' : ''}Started ${currentSessionEducation.startYear}` : null}
                    </div>
                    {currentSessionEducation.description ? (
                      <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{currentSessionEducation.description}</p>
                    ) : null}
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    This entry is synced from your approved institution access, stays locked on your portfolio, and updates automatically when your verified institution changes. Add any previous or future education below.
                  </p>
                </div>
              ) : null}
              {editableEducation.map((item) => (
                <div key={item._id} className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Institution" value={item.institution} onChange={(value) => setForm((current) => ({ ...current, education: current.education.map((entry) => entry._id === item._id ? { ...entry, institution: value } : entry) }))} />
                    <Field label="Degree" value={item.degree} onChange={(value) => setForm((current) => ({ ...current, education: current.education.map((entry) => entry._id === item._id ? { ...entry, degree: value } : entry) }))} />
                    <Field label="Field of study" value={item.fieldOfStudy} onChange={(value) => setForm((current) => ({ ...current, education: current.education.map((entry) => entry._id === item._id ? { ...entry, fieldOfStudy: value } : entry) }))} />
                    <Field label="Grade" value={item.grade} onChange={(value) => setForm((current) => ({ ...current, education: current.education.map((entry) => entry._id === item._id ? { ...entry, grade: value } : entry) }))} />
                    <Field label="Start year" type="number" value={item.startYear?.toString() ?? ''} onChange={(value) => setForm((current) => ({ ...current, education: current.education.map((entry) => entry._id === item._id ? { ...entry, startYear: parseYear(value) ?? undefined } : entry) }))} />
                    <Field label="End year" type="number" value={item.endYear?.toString() ?? ''} onChange={(value) => setForm((current) => ({ ...current, education: current.education.map((entry) => entry._id === item._id ? { ...entry, endYear: parseYear(value) } : entry) }))} />
                  </div>
                  <TextArea label="Activities" value={item.activities} onChange={(value) => setForm((current) => ({ ...current, education: current.education.map((entry) => entry._id === item._id ? { ...entry, activities: value } : entry) }))} rows={2} />
                  <TextArea label="Description" value={item.description} onChange={(value) => setForm((current) => ({ ...current, education: current.education.map((entry) => entry._id === item._id ? { ...entry, description: value } : entry) }))} rows={3} />
                  <div className="flex justify-end">
                    <button type="button" onClick={() => setForm((current) => ({ ...current, education: current.education.filter((entry) => entry._id !== item._id) }))} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              {editableEducation.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700">No additional education yet.</div> : null}
            </div>
          </EditorSection>
          ) : null}

          {!isInstitutionRole ? (
          <EditorSection
            title="Licenses & certifications"
            icon={<Award className="h-5 w-5" />}
            action={<SmallButton onClick={() => setForm((current) => ({ ...current, certifications: [...current.certifications, emptyCertification()] }))}>Add certification</SmallButton>}
          >
            <div className="space-y-4">
              {form.certifications.map((item, index) => (
                <div key={item._id} className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Name" value={item.name} onChange={(value) => setForm((current) => ({ ...current, certifications: current.certifications.map((entry, itemIndex) => itemIndex === index ? { ...entry, name: value } : entry) }))} />
                    <Field label="Issuing organization" value={item.issuingOrganization} onChange={(value) => setForm((current) => ({ ...current, certifications: current.certifications.map((entry, itemIndex) => itemIndex === index ? { ...entry, issuingOrganization: value } : entry) }))} />
                    <Field label="Issue date" type="date" value={toDateInput(item.issueDate)} onChange={(value) => setForm((current) => ({ ...current, certifications: current.certifications.map((entry, itemIndex) => itemIndex === index ? { ...entry, issueDate: value ? new Date(value).toISOString() : null } : entry) }))} />
                    <Field label="Expiry date" type="date" value={toDateInput(item.expiryDate)} onChange={(value) => setForm((current) => ({ ...current, certifications: current.certifications.map((entry, itemIndex) => itemIndex === index ? { ...entry, expiryDate: value ? new Date(value).toISOString() : null } : entry) }))} />
                    <Field label="Credential ID" value={item.credentialId} onChange={(value) => setForm((current) => ({ ...current, certifications: current.certifications.map((entry, itemIndex) => itemIndex === index ? { ...entry, credentialId: value } : entry) }))} />
                    <Field label="Credential URL" type="url" value={item.credentialUrl} onChange={(value) => setForm((current) => ({ ...current, certifications: current.certifications.map((entry, itemIndex) => itemIndex === index ? { ...entry, credentialUrl: value } : entry) }))} />
                  </div>
                  <div className="flex justify-end">
                    <button type="button" onClick={() => setForm((current) => ({ ...current, certifications: current.certifications.filter((_, itemIndex) => itemIndex !== index) }))} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              {form.certifications.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700">No certifications yet.</div> : null}
            </div>
          </EditorSection>
          ) : null}

          {!isInstitutionRole ? (
          <EditorSection
            title="Projects"
            icon={<Rocket className="h-5 w-5" />}
            action={<SmallButton onClick={() => setForm((current) => ({ ...current, portfolioProjects: [...current.portfolioProjects, emptyProject()] }))}>Add project</SmallButton>}
          >
            <div className="space-y-4">
              {form.portfolioProjects.map((item, index) => (
                <div key={item._id} className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Title" value={item.title} onChange={(value) => setForm((current) => ({ ...current, portfolioProjects: current.portfolioProjects.map((entry, itemIndex) => itemIndex === index ? { ...entry, title: value } : entry) }))} />
                    <Field label="Tech stack, comma separated" value={item.techStack.join(', ')} onChange={(value) => setForm((current) => ({ ...current, portfolioProjects: current.portfolioProjects.map((entry, itemIndex) => itemIndex === index ? { ...entry, techStack: fromListInput(value), languages: fromListInput(value) } : entry) }))} />
                    <Field label="Repository URL" type="url" value={item.repoUrl ?? ''} onChange={(value) => setForm((current) => ({ ...current, portfolioProjects: current.portfolioProjects.map((entry, itemIndex) => itemIndex === index ? { ...entry, repoUrl: value || null } : entry) }))} />
                    <Field label="Live URL" type="url" value={item.liveUrl ?? ''} onChange={(value) => setForm((current) => ({ ...current, portfolioProjects: current.portfolioProjects.map((entry, itemIndex) => itemIndex === index ? { ...entry, liveUrl: value || null } : entry) }))} />
                  </div>
                  <TextArea label="Description" value={item.description} onChange={(value) => setForm((current) => ({ ...current, portfolioProjects: current.portfolioProjects.map((entry, itemIndex) => itemIndex === index ? { ...entry, description: value } : entry) }))} rows={3} />
                  <div className="flex justify-end">
                    <button type="button" onClick={() => setForm((current) => ({ ...current, portfolioProjects: current.portfolioProjects.filter((_, itemIndex) => itemIndex !== index) }))} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              {form.portfolioProjects.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700">No projects yet.</div> : null}
            </div>
          </EditorSection>
          ) : null}

          <div className="sticky bottom-4 z-10 flex justify-end">
            <SmallButton type="submit" disabled={isBusy}>
              <Save className="h-4 w-4" />
              {updateMutation.isPending ? 'Saving...' : 'Save portfolio'}
            </SmallButton>
          </div>
        </div>

        <aside className="space-y-5">
          <EditorSection title="Section status" icon={<Linkedin className="h-5 w-5" />}>
            <div className="space-y-3">
              {completionStats.map((stat) => (
                <div key={stat.label} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">{stat.label}</span>
                  <span className="font-semibold text-slate-950 dark:text-white">{stat.value}</span>
                </div>
              ))}
            </div>
          </EditorSection>

          <EditorSection title="LinkedIn fast fill" icon={<Linkedin className="h-5 w-5" />}>
            <div className="space-y-3">
              <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
                {isInstitutionRole
                  ? 'Use this only for a public LinkedIn profile link. Institution pages are edited manually below so your school or college page stays aligned with LinkedIn company and school Page patterns.'
                  : 'Add your public LinkedIn URL, confirm import, then fetch public profile data into these same portfolio fields.'}
              </p>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={confirmLinkedinFetch}
                  onChange={(event) => setConfirmLinkedinFetch(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-400 text-[#0a66c2] focus:ring-[#0a66c2]"
                />
                Import public LinkedIn data
              </label>
              <SmallButton
                onClick={() => socialMutation.mutate({ ...(form.linkedinUrl.trim() ? { linkedinUrl: form.linkedinUrl.trim(), confirmLinkedinFetch } : {}) })}
                disabled={isBusy || !form.linkedinUrl.trim()}
              >
                {socialMutation.isPending ? 'Fetching...' : 'Fetch LinkedIn'}
              </SmallButton>
            </div>
          </EditorSection>

          <EditorSection title="GitHub projects" icon={<Github className="h-5 w-5" />}>
            <div className="space-y-3">
              {githubEnabled ? (
                <>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    {githubConnected
                      ? `Connected as @${profile?.connectedAccounts?.github.username ?? 'github'}`
                      : githubOauthAvailable
                        ? 'Connect GitHub to import repositories as projects.'
                        : 'GitHub OAuth is unavailable in this environment.'}
                  </div>
                  {githubOauthAvailable ? (
                    <SmallButton onClick={() => startGithubMutation.mutate(undefined)} disabled={startGithubMutation.isPending}>
                      {startGithubMutation.isPending ? 'Redirecting...' : githubConnected ? 'Reconnect GitHub' : 'Connect GitHub'}
                    </SmallButton>
                  ) : null}
                  {githubConnected && repoChoices.length > 0 ? (
                    <div className="space-y-3">
                      <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                        {repoChoices.map((repo) => (
                          <RepoRow
                            key={repo.repoId}
                            repo={repo}
                            checked={selectedRepoIds.includes(repo.repoId)}
                            onToggle={() =>
                              setSelectedRepoIds((current) =>
                                current.includes(repo.repoId)
                                  ? current.filter((value) => value !== repo.repoId)
                                  : [...current, repo.repoId],
                              )
                            }
                          />
                        ))}
                      </div>
                      <SmallButton onClick={() => importGithubMutation.mutate(selectedRepoIds)} disabled={importGithubMutation.isPending || selectedRepoIds.length === 0}>
                        {importGithubMutation.isPending ? 'Importing...' : 'Import selected'}
                      </SmallButton>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="text-sm text-slate-600 dark:text-slate-400">GitHub import is available for student and mentor profiles.</div>
              )}
            </div>
          </EditorSection>

          <EditorSection title="Saved links" icon={<Link2 className="h-5 w-5" />}>
            <div className="space-y-2 text-sm">
              {[
                ['Website', form.websiteUrl, Globe],
                ['LinkedIn', form.linkedinUrl, Linkedin],
                ['Twitter', form.twitterUrl, Twitter],
                ['YouTube', form.youtubeUrl, Youtube],
                ['Instagram', form.instagramUrl, Instagram],
                ['Behance', form.behanceUrl, Link2],
              ].map(([label, url, Icon]) => {
                if (!url) return null;
                const LinkIcon = Icon as typeof Globe;
                return (
                  <a key={label as string} href={url as string} target="_blank" rel="noreferrer" className="flex items-center gap-2 font-semibold text-[#0a66c2] hover:underline">
                    <LinkIcon className="h-4 w-4" />
                    {label as string}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                );
              })}
              {!form.websiteUrl && !form.linkedinUrl && !form.twitterUrl && !form.youtubeUrl && !form.instagramUrl && !form.behanceUrl ? (
                <div className="text-sm text-slate-500">No profile links added yet.</div>
              ) : null}
            </div>
          </EditorSection>
        </aside>
      </form>
    </div>
  );
}
