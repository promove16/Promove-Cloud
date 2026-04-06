import { calculateStartupInnovationScore } from '../../src/modules/startup/startupScore.utils';

describe('startup innovation score algorithm', () => {
  it('scores startups on the global 1000-scale using startup-specific inputs', () => {
    const earlyStage = calculateStartupInnovationScore({
      stage: 'Ideation',
      teamSize: 1,
      activeProducts: 1,
      traction: {
        patentFiled: false,
        mvpBuilt: false,
        revenueGenerating: false,
      },
    });

    const tractionStage = calculateStartupInnovationScore({
      stage: 'Launched',
      teamSize: 5,
      activeProducts: 4,
      traction: {
        patentFiled: true,
        mvpBuilt: true,
        revenueGenerating: true,
        usersCount: 1200,
      },
    });

    expect(earlyStage).toBe(120);
    expect(tractionStage).toBe(1000);
  });
});
