import express from 'express';
import request from 'supertest';
import { httpMetricsMiddleware, metricsHandler, costClass, registry } from '../../src/middleware/metrics';
import { healthHandler } from '../../src/middleware/health';
import { createConcurrencyLimit } from '../../src/middleware/concurrencyLimit';
import { idempotency } from '../../src/middleware/idempotency';
import { paginate } from '../../src/utils/cursorPagination';
import { cacheAside, cacheInvalidate } from '../../src/utils/cacheAside';
import mongoose from 'mongoose';

/**
 * Production-readiness suite. These tests cover the new infrastructure added
 * for ~10k-user production traffic. They are intentionally narrow — they verify
 * the middleware contracts and the cursor/cache helpers do what they claim
 * without depending on real Redis or Mongo (the test setup uses in-memory Redis).
 */

describe('Phase 0: metrics + telemetry', () => {
  test('GET /metrics exposes Prometheus content', async () => {
    const app = express();
    app.use(httpMetricsMiddleware);
    app.get('/metrics', metricsHandler);
    app.get('/cheap', costClass('cached'), (_req, res) => res.json({ ok: true }));

    // Hit a route once so a sample lands in the histogram.
    await request(app).get('/cheap').expect(200);

    const res = await request(app).get('/metrics').expect(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toContain('http_request_duration_seconds');
    expect(res.text).toContain('http_requests_in_flight');
    expect(res.text).toContain('cost_class="cached"');
  });

  test('cost_class label is recorded on requests', async () => {
    const app = express();
    app.use(httpMetricsMiddleware);
    app.get('/heavy', costClass('db-heavy'), (_req, res) => res.json({}));
    await request(app).get('/heavy').expect(200);
    const text = await registry.metrics();
    expect(text).toContain('request_cost_class_total{cost_class="db-heavy"');
  });
});

describe('Phase 0: health endpoint', () => {
  test('/healthz returns 200 with uptime', async () => {
    const app = express();
    app.get('/healthz', healthHandler);
    const res = await request(app).get('/healthz').expect(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
  });
});

describe('Phase 1: cursor pagination', () => {
  interface CursorTestDoc {
    _id: mongoose.Types.ObjectId;
    idx: number;
    createdAt: Date;
  }

  let TestModel: mongoose.Model<CursorTestDoc>;

  beforeAll(() => {
    const schema = new mongoose.Schema<CursorTestDoc>({
      idx: Number,
      createdAt: { type: Date, default: Date.now },
    });
    TestModel = mongoose.model('CursorTestDoc', schema);
  });

  test('paginate walks through all pages with no overlap', async () => {
    const docs = Array.from({ length: 25 }, (_, i) => ({ idx: i, createdAt: new Date(2024, 0, i + 1) }));
    await TestModel.insertMany(docs);

    const seenIdx = new Set<number>();
    let cursor: string | undefined;
    let pages = 0;

    while (true) {
      pages += 1;
      const result = await paginate(TestModel, {
        sortKey: 'createdAt',
        sortDir: 'desc',
        limit: 10,
        cursor,
      });

      for (const item of result.items as Array<{ idx: number }>) {
        expect(seenIdx.has(item.idx)).toBe(false);
        seenIdx.add(item.idx);
      }

      if (!result.nextCursor) break;
      cursor = result.nextCursor;
      if (pages > 10) throw new Error('pagination did not terminate');
    }

    expect(seenIdx.size).toBe(25);
  });

  test('invalid cursor returns 400-style ApiError', async () => {
    await expect(
      paginate(TestModel, { cursor: 'not-base64-json' }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_CURSOR' });
  });
});

describe('Phase 1: cache-aside', () => {
  test('returns cached value on hit, fetcher runs once on miss', async () => {
    const fetcher = jest.fn().mockResolvedValue({ name: 'alice' });

    const a = await cacheAside('test:profile:1', fetcher, {
      cacheName: 'profile',
      softTtlSeconds: 30,
      hardTtlSeconds: 60,
    });
    const b = await cacheAside('test:profile:1', fetcher, {
      cacheName: 'profile',
      softTtlSeconds: 30,
      hardTtlSeconds: 60,
    });

    expect(a).toEqual({ name: 'alice' });
    expect(b).toEqual({ name: 'alice' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test('cacheInvalidate forces the next call to refetch', async () => {
    let count = 0;
    const fetcher = jest.fn<Promise<{ count: number }>, []>().mockImplementation(async () => ({
      count: ++count,
    }));

    const first = await cacheAside<{ count: number }>('test:invalidate', fetcher, {
      cacheName: 'profile',
      softTtlSeconds: 30,
      hardTtlSeconds: 60,
    });
    expect(first.count).toBe(1);

    await cacheInvalidate('profile', 'test:invalidate');

    const second = await cacheAside<{ count: number }>('test:invalidate', fetcher, {
      cacheName: 'profile',
      softTtlSeconds: 30,
      hardTtlSeconds: 60,
    });
    expect(second.count).toBe(2);
  });

  test('single-flight collapses concurrent misses', async () => {
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 20));
      return { v: calls };
    };

    const results = await Promise.all([
      cacheAside('test:single-flight', fetcher, {
        cacheName: 'profile',
        softTtlSeconds: 30,
        hardTtlSeconds: 60,
      }),
      cacheAside('test:single-flight', fetcher, {
        cacheName: 'profile',
        softTtlSeconds: 30,
        hardTtlSeconds: 60,
      }),
      cacheAside('test:single-flight', fetcher, {
        cacheName: 'profile',
        softTtlSeconds: 30,
        hardTtlSeconds: 60,
      }),
    ]);

    expect(calls).toBe(1);
    expect(results.every((r) => r.v === 1)).toBe(true);
  });
});

describe('Phase 3: concurrency limit', () => {
  test('rejects requests over the limit with 503', async () => {
    const limiter = createConcurrencyLimit('slow', { maxInflight: 1, queueDepth: 0 });
    const app = express();
    app.get('/slow', limiter, async (_req, res) => {
      await new Promise((r) => setTimeout(r, 50));
      res.json({ ok: true });
    });
    app.use((err: { statusCode?: number; code?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(err.statusCode || 500).json({ code: err.code });
    });

    const [first, second] = await Promise.all([
      request(app).get('/slow'),
      // Race the second request in fast — should hit the limiter.
      new Promise((resolve) => setTimeout(() => resolve(request(app).get('/slow').then((r) => r)), 5)),
    ] as [Promise<request.Response>, Promise<request.Response>]);

    const responses = [first, await second] as request.Response[];
    const statuses = responses.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 503]);
  });
});

describe('Phase 3: idempotency', () => {
  test('replays cached response on duplicate Idempotency-Key', async () => {
    const handler = jest.fn((_req: express.Request, res: express.Response) => {
      res.status(201).json({ id: Math.random() });
    });
    const app = express();
    app.use(express.json());
    app.post('/things', idempotency(), handler);

    const key = 'test-key-' + Date.now();
    const r1 = await request(app)
      .post('/things')
      .set('Idempotency-Key', key)
      .send({ name: 'foo' })
      .expect(201);

    // Give the async store-write a moment.
    await new Promise((r) => setTimeout(r, 20));

    const r2 = await request(app)
      .post('/things')
      .set('Idempotency-Key', key)
      .send({ name: 'foo' })
      .expect(201);

    expect(r2.headers['idempotent-replayed']).toBe('true');
    expect(r2.body).toEqual(r1.body);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('409 when same key reused with different payload', async () => {
    const app = express();
    app.use(express.json());
    app.post('/things', idempotency(), (_req, res) => res.status(201).json({ ok: true }));
    app.use((err: { statusCode?: number; code?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(err.statusCode || 500).json({ code: err.code });
    });

    const key = 'conflict-' + Date.now();
    await request(app).post('/things').set('Idempotency-Key', key).send({ a: 1 }).expect(201);
    await new Promise((r) => setTimeout(r, 20));

    const conflict = await request(app)
      .post('/things')
      .set('Idempotency-Key', key)
      .send({ a: 2 })
      .expect(409);
    expect(conflict.body.code).toBe('IDEMPOTENCY_KEY_CONFLICT');
  });
});
