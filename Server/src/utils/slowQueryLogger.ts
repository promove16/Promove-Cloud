import mongoose from 'mongoose';
import { logger } from '../config/logger';
import { mongoQueryDuration } from '../middleware/metrics';

/**
 * Mongoose plugin: records every query's duration in the Prometheus histogram and
 * logs queries that exceed `SLOW_QUERY_THRESHOLD_MS`.
 *
 * Apply globally with `mongoose.plugin(slowQueryPlugin)` before any models are
 * compiled, so it attaches to all schemas. We label by model name + operation
 * (find, findOne, updateOne, etc.) which keeps cardinality bounded.
 *
 * To inspect a slow query in development, set `MONGOOSE_DEBUG=true` and the
 * query payload + filter will be included in the warning log.
 */

const SLOW_QUERY_THRESHOLD_MS = Number(process.env.SLOW_QUERY_THRESHOLD_MS) || 200;

type QueryWithStartTime = mongoose.Query<unknown, unknown> & { __startedAt?: bigint };

export const slowQueryPlugin = (schema: mongoose.Schema) => {
  schema.pre(/.*/, function (this: QueryWithStartTime, next) {
    // Only attach to query middleware, not document/aggregate middleware
    if (typeof this.getQuery === 'function') {
      this.__startedAt = process.hrtime.bigint();
    }
    if (typeof next === 'function') {
      next();
    }
  });

  schema.post(/.*/, function (this: QueryWithStartTime) {
    if (!this.__startedAt) return;

    const seconds = Number(process.hrtime.bigint() - this.__startedAt) / 1e9;
    const ms = seconds * 1000;
    const op = (this as unknown as { op?: string }).op || 'unknown';
    const modelName = this.model?.modelName || 'unknown';

    mongoQueryDuration.observe({ model: modelName, op }, seconds);

    if (ms >= SLOW_QUERY_THRESHOLD_MS) {
      const filter = this.getQuery();
      logger.warn(
        `Slow Mongo query: ${modelName}.${op} took ${ms.toFixed(0)}ms ` +
          `filter=${JSON.stringify(filter).slice(0, 500)}`,
      );
    }
  });
};

/**
 * Run `.explain('executionStats')` on a Mongoose query and pretty-log the index
 * decision. Use during development and in CI smoke tests.
 *
 * Example:
 *   await explainQuery('User.find activeRecruiters', User.find({ role: 'recruiter', active: true }))
 */
export const explainQuery = async <T>(
  label: string,
  query: mongoose.Query<T, unknown>,
): Promise<void> => {
  try {
    const explained = await query.explain('executionStats');
    const stats = (explained as { executionStats?: Record<string, unknown> })?.executionStats;
    const winning = (explained as { queryPlanner?: { winningPlan?: unknown } })?.queryPlanner
      ?.winningPlan;
    logger.info(
      `[explain] ${label}\n  executionStats=${JSON.stringify(stats)}\n  winningPlan=${JSON.stringify(winning)}`,
    );
  } catch (error) {
    logger.error(`[explain] ${label} failed: ${(error as Error).message}`);
  }
};
