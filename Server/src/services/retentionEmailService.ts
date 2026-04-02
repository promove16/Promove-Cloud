import { emailQueue } from '../config/bullmq';
import { env } from '../config/env';
import { redis } from '../config/redis';
import { MentorSession } from '../modules/mentor/mentorSession.model';
import { Patent } from '../modules/patent/patent.model';
import { ScoreEvent } from '../modules/innovationScore/score.model';
import { Settings } from '../modules/settings/settings.model';
import { Startup } from '../modules/startup/startup.model';
import { User } from '../modules/user/user.model';
import { getProfileCompletionProgress } from '../modules/user/profileCompletion';
import { UserRole } from '../types/roles.types';
import { Workspace } from '../modules/workspace/workspace.model';
import { sendEmail } from './emailService';

export type RetentionEmailJobData =
  | { type: 'welcome'; userId: string }
  | { type: 'profile_60_complete'; userId: string }
  | { type: 'mentor_viewed_profile'; userId: string; mentorId: string; viewDateKey: string }
  | { type: 'institution_verified'; userId: string; institutionId: string }
  | { type: 'weekly_progress_summary'; userId: string; weekKey: string };

export type RetentionEmailSchedulerJobData = {
  type: 'weekly_progress_summary_scheduler';
};

const RETENTION_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 60_000 },
  removeOnComplete: 500,
  removeOnFail: 500,
};

const APP_NAME = 'ProMove';
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;
const ONE_WEEK_SECONDS = 7 * 24 * 60 * 60;
const ONE_DAY_SECONDS = 24 * 60 * 60;

