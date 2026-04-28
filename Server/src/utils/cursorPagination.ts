import { Request } from 'express';
import { Model, FilterQuery, SortOrder } from 'mongoose';
import { ApiError } from './ApiError';

/**
 * Cursor-based pagination helper.
 *
 * Why cursor over offset: at scale, `skip(N)` is O(N) — Mongo still scans those
 * skipped documents. Cursors use the indexed sort key (typically `_id` or
 * `createdAt`) to seek directly to the next page, which is O(log N).
 *
 * Cursor format: opaque base64 of `{ v: 1, key: <sortValue>, id: <docId> }`.
 * The composite (sortValue, _id) breaks ties when the sort key is non-unique
 * (e.g. createdAt at second-level granularity).
 *
 * Usage:
 *   const { items, nextCursor } = await paginate(User, {
 *     filter: { active: true },
 *     sortKey: 'createdAt',
 *     sortDir: 'desc',
 *     limit: 20,
 *     cursor: req.query.cursor as string | undefined,
 *   });
 */

export type SortDirection = 'asc' | 'desc';

export interface PaginateOptions<TFilter> {
  filter?: TFilter;
  sortKey?: string; // default '_id'
  sortDir?: SortDirection; // default 'desc'
  limit?: number;
  cursor?: string;
  projection?: Record<string, 0 | 1>;
  /** Optional populate paths. Pass strings or PopulateOptions. */
  populate?: unknown[];
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

interface CursorPayload {
  v: number;
  key: unknown;
  id: string;
}

const encodeCursor = (payload: CursorPayload): string =>
  Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');

const decodeCursor = (cursor: string): CursorPayload => {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (typeof decoded !== 'object' || decoded === null || decoded.v !== 1) {
      throw new Error('invalid cursor version');
    }
    return decoded as CursorPayload;
  } catch {
    throw new ApiError(400, 'INVALID_CURSOR', 'Invalid pagination cursor.');
  }
};

const reviveCursorKey = (key: unknown): unknown => {
  // ISO date strings stored in cursors should be converted back to Date so they
  // compare correctly against BSON Date fields.
  if (typeof key === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(key)) {
    const parsed = new Date(key);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return key;
};

export async function paginate<TDoc extends { _id: unknown }, TFilter = FilterQuery<TDoc>>(
  model: Model<TDoc>,
  opts: PaginateOptions<TFilter> = {},
): Promise<PaginatedResult<TDoc>> {
  const sortKey = opts.sortKey || '_id';
  const sortDir: SortDirection = opts.sortDir || 'desc';
  const limit = Math.min(Math.max(1, opts.limit || DEFAULT_LIMIT), MAX_LIMIT);

  const baseFilter = (opts.filter || {}) as FilterQuery<TDoc>;
  let filter: FilterQuery<TDoc> = baseFilter;

  if (opts.cursor) {
    const { key, id } = decodeCursor(opts.cursor);
    const revivedKey = reviveCursorKey(key);
    const cmp = sortDir === 'desc' ? '$lt' : '$gt';

    if (sortKey === '_id') {
      filter = {
        ...baseFilter,
        _id: { [cmp]: id },
      } as FilterQuery<TDoc>;
    } else {
      // Composite (sortKey, _id) seek for tie-breaking.
      filter = {
        ...baseFilter,
        $or: [
          { [sortKey]: { [cmp]: revivedKey } },
          { [sortKey]: revivedKey, _id: { [cmp]: id } },
        ],
      } as FilterQuery<TDoc>;
    }
  }

  const sortDirection: SortOrder = sortDir === 'desc' ? -1 : 1;
  const sort: Record<string, SortOrder> =
    sortKey === '_id'
      ? { _id: sortDirection }
      : { [sortKey]: sortDirection, _id: sortDirection };

  let query = model.find(filter, opts.projection).sort(sort).limit(limit + 1).lean();
  if (opts.populate) {
    query = query.populate(opts.populate as Parameters<typeof query.populate>[0]) as typeof query;
  }

  const docs = (await query) as unknown as TDoc[];

  const hasMore = docs.length > limit;
  const items = hasMore ? docs.slice(0, limit) : docs;

  let nextCursor: string | null = null;
  if (hasMore && items.length > 0) {
    const last = items[items.length - 1] as TDoc & Record<string, unknown>;
    const keyValue = sortKey === '_id' ? last._id : last[sortKey];
    nextCursor = encodeCursor({
      v: 1,
      key: keyValue instanceof Date ? keyValue.toISOString() : keyValue,
      id: String(last._id),
    });
  }

  return { items, nextCursor, hasMore };
}

/**
 * Pull `cursor` and `limit` from req.query with safe defaults.
 */
export const parsePaginationQuery = (req: Request, defaultLimit = DEFAULT_LIMIT) => {
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
  const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : defaultLimit;
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), MAX_LIMIT) : defaultLimit;
  return { cursor, limit };
};
