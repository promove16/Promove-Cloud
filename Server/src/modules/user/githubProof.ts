import { randomUUID } from 'crypto';
import { env } from '../../config/env';
import { redis } from '../../config/redis';
import { ApiError } from '../../utils/ApiError';
import { sanitizePlainText } from '../../utils/sanitizeText';
import { IUser, GithubActivityEvent, GithubImportedRepo, GithubRecentCommit } from './user.types';

const GITHUB_ACCEPT = 'application/vnd.github+json';
const GITHUB_API_VERSION = '2022-11-28';
const GITHUB_OAUTH_STATE_TTL_SECONDS = 10 * 60;
const MAX_REPOSITORIES = 100;
const MAX_IMPORTED_REPOS = 8;
const MAX_RECENT_COMMITS = 5;
const MAX_RECENT_ACTIVITY = 12;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

type GithubAuthTokenResponse = {
  access_token?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type GithubAuthenticatedUserResponse = {
  id: number;
  login: string;
  avatar_url: string;
  bio: string | null;
  blog: string | null;
  location: string | null;
  html_url: string;
  public_repos: number;
};

type GithubRepositoryResponse = {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  default_branch: string;
  private: boolean;
  fork: boolean;
  archived: boolean;
  owner: {
    login: string;
  };
  pushed_at: string | null;
  updated_at: string;
};

type GithubLanguagesResponse = Record<string, number>;

type GithubCommitResponse = {
  sha: string;
  html_url: string | null;
  commit?: {
    message?: string;
    author?: {
      date?: string;
    };
  };
};

type GithubEventResponse = {
  id: string;
  type: string;
  created_at: string;
  public: boolean;
  repo?: {
    name: string;
  };
  payload?: {
    size?: number;
    commits?: Array<{
      sha?: string;
      message?: string;
      url?: string;
    }>;
    action?: string;
    pull_request?: {
      title?: string;
      html_url?: string;
    };
    issue?: {
      title?: string;
      html_url?: string;
    };
    release?: {
      name?: string;
      html_url?: string;
    };
    forkee?: {
      full_name?: string;
      html_url?: string;
    };
  };
};

export type GithubRepositoryChoice = {
  repoId: string;
  name: string;
  fullName: string;
  description: string;
  url: string;
  primaryLanguage: string | null;
  stars: number;
  forks: number;
  isPrivate: boolean;
  pushedAt: string | null;
  imported: boolean;
};

export const isGithubOauthAvailable = () =>
  Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET && env.GITHUB_OAUTH_CALLBACK_URL);

const ensureGithubOAuthConfigured = () => {
  if (!isGithubOauthAvailable()) {
    throw new ApiError(
      503,
      'GITHUB_OAUTH_NOT_CONFIGURED',
      'GitHub OAuth is not configured for this environment.',
    );
  }

  return {
    clientId: env.GITHUB_CLIENT_ID as string,
    clientSecret: env.GITHUB_CLIENT_SECRET as string,
    callbackUrl: env.GITHUB_OAUTH_CALLBACK_URL as string,
  };
};

const getGithubAccessToken = (user: IUser) => {
  const accessToken = user.connectedAccounts.github.accessToken;

  if (!accessToken) {
    throw new ApiError(400, 'GITHUB_NOT_CONNECTED', 'Connect GitHub before importing proof.');
  }

  return accessToken;
};

const githubFetch = async <T>(path: string, accessToken: string, fallbackErrorMessage: string) => {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: GITHUB_ACCEPT,
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'ProMove-Innovation-Cloud',
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
    },
  });

  if (response.status === 401) {
    throw new ApiError(401, 'GITHUB_REAUTH_REQUIRED', 'GitHub access expired. Reconnect your account.');
  }

  if (response.status === 403) {
    throw new ApiError(502, 'GITHUB_API_FORBIDDEN', 'GitHub rejected the request right now.');
  }

  if (!response.ok) {
    throw new ApiError(502, 'GITHUB_API_ERROR', fallbackErrorMessage);
  }

  return (await response.json()) as T;
};