const scoreTriggerLabels: Record<string, string> = {
  PROBLEM_CLAIMED: 'Problem claimed',
  SKILL_COMPLETED: 'Skill milestone completed',
  PROGRESS_UPLOADED: 'Progress update shared',
  PATENT_SUBMITTED: 'Patent submitted',
  PATENT_APPROVED: 'Patent approved',
  MVP_VERIFIED: 'MVP verified',
  MARKET_READY_VERIFIED: 'Market readiness verified',
  STARTUP_LAUNCHED: 'Startup launched',
  AWARD_APPROVED: 'Award approved',
  GITHUB_CONNECTED: 'GitHub connected',
  LINKEDIN_CONNECTED: 'LinkedIn connected',
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildUrl = (path = '') => {
  const base = env.CLIENT_URL.replace(/\/+$/, '');
  const suffix = path ? `/${path.replace(/^\/+/, '')}` : '';
  return `${base}${suffix}`;
};

const roleDashboardPath = (role: UserRole) => {
  switch (role) {
    case UserRole.STUDENT:
      return 'dashboard/student';
    case UserRole.MENTOR:
      return 'dashboard/mentor';
    case UserRole.INVESTOR:
      return 'dashboard/investor';
    case UserRole.RECRUITER:
      return 'dashboard/recruiter';
    case UserRole.COLLEGE:
      return 'dashboard/college';
    case UserRole.SCHOOL:
      return 'dashboard/school';
    case UserRole.ADMIN:
      return 'dashboard/admin';
    default:
      return '';
  }
};

const renderEmail = (params: {
  eyebrow?: string;
  title: string;
  intro: string;
  highlights?: string[];
  ctaLabel: string;
  ctaUrl: string;
  footer?: string;
}) => {
  const { eyebrow, title, intro, highlights = [], ctaLabel, ctaUrl, footer } = params;

  return `
    <div style="background:#f4f7fb;padding:32px 16px;font-family:Arial,sans-serif;color:#10213a;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:18px;padding:32px;border:1px solid #d7e2ef;">
        ${eyebrow ? `<p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#51708f;">${escapeHtml(eyebrow)}</p>` : ''}
        <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;color:#10213a;">${escapeHtml(title)}</h1>
        <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#29405c;">${escapeHtml(intro)}</p>
        ${
          highlights.length > 0
            ? `<ul style="margin:0 0 24px;padding-left:20px;color:#29405c;font-size:15px;line-height:1.8;">
                ${highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
              </ul>`
            : ''
        }
        <a href="${ctaUrl}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700;">
          ${escapeHtml(ctaLabel)}
        </a>
        <p style="margin:24px 0 0;font-size:13px;line-height:1.7;color:#6b8099;">
          ${escapeHtml(footer ?? `You're receiving this email from ${APP_NAME}.`)}
        </p>
      </div>
    </div>
  `;
};

const alreadySent = async (key: string) => Boolean(await redis.get<string>(key));

const markSent = async (key: string, ttlSeconds?: number) => {
  await redis.set(key, '1', ttlSeconds ? { ex: ttlSeconds } : undefined);
};

const isPlatformEmailEnabled = async (userId: string) => {
  const settings = await Settings.findOne({ userId }).select('notifications.email.platform').lean();
  return settings?.notifications?.email?.platform ?? true;
};

const queueEmailJob = async (job: RetentionEmailJobData, jobId: string) => {
  await emailQueue.add('retention-email', job, {
    ...RETENTION_JOB_OPTIONS,
    jobId,
  });
};

const getInstitutionLabel = (role?: UserRole | string | null) =>
  role === UserRole.COLLEGE ? 'College' : 'School';

export const getWeeklySummaryWeekKey = (date = new Date()) => {
  const normalized = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = normalized.getUTCDay() || 7;
  normalized.setUTCDate(normalized.getUTCDate() - day + 1);
  return normalized.toISOString().slice(0, 10);
};

const buildWeeklySummary = async (userId: string) => {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [scoreEvents, completedSessions, updatedWorkspaces, patentsSubmitted, startupsLaunched] =
    await Promise.all([
      ScoreEvent.find({ userId, createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(3).lean(),
      MentorSession.countDocuments({
        studentId: userId,
        status: 'Completed',
        scheduledAt: { $gte: since },
      }),
      Workspace.countDocuments({
        $or: [{ ownerId: userId }, { teamMemberIds: userId }],
        updatedAt: { $gte: since },
      }),
      Patent.countDocuments({
        studentId: userId,
        submittedAt: { $gte: since },
      }),
      Startup.countDocuments({
        founderIds: userId,
        launchedAt: { $gte: since },
      }),
    ]);

  const scoreDelta = scoreEvents.reduce((total, event) => total + (event.delta ?? 0), 0);
  const highlights = [
    `Innovation score change: ${scoreDelta >= 0 ? '+' : ''}${scoreDelta} this week`,
    `${completedSessions} mentor session${completedSessions === 1 ? '' : 's'} completed`,
    `${updatedWorkspaces} workspace update${updatedWorkspaces === 1 ? '' : 's'} recorded`,
    `${patentsSubmitted} patent submission${patentsSubmitted === 1 ? '' : 's'} started`,
    `${startupsLaunched} startup launch${startupsLaunched === 1 ? '' : 'es'} recorded`,
  ];

  const recentWins = scoreEvents.map(
    (event) =>
      `${scoreTriggerLabels[event.trigger] ?? event.trigger.replace(/_/g, ' ')} (${event.delta >= 0 ? '+' : ''}${event.delta})`,
  );

  return {
    scoreDelta,
    completedSessions,
    updatedWorkspaces,
    patentsSubmitted,
    startupsLaunched,
    highlights,
    recentWins,
  };
};

export const queueWelcomeEmail = async (userId: string) =>
  queueEmailJob({ type: 'welcome', userId }, `retention:welcome:${userId}`);

export const queueProfileCompletionMilestoneEmail = async (
  userId: string,
  previousPercent: number,
  currentPercent: number,
) => {
  if (previousPercent >= 60 || currentPercent < 60) {
    return;
  }

  await queueEmailJob(
    { type: 'profile_60_complete', userId },
    `retention:profile-60:${userId}`,
  );
};

export const queueMentorViewedProfileEmail = async (userId: string, mentorId: string) => {
  const viewDateKey = new Date().toISOString().slice(0, 10);
  await queueEmailJob(
    { type: 'mentor_viewed_profile', userId, mentorId, viewDateKey },
    `retention:mentor-view:${userId}:${mentorId}:${viewDateKey}`,
  );
};

export const queueInstitutionVerifiedEmail = async (userId: string, institutionId: string) =>
  queueEmailJob(
    { type: 'institution_verified', userId, institutionId },
    `retention:institution-verified:${userId}`,
  );

export const queueWeeklyProgressSummaryEmail = async (
  userId: string,
  weekKey = getWeeklySummaryWeekKey(),
) =>
  queueEmailJob(
    { type: 'weekly_progress_summary', userId, weekKey },
    `retention:weekly-summary:${userId}:${weekKey}`,
  );

export const enqueueWeeklyProgressSummaryEmails = async (weekKey = getWeeklySummaryWeekKey()) => {
  const cursor = User.find({ role: UserRole.STUDENT, isActive: true }).select('_id').lean().cursor();

  for await (const user of cursor) {
    await queueWeeklyProgressSummaryEmail(String(user._id), weekKey);
  }
};

export const createWeeklyProgressSchedulerJob = (): RetentionEmailSchedulerJobData => ({
  type: 'weekly_progress_summary_scheduler',
});

export const sendRetentionEmailJob = async (job: RetentionEmailJobData) => {
  const user = await User.findById(job.userId)
    .select(
      '_id email role displayName avatar bio domain headline location websiteUrl githubUrl linkedinUrl skills experience education portfolioProjects resume verificationStatus adminApprovalStatus institutionId',
    )
    .lean();

  if (!user?.email) {
    return;
  }

  const dashboardUrl = buildUrl(roleDashboardPath(user.role));
  const profileUrl = buildUrl(user.role === UserRole.STUDENT ? 'leadership-profile' : roleDashboardPath(user.role));

  if (job.type === 'welcome') {
    const institution =
      user.institutionId && user.role === UserRole.STUDENT
        ? await User.findById(user.institutionId).select('displayName role').lean()
        : null;

    const waitingForInstitutionApproval = user.role === UserRole.STUDENT && user.verificationStatus === 'pending';
    const waitingForAdminApproval =
      user.role !== UserRole.STUDENT && user.adminApprovalStatus === 'pending';

    let intro = `Welcome to ${APP_NAME}, ${user.displayName}.`;
    const highlights = ['Your account is ready to start building momentum on the platform.'];

    if (waitingForInstitutionApproval && institution) {
      intro = `Welcome to ${APP_NAME}, ${user.displayName}. Your account is in and now waiting for ${institution.displayName} to approve access.`;
      highlights[0] = `You already have a seat reserved. We'll unlock sign-in as soon as your ${getInstitutionLabel(institution.role)} approves you.`;
    } else if (waitingForAdminApproval) {
      intro = `Welcome to ${APP_NAME}, ${user.displayName}. Your registration request has been received and is waiting for admin approval.`;
      highlights[0] = 'We will notify you once your account has been approved and is ready to use.';
    }

    await sendEmail({
      toEmail: user.email,
      subject: `Welcome to ${APP_NAME}`,
      html: renderEmail({
        eyebrow: 'Welcome',
        title: `Welcome to ${APP_NAME}`,
        intro,
        highlights,
        ctaLabel: waitingForInstitutionApproval || waitingForAdminApproval ? 'View ProMove' : 'Open your dashboard',
        ctaUrl: waitingForInstitutionApproval || waitingForAdminApproval ? buildUrl() : dashboardUrl,
      }),
    });

    return;
  }

  if (job.type === 'profile_60_complete') {
    if (!(await isPlatformEmailEnabled(job.userId))) {
      return;
    }

    const sentKey = `retention:sent:profile-60:${job.userId}`;
    if (await alreadySent(sentKey)) {
      return;
    }

    const progress = getProfileCompletionProgress(user);
    if (progress.percent < 60) {
      return;
    }

    await sendEmail({
      toEmail: user.email,
      subject: 'Your profile is 60% complete',
      html: renderEmail({
        eyebrow: 'Profile Momentum',
        title: 'Your profile is 60% complete',
        intro: `You crossed the first strong profile milestone at ${progress.percent}%. A few more details will make your profile much easier for mentors, recruiters, and collaborators to trust.`,
        highlights: progress.missingSections
          .slice(0, 3)
          .map((section) => `Add ${section.label.toLowerCase()} to strengthen your profile`),
        ctaLabel: 'Complete your profile',
        ctaUrl: profileUrl,
      }),
    });

    await markSent(sentKey, ONE_YEAR_SECONDS);
    return;
  }

  if (job.type === 'mentor_viewed_profile') {
    if (!(await isPlatformEmailEnabled(job.userId))) {
      return;
    }

    const sentKey = `retention:sent:mentor-view:${job.userId}:${job.mentorId}:${job.viewDateKey}`;
    if (await alreadySent(sentKey)) {
      return;
    }

    const mentor = await User.findById(job.mentorId).select('displayName').lean();
    if (!mentor) {
      return;
    }

    await sendEmail({
      toEmail: user.email,
      subject: 'Mentor viewed your profile',
      html: renderEmail({
        eyebrow: 'Mentor Signal',
        title: 'Mentor viewed your profile',
        intro: `${mentor.displayName} checked your profile on ${APP_NAME}. This is a good time to make sure your latest work, score, and links are current.`,
        highlights: [
          'Refresh your profile headline and bio',
          'Add any new project progress or portfolio links',
          'Make it easier for mentors to understand your current momentum',
        ],
        ctaLabel: 'Review your profile',
        ctaUrl: profileUrl,
      }),
    });

    await markSent(sentKey, ONE_DAY_SECONDS);
    return;
  }

  if (job.type === 'institution_verified') {
    const sentKey = `retention:sent:institution-verified:${job.userId}`;
    if (await alreadySent(sentKey)) {
      return;
    }

    const institution = await User.findById(job.institutionId).select('displayName role').lean();
    if (!institution) {
      return;
    }

    const institutionLabel = getInstitutionLabel(institution.role);
    await sendEmail({
      toEmail: user.email,
      subject: `${institutionLabel} verified you`,
      html: renderEmail({
        eyebrow: 'Access Unlocked',
        title: `${institutionLabel} verified you`,
        intro: `${institution.displayName} approved your ${APP_NAME} account. You can now sign in and continue building your innovation profile.`,
        highlights: [
          'Your account is now active',
          'You can access your dashboard immediately',
          'Your next best step is to complete your profile and update your current work',
        ],
        ctaLabel: 'Open ProMove',
        ctaUrl: dashboardUrl,
      }),
    });

    await markSent(sentKey, ONE_YEAR_SECONDS);
    return;
  }

  if (job.type === 'weekly_progress_summary') {
    if (!(await isPlatformEmailEnabled(job.userId))) {
      return;
    }

    const sentKey = `retention:sent:weekly-summary:${job.userId}:${job.weekKey}`;
    if (await alreadySent(sentKey)) {
      return;
    }

    const summary = await buildWeeklySummary(job.userId);
    const progress = getProfileCompletionProgress(user);
    const hasActivity =
      summary.scoreDelta !== 0 ||
      summary.completedSessions > 0 ||
      summary.updatedWorkspaces > 0 ||
      summary.patentsSubmitted > 0 ||
      summary.startupsLaunched > 0;

    await sendEmail({
      toEmail: user.email,
      subject: `Your weekly ${APP_NAME} progress summary`,
      html: renderEmail({
        eyebrow: 'Weekly Summary',
        title: `Your weekly ${APP_NAME} progress summary`,
        intro: hasActivity
          ? 'Here is a quick snapshot of your last 7 days on ProMove.'
          : `No new milestones were recorded this week. Re-open ${APP_NAME} and log one meaningful update to keep your momentum moving.`,
        highlights: hasActivity
          ? [...summary.highlights, ...summary.recentWins].slice(0, 5)
          : progress.percent < 60
            ? progress.missingSections
                .slice(0, 3)
                .map((section) => `Complete ${section.label.toLowerCase()} on your profile`)
            : ['Upload one workspace update', 'Book or complete one mentor session', 'Push one visible milestone this week'],
        ctaLabel: 'View your dashboard',
        ctaUrl: dashboardUrl,
      }),
    });

    await markSent(sentKey, ONE_WEEK_SECONDS);
  }
};
