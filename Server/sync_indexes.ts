import { connectDB } from './src/config/db';
import { Problem } from './src/modules/problemBank/problem.model';

async function buildIndexes() {
  await connectDB();
  console.log("Syncing indexes...");
  await Problem.cleanIndexes();
  await Problem.syncIndexes();
  console.log("Indexes built!");
  process.exit(0);
}
buildIndexes();