const exchangeGithubCodeForAccessToken = async (code: string) => {
  const { clientId, clientSecret, callbackUrl } = ensureGithubOAuthConfigured();

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'ProMove-Innovation-Cloud',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: callbackUrl,
    }),
  });

  if (!response.ok) {
    throw new ApiError(502, 'GITHUB_TOKEN_EXCHANGE_FAILED', 'Unable to complete GitHub sign-in.');
  }

  const payload = (await response.json()) as GithubAuthTokenResponse;
  if (!payload.access_token) {
    throw new ApiError(
      502,
      'GITHUB_TOKEN_EXCHANGE_FAILED',
      payload.error_description || 'Unable to complete GitHub sign-in.',
    );
  }

  return payload.access_token;
};

const normalizeOptionalUrl = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const determineGithubSkillLevel = (percentage: number): IUser['skills'][number]['level'] => {
  if (percentage > 40) return 'advanced';
  if (percentage > 15) return 'intermediate';
  return 'beginner';
};

const getDefaultGithubProof = (): IUser['githubProof'] => ({
  importedRepoIds: [],
  importedRepos: [],
  recentActivity: [],
  commitCount30Days: 0,
  activeDays30Days: 0,
  pushEvents30Days: 0,
  pullRequests30Days: 0,
  issues30Days: 0,
  lastSyncedAt: null,
});

const mapRecentCommit = (commit: GithubCommitResponse): GithubRecentCommit => ({
  sha: commit.sha,
  message: sanitizePlainText(commit.commit?.message?.split('\n')[0] ?? 'Commit'),
  committedAt: new Date(commit.commit?.author?.date ?? new Date().toISOString()),
  url: commit.html_url ?? null,
});

const mapActivityType = (eventType: string): GithubActivityEvent['type'] => {
  if (eventType === 'PushEvent') return 'push';
  if (eventType === 'PullRequestEvent') return 'pull_request';
  if (eventType === 'IssuesEvent') return 'issue';
  if (eventType === 'ReleaseEvent') return 'release';
  if (eventType === 'ForkEvent') return 'fork';
  if (eventType === 'WatchEvent') return 'watch';
  return 'other';
};

const mapActivityEvent = (event: GithubEventResponse): GithubActivityEvent => {
  const repoFullName = event.repo?.name ?? 'Unknown repository';
  const repoUrl = `https://github.com/${repoFullName}`;
  const eventType = mapActivityType(event.type);
  const commitCount = event.type === 'PushEvent' ? event.payload?.size ?? event.payload?.commits?.length ?? 1 : 0;

  if (eventType === 'push') {
    const firstMessage = event.payload?.commits?.[0]?.message;
    return {
      id: event.id,
      type: eventType,
      repoFullName,
      title: `Pushed ${commitCount} ${commitCount === 1 ? 'commit' : 'commits'}`,
      summary: sanitizePlainText(firstMessage?.split('\n')[0] ?? `Updated ${repoFullName}`),
      url: repoUrl,
      occurredAt: new Date(event.created_at),
      commitCount,
      isPrivate: !event.public,
    };
  }

  if (eventType === 'pull_request') {
    const action = event.payload?.action ? sanitizePlainText(event.payload.action) : 'updated';
    const title = sanitizePlainText(event.payload?.pull_request?.title ?? 'Pull request');
    return {
      id: event.id,
      type: eventType,
      repoFullName,
      title: `${action} pull request`,
      summary: title,
      url: event.payload?.pull_request?.html_url ?? repoUrl,
      occurredAt: new Date(event.created_at),
      commitCount: 0,
      isPrivate: !event.public,
    };
  }

  if (eventType === 'issue') {
    const action = event.payload?.action ? sanitizePlainText(event.payload.action) : 'updated';
    const title = sanitizePlainText(event.payload?.issue?.title ?? 'Issue');
    return {
      id: event.id,
      type: eventType,
      repoFullName,
      title: `${action} issue`,
      summary: title,
      url: event.payload?.issue?.html_url ?? repoUrl,
      occurredAt: new Date(event.created_at),
      commitCount: 0,
      isPrivate: !event.public,
    };
  }

  if (eventType === 'release') {
    return {
      id: event.id,
      type: eventType,
      repoFullName,
      title: 'Published release',
      summary: sanitizePlainText(event.payload?.release?.name ?? repoFullName),
      url: event.payload?.release?.html_url ?? repoUrl,
      occurredAt: new Date(event.created_at),
      commitCount: 0,
      isPrivate: !event.public,
    };
  }

  if (eventType === 'fork') {
    return {
      id: event.id,
      type: eventType,
      repoFullName,
      title: 'Forked repository',
      summary: sanitizePlainText(event.payload?.forkee?.full_name ?? repoFullName),
      url: event.payload?.forkee?.html_url ?? repoUrl,
      occurredAt: new Date(event.created_at),
      commitCount: 0,
      isPrivate: !event.public,
    };
  }

  if (eventType === 'watch') {
    return {
      id: event.id,
      type: eventType,
      repoFullName,
      title: 'Starred repository',
      summary: sanitizePlainText(repoFullName),
      url: repoUrl,
      occurredAt: new Date(event.created_at),
      commitCount: 0,
      isPrivate: !event.public,
    };
  }

  return {
    id: event.id,
    type: eventType,
    repoFullName,
    title: sanitizePlainText(event.type.replace(/Event$/, '').replace(/([a-z])([A-Z])/g, '$1 $2')),
    summary: sanitizePlainText(repoFullName),
    url: repoUrl,
    occurredAt: new Date(event.created_at),
    commitCount: 0,
    isPrivate: !event.public,
  };
};

