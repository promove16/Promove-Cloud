import { connectDB } from './src/config/db';
import { listProblems, claimProblem } from './src/modules/problemBank/problem.service';
import { Workspace } from './src/modules/workspace/workspace.model';
import { Problem } from './src/modules/problemBank/problem.model';
import { User } from './src/modules/user/user.model';
import mongoose from 'mongoose';

async function test() {
  await connectDB();
  try {
    const res = await listProblems({ limit: 10 });
    const problems = res.items;
    
    const existingUser = await User.findOne({ role: 'student' });
    if (!existingUser) throw new Error("No student found");
    const userId = existingUser._id.toString();
    
    // Clear existing workspaces & claims
    await Workspace.deleteMany({ ownerId: userId });
    
    // Unclaim all problems claimed by user
    await Problem.updateMany({ claimedBy: userId }, { $unset: { claimedBy: 1, claimedAt: 1 } });
    
    if (problems.length < 4) {
      console.log("Not enough problems");
      process.exit(0);
    }
    
    // Claim 1
    console.log("Claim 1");
    await claimProblem(problems[0]._id.toString(), userId);
    
    // Claim Same Again
    console.log("Claim 1 again - Expecting error");
    try {
      await claimProblem(problems[0]._id.toString(), userId);
      console.log("ERROR: Did not throw!");
    } catch(e: any) {
      console.log("Threw correctly:", e.message);
    }
    
    // Claim 2
    console.log("Claim 2");
    await claimProblem(problems[1]._id.toString(), userId);
    
    // Claim 3
    console.log("Claim 3");
    await claimProblem(problems[2]._id.toString(), userId);
    
    // Claim 4
    console.log("Claim 4 - Expecting error workspace limit");
    try {
      await claimProblem(problems[3]._id.toString(), userId);
      console.log("ERROR: Did not throw!");
    } catch(e: any) {
      console.log("Threw correctly:", e.message);
    }

  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}
test();
