import { connectDB, disconnectDB } from '../../config/db';
import { Workspace } from '../workspace/workspace.model';
import { seedProblemsIfEmpty } from './problem.service';
import { Problem } from './problem.model';
import { ProblemSubmission } from './problemSubmission.model';

const hasFlag = (flag: string) => process.argv.includes(flag);

const run = async () => {
  if (!hasFlag('--force')) {
    throw new Error(
      'Refusing to replace problem bank data without --force. This deletes problems, problem submissions, and problem-backed workspaces.',
    );
  }

  process.env.PROMOVE_SKIP_PROBLEM_CACHE_CLEAR = 'true';
  await connectDB();

  const [workspaceDeleteResult, submissionDeleteResult, problemDeleteResult] = await Promise.all([
    Workspace.deleteMany({ claimedProblemId: { $exists: true, $ne: null } }),
    ProblemSubmission.deleteMany({}),
    Problem.deleteMany({}),
  ]);

  const seeded = await seedProblemsIfEmpty();
  const problemCount = await Problem.countDocuments();

  console.log(
    [
      'Problem bank replacement complete.',
      `Deleted problem-backed workspaces: ${workspaceDeleteResult.deletedCount ?? 0}`,
      `Deleted problem submissions: ${submissionDeleteResult.deletedCount ?? 0}`,
      `Deleted previous problems: ${problemDeleteResult.deletedCount ?? 0}`,
      `Seeded new PDF problem bank: ${seeded ? 'yes' : 'no'}`,
      `Current problem count: ${problemCount}`,
    ].join('\n'),
  );
};

run()
  .catch((error) => {
    console.error('Problem bank replacement failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDB();
    process.exit(process.exitCode ?? 0);
  });
