import {
  calculateEstimatedIicRating,
  scoreToIicStarRating,
} from '../../src/modules/institution/iicRating.service';

describe('IIC rating estimation', () => {
  it('maps official score bands to discrete star values', () => {
    expect(scoreToIicStarRating(0)).toBe(0);
    expect(scoreToIicStarRating(10)).toBe(1);
    expect(scoreToIicStarRating(30)).toBe(2);
    expect(scoreToIicStarRating(50)).toBe(3);
    expect(scoreToIicStarRating(70)).toBe(3.5);
    expect(scoreToIicStarRating(80)).toBe(4);
    expect(scoreToIicStarRating(93)).toBe(4.5);
    expect(scoreToIicStarRating(98)).toBe(5);
  });

  it('keeps the estimated score within valid IIC bounds', () => {
    const result = calculateEstimatedIicRating({
      totalStudents: 280,
      activeProjects: 42,
      totalInnovationActivities: 68,
      patentsFiled: 12,
      totalMentoringHours: 180,
      startupsLaunched: 6,
      industryCollaborations: 11,
      structuredActivityCount: 14,
      activeQuarterCount: 4,
      policies: [
        { status: 'On Track', lastUpdated: new Date() },
        { status: 'Active', lastUpdated: new Date() },
        { status: 'On Track', lastUpdated: new Date() },
      ],
    });

    expect(result.activityScore).toBeGreaterThan(0);
    expect(result.activityScore).toBeLessThanOrEqual(100);
    expect(result.participationScore).toBeGreaterThan(0);
    expect(result.participationScore).toBeLessThanOrEqual(100);
    expect(result.totalScore).toBeGreaterThan(0);
    expect(result.totalScore).toBeLessThanOrEqual(100);
    expect([0, 1, 2, 3, 3.5, 4, 4.5, 5]).toContain(result.starRating);
  });
});
