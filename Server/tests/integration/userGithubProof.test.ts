import { User } from '../../src/modules/user/user.model';
import {
  importCurrentUserGithubRepositories,
  syncCurrentUserGithubProof,
} from '../../src/modules/user/user.service';
import { UserRole } from '../../src/types/roles.types';

const createStudent = async (email: string) =>
  User.create({
    email,
    passwordHash: 'hashed',
    role: UserRole.STUDENT,
    displayName: 'Proof Student',
    accessGrantedBy: 'admin',
    accessExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    connectedAccounts: {
      github: {
        userId: '12345',
        username: 'proof-user',
        accessToken: 'github-access-token',
        connectedAt: new Date(),
        lastSyncedAt: null,
      },
      google: {
        userId: null,
        username: null,
        accessToken: null,
        connectedAt: null,
        lastSyncedAt: null,
      },
      linkedin: {
        userId: null,
        username: null,
        accessToken: null,
        connectedAt: null,
        lastSyncedAt: null,
      },
    },
  });

const okJson = (data: unknown) =>
  ({
    ok: true,
    status: 200,
    json: async () => data,
  }) as Response;

describe('github proof sync', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('syncs github proof and keeps private imports out of public portfolio projects', async () => {
    const user = await createStudent('github-proof@example.com');

    jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);

      if (url === 'https://api.github.com/user') {
        return okJson({
          id: 12345,
          login: 'proof-user',
          avatar_url: 'https://avatars.example.com/proof-user.png',
          bio: 'Builds products that ship.',
          blog: 'proof.dev',
          location: 'Bengaluru',
          html_url: 'https://github.com/proof-user',
          public_repos: 1,
        });
      }

      if (url.includes('/user/repos?')) {
        return okJson([
          {
            id: 101,
            name: 'public-proof',
            full_name: 'proof-user/public-proof',
            description: 'Public repo',
            html_url: 'https://github.com/proof-user/public-proof',
            homepage: null,
            language: 'TypeScript',
            stargazers_count: 12,
            forks_count: 3,
            open_issues_count: 2,
            default_branch: 'main',
            private: false,
            fork: false,
            archived: false,
            owner: { login: 'proof-user' },
            pushed_at: '2026-03-29T10:00:00.000Z',
            updated_at: '2026-03-29T10:00:00.000Z',
          },
          {
            id: 202,
            name: 'private-proof',
            full_name: 'proof-user/private-proof',
            description: 'Private repo',
            html_url: 'https://github.com/proof-user/private-proof',
            homepage: null,
            language: 'Go',
            stargazers_count: 4,
            forks_count: 1,
            open_issues_count: 0,
            default_branch: 'main',
            private: true,
            fork: false,
            archived: false,
            owner: { login: 'proof-user' },
            pushed_at: '2026-03-30T09:00:00.000Z',
            updated_at: '2026-03-30T09:00:00.000Z',
          },
        ]);
      }

      if (url.includes('/users/proof-user/events?')) {
        return okJson([
          {
            id: 'evt-push-public',
            type: 'PushEvent',
            public: true,
            created_at: new Date().toISOString(),
            repo: { name: 'proof-user/public-proof' },
            payload: {
              size: 2,
              commits: [{ message: 'Ship proof layer' }],
            },
          },
          {
            id: 'evt-push-private',
            type: 'PushEvent',
            public: false,
            created_at: new Date().toISOString(),
            repo: { name: 'proof-user/private-proof' },
            payload: {
              size: 1,
              commits: [{ message: 'Refine private flow' }],
            },
          },
        ]);
      }

      if (url.endsWith('/repos/proof-user/public-proof/languages')) {
        return okJson({ TypeScript: 1200, CSS: 300 });
      }

      if (url.endsWith('/repos/proof-user/private-proof/languages')) {
        return okJson({ Go: 900 });
      }

      if (url.endsWith('/repos/proof-user/public-proof/commits?per_page=5')) {
        return okJson([
          {
            sha: 'abc1234',
            html_url: 'https://github.com/proof-user/public-proof/commit/abc1234',
            commit: {
              message: 'Ship proof layer',
              author: { date: '2026-03-29T10:00:00.000Z' },
            },
          },
        ]);
      }

      if (url.endsWith('/repos/proof-user/private-proof/commits?per_page=5')) {
        return okJson([
          {
            sha: 'def5678',
            html_url: 'https://github.com/proof-user/private-proof/commit/def5678',
            commit: {
              message: 'Refine private flow',
              author: { date: '2026-03-30T09:00:00.000Z' },
            },
          },
        ]);
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const synced = await syncCurrentUserGithubProof(String(user._id));
    expect(synced.user.githubStats.totalRepos).toBe(1);
    expect(synced.user.githubStats.contributionsLastYear).toBe(2);
    expect(synced.user.githubProof.commitCount30Days).toBe(3);

    const imported = await importCurrentUserGithubRepositories(String(user._id), {
      repoIds: ['101', '202'],
    });

    expect(imported.importedCount).toBe(2);
    expect(imported.user.githubProof.importedRepos).toHaveLength(2);
    expect(imported.user.githubProof.importedRepos.some((repo) => repo.isPrivate)).toBe(true);
    expect(imported.user.portfolioProjects).toHaveLength(1);
    expect(imported.user.portfolioProjects[0].githubRepoId).toBe('101');
  });
});