const buildGithubStats = (
  repos: GithubRepositoryResponse[],
  activity: GithubActivityEvent[],
): IUser['githubStats'] => {
  const ownedRepos = repos.filter((repo) => !repo.fork && !repo.private);
  const totalStars = ownedRepos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
  const totalForks = ownedRepos.reduce((sum, repo) => sum + repo.forks_count, 0);
  const languageCounts = ownedRepos.reduce<Record<string, number>>((acc, repo) => {
    if (repo.language) {
      acc[repo.language] = (acc[repo.language] ?? 0) + 1;
    }
    return acc;
  }, {});
  const totalLanguageMentions = Object.values(languageCounts).reduce((sum, count) => sum + count, 0);
  const topLanguages = Object.entries(languageCounts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([language, count]) => ({
      language,
      percentage: totalLanguageMentions > 0 ? Number(((count / totalLanguageMentions) * 100).toFixed(1)) : 0,
    }));

  const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
  const contributionsLastYear = activity
    .filter((event) => event.type === 'push' && !event.isPrivate && event.occurredAt.getTime() >= oneYearAgo)
    .reduce((sum, event) => sum + event.commitCount, 0);

  return {
    totalRepos: ownedRepos.length,
    totalStars,
    totalForks,
    topLanguages,
    contributionsLastYear,
    lastSyncedAt: new Date(),
  };
};

const buildGithubSkills = (stats: IUser['githubStats']): IUser['skills'] =>
  stats.topLanguages.map((entry) => ({
    name: entry.language,
    category: 'programming' as const,
    source: 'github' as const,
    level: determineGithubSkillLevel(entry.percentage),
    endorsements: 0,
    addedAt: new Date(),
  }));

const buildGithubProofSummary = (activity: GithubActivityEvent[]): IUser['githubProof'] => {
  const proof = getDefaultGithubProof();
  const recentWindowStart = Date.now() - THIRTY_DAYS_MS;
  const windowEvents = activity.filter((event) => event.occurredAt.getTime() >= recentWindowStart);

  proof.recentActivity = activity.slice(0, MAX_RECENT_ACTIVITY);
  proof.commitCount30Days = windowEvents
    .filter((event) => event.type === 'push')
    .reduce((sum, event) => sum + event.commitCount, 0);
  proof.pushEvents30Days = windowEvents.filter((event) => event.type === 'push').length;
  proof.pullRequests30Days = windowEvents.filter((event) => event.type === 'pull_request').length;
  proof.issues30Days = windowEvents.filter((event) => event.type === 'issue').length;
  proof.activeDays30Days = new Set(
    windowEvents.map((event) => event.occurredAt.toISOString().slice(0, 10)),
  ).size;
  proof.lastSyncedAt = new Date();

  return proof;
};

