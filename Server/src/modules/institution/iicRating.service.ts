import { Event } from '../event/event.model';
import { InstitutionMentorshipProgram } from '../mentor/mentorshipProgram.model';

export type InstitutionPolicyStatus = 'Active' | 'On Track' | 'Pending' | 'Inactive';

export type IicInstitutionPolicy = {
  status: InstitutionPolicyStatus;
  lastUpdated?: Date;
};

export type IicTelemetryInput = {
  totalStudents: number;
  activeProjects: number;
  totalInnovationActivities: number;
  patentsFiled: number;
  totalMentoringHours: number;
  startupsLaunched: number;
  industryCollaborations: number;
  structuredActivityCount: number;
  activeQuarterCount: number;
  policies: IicInstitutionPolicy[];
};

export type IicTelemetrySnapshot = {
  structuredActivityCount: number;
  activeQuarterCount: number;
};

export type IicRatingResult = {
  activityScore: number;
  participationScore: number;
  totalScore: number;
  starRating: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const ratio = (value: number, threshold: number) => clamp(value / threshold, 0, 1);
const round2 = (value: number) => Number(value.toFixed(2));

function getQuarterKey(date: Date) {
  return `${date.getUTCFullYear()}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
}

export function scoreToIicStarRating(score: number) {
  if (score <= 0) return 0;
  if (score <= 20) return 1;
  if (score <= 40) return 2;
  if (score <= 60) return 3;
  if (score <= 75) return 3.5;
  if (score <= 90) return 4;
  if (score <= 95) return 4.5;
  return 5;
}

export async function getInstitutionIicTelemetry(
  institutionId: string,
  institutionType: 'school' | 'college',
): Promise<IicTelemetrySnapshot> {
  const academicWindowStart = new Date();
  academicWindowStart.setUTCFullYear(academicWindowStart.getUTCFullYear() - 1);

  const [events, mentorshipPrograms] = await Promise.all([
    Event.find({
      institutionId,
      isActive: true,
      scheduledAt: { $gte: academicWindowStart },
    })
      .select('scheduledAt createdAt')
      .lean(),
    InstitutionMentorshipProgram.find({
      institutionId,
      institutionType,
      status: 'Assigned',
      scheduledAt: { $gte: academicWindowStart },
    })
      .select('scheduledAt createdAt')
      .lean(),
  ]);

  const activityDates = [
    ...events.map((event) => event.scheduledAt ?? event.createdAt),
    ...mentorshipPrograms.map((program) => program.scheduledAt ?? program.createdAt),
  ];

  return {
    structuredActivityCount: events.length + mentorshipPrograms.length,
    activeQuarterCount: Math.min(new Set(activityDates.map((date) => getQuarterKey(date))).size, 4),
  };
}

export function calculateEstimatedIicRating(input: IicTelemetryInput): IicRatingResult {
  const policyCount = input.policies.length;
  const strongPolicies = input.policies.filter(
    (policy) => policy.status === 'Active' || policy.status === 'On Track',
  ).length;
  const recentlyUpdatedPolicies = input.policies.filter((policy) => {
    if (!policy.lastUpdated) {
      return false;
    }

    return policy.lastUpdated.getTime() >= Date.now() - 365 * 24 * 60 * 60 * 1000;
  }).length;

  const policyCoverage = policyCount > 0 ? strongPolicies / policyCount : 0;
  const policyFreshness = policyCount > 0 ? recentlyUpdatedPolicies / policyCount : 0;
  const structuredCadence = ratio(input.structuredActivityCount, 12);
  const quarterCadence = ratio(input.activeQuarterCount, 4);

  /*
   * Research basis:
   * - The IIC portal's 2023-24 annual performance report uses Total Score = Activity(A)*80% + Participation(B)*20%.
   * - The same report publishes star bands:
   *   <=20 => 1, <=40 => 2, <=60 => 3, <=75 => 3.5, <=90 => 4, <=95 => 4.5, <=100 => 5.
   * - The platform does not currently store every raw portal input (for example YUKTI verification,
   *   Innovation Ambassador counts, ATL mentoring, or explicit MIC-driven submissions), so this
   *   implementation estimates each official bucket from the institution telemetry ProMove does track.
   * - The annual 12-activity cadence below follows the commonly cited IIC expectation of roughly
   *   three structured activities per quarter for full calendar coverage.
   */
  const calendarActivitiesScore = 40 * structuredCadence;
  const micDrivenProxyScore = 20 * ((policyCoverage * 0.65) + (policyFreshness * 0.35));
  const celebrationActivitiesScore = 10 * quarterCadence;
  const selfDrivenActivitiesScore =
    30 *
    (
      ratio(input.totalInnovationActivities, 30) * 0.3 +
      ratio(input.patentsFiled, 10) * 0.25 +
      ratio(input.startupsLaunched, 5) * 0.2 +
      ratio(input.industryCollaborations, 8) * 0.15 +
      ratio(input.totalMentoringHours, 120) * 0.1
    );

  const activityScore = round2(
    calendarActivitiesScore +
      micDrivenProxyScore +
      celebrationActivitiesScore +
      selfDrivenActivitiesScore,
  );

  const innovationRepositoryScore =
    25 *
    (
      ratio(input.totalInnovationActivities, 30) * 0.5 +
      ratio(input.patentsFiled, 10) * 0.3 +
      ratio(input.startupsLaunched, 5) * 0.2
    );
  const policyAdoptionScore = 20 * ((policyCoverage * 0.7) + (policyFreshness * 0.3));
  const ecosystemCollaborationScore = 15 * ratio(input.industryCollaborations, 8);
  const mentoringCapacityScore = 15 * ratio(input.totalMentoringHours, 120);
  const commercializationScore =
    15 * (ratio(input.startupsLaunched, 5) * 0.6 + ratio(input.activeProjects, 20) * 0.4);
  const cadenceScore = 10 * ((structuredCadence * 0.6) + (quarterCadence * 0.4));

  const participationScore = round2(
    innovationRepositoryScore +
      policyAdoptionScore +
      ecosystemCollaborationScore +
      mentoringCapacityScore +
      commercializationScore +
      cadenceScore,
  );

  const totalScore = round2(activityScore * 0.8 + participationScore * 0.2);

  return {
    activityScore,
    participationScore,
    totalScore,
    starRating: scoreToIicStarRating(totalScore),
  };
}
