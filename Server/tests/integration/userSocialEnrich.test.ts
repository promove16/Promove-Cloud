import { scoreQueue } from '../../src/config/bullmq';
import { User } from '../../src/modules/user/user.model';
import { enrichCurrentUserFromSocialLinks } from '../../src/modules/user/user.service';
import { UserRole } from '../../src/types/roles.types';

const createStudent = async (email: string) =>
  User.create({
    email,
    passwordHash: 'hashed',
    role: UserRole.STUDENT,
    displayName: 'Score Student',
    accessGrantedBy: 'admin',
    accessExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  });

describe('user social enrichment', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('saves LinkedIn URL without fetching when consent is not confirmed', async () => {
    const user = await createStudent('linkedin-save-only@example.com');
    const fetchSpy = jest.spyOn(global, 'fetch');
    const scoreAddSpy = jest.spyOn(scoreQueue, 'add');

    const result = await enrichCurrentUserFromSocialLinks(String(user._id), {
      linkedinUrl: 'https://www.linkedin.com/in/jane-doe/',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(scoreAddSpy).not.toHaveBeenCalled();
    expect(result.user.linkedinUrl).toBe('https://www.linkedin.com/in/jane-doe/');
    expect(result.summary.linkedinImported).toBe(false);
    expect(result.summary.warnings).toContain(
      'LinkedIn URL was saved, but profile data was not fetched because you did not confirm the LinkedIn import.',
    );
  });

  it('fetches LinkedIn data, updates the profile, and queues scoring when consent is confirmed', async () => {
    const user = await createStudent('linkedin-import@example.com');
    const scoreAddSpy = jest.spyOn(scoreQueue, 'add');
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => `
        <html>
          <head>
            <title>Jane Doe - Product Designer at Acme | LinkedIn</title>
            <meta property="og:url" content="https://www.linkedin.com/in/jane-doe" />
            <meta property="og:image" content="https://cdn.example.com/jane.jpg" />
          </head>
          <body>
            <h1 class="top-card-layout__title">Jane Doe</h1>
            <h2 class="top-card-layout__headline">Product Designer at Acme</h2>
            <div class="top-card-layout__first-subline">
              <span class="top-card__subline-item">Bengaluru, Karnataka, India</span>
            </div>
            <section>
              <h2>About</h2>
              <div class="show-more-less-text">
                <span>Design systems, UX strategy, and product thinking.</span>
              </div>
            </section>
          </body>
        </html>
      `,
    } as Response);

    const result = await enrichCurrentUserFromSocialLinks(String(user._id), {
      linkedinUrl: 'https://www.linkedin.com/in/jane-doe/',
      confirmLinkedinFetch: true,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.summary.linkedinImported).toBe(true);
    expect(result.summary.importedProfileFields).toBe(4);
    expect(result.summary.warnings).toEqual([]);
    expect(result.user.linkedinUrl).toBe('https://www.linkedin.com/in/jane-doe');
    expect(result.user.headline).toBe('Product Designer at Acme');
    expect(result.user.location).toBe('Bengaluru, Karnataka, India');
    expect(result.user.bio).toBe('Design systems, UX strategy, and product thinking.');
    expect(result.user.avatar).toBe('https://cdn.example.com/jane.jpg');
    expect(result.user.connectedAccounts.linkedin.userId).toBe('in/jane-doe');
    expect(result.user.connectedAccounts.linkedin.username).toBe('jane-doe');
    expect(scoreAddSpy).toHaveBeenCalledWith(
      'apply-score',
      expect.objectContaining({
        userId: String(user._id),
        trigger: 'LINKEDIN_CONNECTED',
      }),
      expect.objectContaining({
        attempts: 3,
      }),
    );
  });
});