const mapImportedRepoToPortfolioProject = (
  repo: GithubImportedRepo,
): Omit<IUser['portfolioProjects'][number], '_id'> => ({
  title: repo.name,
  description: repo.description,
  techStack: repo.languages,
  repoUrl: repo.url,
  liveUrl: null,
  coverImageUrl: null,
  startDate: null,
  endDate: null,
  isCurrent: true,
  source: 'github',
  githubRepoId: repo.repoId,
  stars: repo.stars,
  forks: repo.forks,
  languages: repo.languages,
});

const hydrateImportedRepository = async (
  repo: GithubRepositoryResponse,
  accessToken: string,
): Promise<GithubImportedRepo> => {
  const [languages, commits] = await Promise.all([
    githubFetch<GithubLanguagesResponse>(
      `/repos/${repo.full_name}/languages`,
      accessToken,
      `Unable to fetch languages for ${repo.full_name}.`,
    ).catch(() => ({})),
    githubFetch<GithubCommitResponse[]>(
      `/repos/${repo.full_name}/commits?per_page=${MAX_RECENT_COMMITS}`,
      accessToken,
      `Unable to fetch commits for ${repo.full_name}.`,
    ).catch(() => []),
  ]);

  return {
    repoId: String(repo.id),
    name: repo.name,
    fullName: repo.full_name,
    description: sanitizePlainText(repo.description ?? ''),
    url: repo.html_url,
    owner: repo.owner.login,
    isPrivate: repo.private,
    defaultBranch: repo.default_branch,
    primaryLanguage: repo.language ?? null,
    languages: Object.keys(languages).slice(0, 6),
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    openIssues: repo.open_issues_count,
    pushedAt: repo.pushed_at ? new Date(repo.pushed_at) : null,
    importedAt: new Date(),
    recentCommits: commits.slice(0, MAX_RECENT_COMMITS).map(mapRecentCommit),
  };
};

const fetchAuthenticatedGithubUser = async (accessToken: string) =>
  githubFetch<GithubAuthenticatedUserResponse>('/user', accessToken, 'Unable to fetch GitHub account.');

const fetchAccessibleRepositories = async (accessToken: string) =>
  githubFetch<GithubRepositoryResponse[]>(
    `/user/repos?sort=updated&per_page=${MAX_REPOSITORIES}&affiliation=owner,collaborator&visibility=all`,
    accessToken,
    'Unable to fetch GitHub repositories.',
  );

const fetchGithubActivity = async (accessToken: string, username: string) => {
  const events = await githubFetch<GithubEventResponse[]>(
    `/users/${encodeURIComponent(username)}/events?per_page=100`,
    accessToken,
    'Unable to fetch GitHub activity.',
  ).catch(() => []);

  return events.map(mapActivityEvent).sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime());
};

const normalizeReturnTo = (returnTo?: string) => {
  if (!returnTo) {
    return '/portfolio';
  }

  if (!returnTo.startsWith('/')) {
    return '/portfolio';
  }

  if (returnTo.startsWith('//') || returnTo.startsWith('/api/')) {
    return '/portfolio';
  }

  return returnTo;
};

export const createGithubOauthStart = async (userId: string, returnTo?: string) => {
  const { clientId, callbackUrl } = ensureGithubOAuthConfigured();
  const state = randomUUID();
  const safeReturnTo = normalizeReturnTo(returnTo);

  await redis.set(
    `github-oauth:${state}`,
    JSON.stringify({
      userId,
      returnTo: safeReturnTo,
      createdAt: new Date().toISOString(),
    }),
    { ex: GITHUB_OAUTH_STATE_TTL_SECONDS },
  );

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope: 'read:user repo',
    state,
    allow_signup: 'false',
  });

  return {
    authorizationUrl: `https://github.com/login/oauth/authorize?${params.toString()}`,
  };
};

export const consumeGithubOauthState = async (state: string) => {
  const cacheKey = `github-oauth:${state}`;
  const raw = await redis.get<string>(cacheKey);

  if (!raw) {
    throw new ApiError(400, 'GITHUB_OAUTH_STATE_INVALID', 'GitHub sign-in expired. Start again.');
  }

  await redis.del(cacheKey);

  const payload = JSON.parse(raw) as { userId?: string; returnTo?: string };
  if (!payload.userId) {
    throw new ApiError(400, 'GITHUB_OAUTH_STATE_INVALID', 'GitHub sign-in expired. Start again.');
  }

  return {
    userId: payload.userId,
    returnTo: normalizeReturnTo(payload.returnTo),
  };
};

export const resolveGithubOauthCallback = async (code: string) => exchangeGithubCodeForAccessToken(code);

export const syncGithubProofForUser = async (user: IUser) => {
  const accessToken = getGithubAccessToken(user);
  const githubUser = await fetchAuthenticatedGithubUser(accessToken);
  const [repos, activity] = await Promise.all([
    fetchAccessibleRepositories(accessToken),
    fetchGithubActivity(accessToken, githubUser.login),
  ]);

  user.connectedAccounts.github = {
    ...user.connectedAccounts.github,
    userId: String(githubUser.id),
    username: githubUser.login,
    accessToken,
    connectedAt: user.connectedAccounts.github.connectedAt ?? new Date(),
    lastSyncedAt: new Date(),
  };

  if (!user.avatar && githubUser.avatar_url) {
    user.avatar = githubUser.avatar_url;
  }

  if ((!user.bio || user.bio.trim().length === 0) && githubUser.bio) {
    user.bio = sanitizePlainText(githubUser.bio);
  }

  if ((!user.websiteUrl || user.websiteUrl.trim().length === 0) && githubUser.blog) {
    user.websiteUrl = normalizeOptionalUrl(githubUser.blog);
  }

  if ((!user.location || user.location.trim().length === 0) && githubUser.location) {
    user.location = sanitizePlainText(githubUser.location);
  }

  user.githubUrl = githubUser.html_url;
  user.githubStats = buildGithubStats(repos, activity);
  user.skills = [...(user.skills ?? []).filter((skill) => skill.source !== 'github'), ...buildGithubSkills(user.githubStats)];

  const currentProof = user.githubProof ?? getDefaultGithubProof();
  const importedRepoIds = Array.from(new Set(currentProof.importedRepoIds ?? [])).slice(0, MAX_IMPORTED_REPOS);
  const selectedRepos = repos.filter((repo) => importedRepoIds.includes(String(repo.id)));
  const importedRepos = await Promise.all(
    selectedRepos.map((repo) => hydrateImportedRepository(repo, accessToken)),
  );

  user.githubProof = {
    ...buildGithubProofSummary(activity),
    importedRepoIds: importedRepos.map((repo) => repo.repoId),
    importedRepos,
  };
  user.portfolioProjects = [
    ...(user.portfolioProjects ?? []).filter((project) => project.source !== 'github'),
    ...importedRepos
      .filter((repo) => !repo.isPrivate)
      .map((repo) => mapImportedRepoToPortfolioProject(repo) as IUser['portfolioProjects'][number]),
  ];

  return {
    githubUser,
    repositoryCount: repos.length,
  };
};

export const listGithubRepositoryChoices = async (user: IUser): Promise<GithubRepositoryChoice[]> => {
  const accessToken = getGithubAccessToken(user);
  const repos = await fetchAccessibleRepositories(accessToken);
  const importedIds = new Set((user.githubProof?.importedRepoIds ?? []).map(String));

  return repos
    .sort(
      (left, right) =>
        new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime(),
    )
    .map((repo) => ({
      repoId: String(repo.id),
      name: repo.name,
      fullName: repo.full_name,
      description: sanitizePlainText(repo.description ?? ''),
      url: repo.html_url,
      primaryLanguage: repo.language ?? null,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      isPrivate: repo.private,
      pushedAt: repo.pushed_at,
      imported: importedIds.has(String(repo.id)),
    }));
};

export const replaceImportedGithubRepositories = async (user: IUser, repoIds: string[]) => {
  const normalizedRepoIds = Array.from(new Set(repoIds.map(String))).slice(0, MAX_IMPORTED_REPOS);
  user.githubProof = {
    ...(user.githubProof ?? getDefaultGithubProof()),
    importedRepoIds: normalizedRepoIds,
    importedRepos: [],
  };

  await syncGithubProofForUser(user);

  return {
    importedCount: user.githubProof.importedRepos.length,
  };
};
