describe('bullmq transport bootstrap', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalBullMqUseRedis = process.env.BULLMQ_USE_REDIS;
  const originalRedisHost = process.env.AWS_REDIS_HOST;
  const originalUpstashHost = process.env.UPSTASH_REDIS_HOST;
  const originalUpstashPassword = process.env.UPSTASH_REDIS_PASSWORD;
  const restoreEnv = (key: string, value: string | undefined) => {
    if (value === undefined) {
      delete process.env[key];
      return;
    }

    process.env[key] = value;
  };

  beforeEach(() => {
    jest.resetModules();
    process.env.NODE_ENV = 'development';
    process.env.BULLMQ_USE_REDIS = 'true';
    process.env.AWS_REDIS_HOST = 'example.cache.amazonaws.com';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.dontMock('bullmq');
    jest.dontMock('ioredis');
    jest.resetModules();
    restoreEnv('NODE_ENV', originalNodeEnv);
    restoreEnv('BULLMQ_USE_REDIS', originalBullMqUseRedis);
    restoreEnv('AWS_REDIS_HOST', originalRedisHost);
    restoreEnv('UPSTASH_REDIS_HOST', originalUpstashHost);
    restoreEnv('UPSTASH_REDIS_PASSWORD', originalUpstashPassword);
  });

  test('does not create BullMQ queues until a job is added', async () => {
    const queueAdd = jest.fn().mockResolvedValue({ id: 'job-1' });
    const queueOn = jest.fn();
    const queueConstructor = jest.fn().mockImplementation(() => ({
      add: queueAdd,
      on: queueOn,
      close: jest.fn(),
      disconnect: jest.fn(),
    }));

    jest.doMock('bullmq', () => ({
      __esModule: true,
      Job: class {},
      Queue: queueConstructor,
      Worker: class {},
    }));

    const bullmq = await import('../../src/config/bullmq');

    expect(queueConstructor).not.toHaveBeenCalled();

    await bullmq.scoreQueue.add('score:recalc', { userId: 'user-1' } as never);

    expect(queueConstructor).toHaveBeenCalledTimes(1);
    expect(queueConstructor).toHaveBeenCalledWith('score-recalc', expect.any(Object));
    expect(queueAdd).toHaveBeenCalledTimes(1);
    expect(queueOn).toHaveBeenCalledWith('error', expect.any(Function));
  });

  test('sanitizes custom job ids before adding remote jobs', async () => {
    const queueAdd = jest.fn().mockResolvedValue({ id: 'job-1' });
    const queueConstructor = jest.fn().mockImplementation(() => ({
      add: queueAdd,
      on: jest.fn(),
      close: jest.fn(),
      disconnect: jest.fn(),
    }));

    jest.doMock('bullmq', () => ({
      __esModule: true,
      Job: class {},
      Queue: queueConstructor,
      Worker: class {},
    }));

    const bullmq = await import('../../src/config/bullmq');

    await bullmq.emailQueue.add(
      'retention-email',
      { type: 'weekly_progress_summary', userId: 'user-1', weekKey: '2026-04-27' } as never,
      { jobId: 'retention:weekly-summary:user-1:2026-04-27' },
    );

    expect(queueAdd).toHaveBeenCalledWith(
      'retention-email',
      expect.any(Object),
      expect.objectContaining({
        jobId: 'retention-weekly-summary-user-1-2026-04-27',
      }),
    );
  });

  test('disables remote BullMQ during startup probing when Redis transport is unavailable', async () => {
    const connect = jest
      .fn()
      .mockRejectedValue(new Error('getaddrinfo ENOTFOUND example.cache.amazonaws.com'));
    const disconnect = jest.fn();
    const redisConstructor = jest.fn().mockImplementation(() => ({
      connect,
      disconnect,
    }));

    jest.doMock('ioredis', () => ({
      __esModule: true,
      default: redisConstructor,
    }));

    const bullmq = await import('../../src/config/bullmq');

    await expect(bullmq.initializeBullMqRedisTransport()).resolves.toBe(false);
    expect(redisConstructor).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(bullmq.hasActiveBullMqRedisConnection()).toBe(false);
  });

  test('uses Upstash Redis when AWS Redis is not configured', async () => {
    delete process.env.AWS_REDIS_HOST;
    process.env.UPSTASH_REDIS_HOST = 'example.upstash.io';
    process.env.UPSTASH_REDIS_PASSWORD = 'upstash-password';

    const queueAdd = jest.fn().mockResolvedValue({ id: 'job-1' });
    const queueConstructor = jest.fn().mockImplementation(() => ({
      add: queueAdd,
      on: jest.fn(),
      close: jest.fn(),
      disconnect: jest.fn(),
    }));

    jest.doMock('bullmq', () => ({
      __esModule: true,
      Job: class {},
      Queue: queueConstructor,
      Worker: class {},
    }));

    const bullmq = await import('../../src/config/bullmq');

    await bullmq.scoreQueue.add('score:recalc', { userId: 'user-1' } as never);

    expect(queueConstructor).toHaveBeenCalledWith(
      'score-recalc',
      expect.objectContaining({
        connection: expect.objectContaining({
          host: 'example.upstash.io',
          port: 6379,
          password: 'upstash-password',
          tls: {},
        }),
      }),
    );
  });

  test('starts BullMQ workers with autorun disabled so transport failures are handled explicitly', async () => {
    const workerOn = jest.fn();
    const workerRun = jest.fn().mockRejectedValue(new Error('Connection is closed.'));
    const workerClose = jest.fn().mockResolvedValue(undefined);
    const workerConstructor = jest.fn().mockImplementation(() => ({
      close: workerClose,
      on: workerOn,
      run: workerRun,
    }));

    jest.doMock('bullmq', () => ({
      __esModule: true,
      Job: class {},
      Queue: class {},
      Worker: workerConstructor,
    }));

    const bullmq = await import('../../src/config/bullmq');

    bullmq.createQueueWorker('notifications', async () => undefined);
    await new Promise((resolve) => setImmediate(resolve));

    expect(workerConstructor).toHaveBeenCalledWith(
      'notifications',
      expect.any(Function),
      expect.objectContaining({
        autorun: false,
        connection: expect.any(Object),
      }),
    );
    expect(workerOn).toHaveBeenCalledWith('error', expect.any(Function));
    expect(workerRun).toHaveBeenCalledTimes(1);
    expect(workerClose).toHaveBeenCalledWith(true);
    expect(bullmq.hasActiveBullMqRedisConnection()).toBe(false);
  });

  test('uses a BullMQ-safe dead-letter queue name', async () => {
    let failedHandler:
      | ((job: {
          id: string;
          name: string;
          data: Record<string, unknown>;
          attemptsMade: number;
          opts: { attempts: number };
          timestamp: number;
        }, error: Error) => Promise<void>)
      | undefined;
    const queueAdd = jest.fn().mockResolvedValue({ id: 'dlq-job-1' });
    const queueConstructor = jest.fn().mockImplementation((name: string) => ({
      name,
      add: queueAdd,
      on: jest.fn(),
      close: jest.fn(),
      disconnect: jest.fn(),
    }));
    const workerConstructor = jest.fn().mockImplementation(() => ({
      close: jest.fn(),
      on: jest.fn((event, handler) => {
        if (event === 'failed') {
          failedHandler = handler;
        }
      }),
      run: jest.fn().mockResolvedValue(undefined),
    }));

    jest.doMock('bullmq', () => ({
      __esModule: true,
      Job: class {},
      Queue: queueConstructor,
      Worker: workerConstructor,
    }));

    const bullmq = await import('../../src/config/bullmq');

    bullmq.createQueueWorker('mongo-excel-backup', async () => undefined);
    await failedHandler?.(
      {
        id: 'backup-job-1',
        name: 'mongo-backup',
        data: {},
        attemptsMade: 3,
        opts: { attempts: 3 },
        timestamp: Date.now(),
      },
      new Error('backup failed'),
    );

    expect(queueConstructor).toHaveBeenCalledWith('mongo-excel-backup-dlq', expect.any(Object));
    expect(queueAdd).toHaveBeenCalledWith(
      'dead-letter',
      expect.objectContaining({
        originalQueue: 'mongo-excel-backup',
        jobId: 'backup-job-1',
      }),
      expect.any(Object),
    );
  });

  test('ignores leaked BullMQ transport rejections after fallback has been enabled', async () => {
    const bullmq = await import('../../src/config/bullmq');

    bullmq.disableRemoteBullMq(new Error('ERR max requests limit exceeded'));

    const leakedTransportError = new Error('Connection is closed.');
    leakedTransportError.stack = [
      'Error: Connection is closed.',
      '    at EventEmitter.connectionCloseHandler (C:\\repo\\node_modules\\bullmq\\node_modules\\ioredis\\built\\Redis.js:208:28)',
    ].join('\n');

    expect(bullmq.shouldIgnoreBullMqUnhandledRejection(leakedTransportError)).toBe(true);
    expect(
      bullmq.shouldIgnoreBullMqUnhandledRejection(new Error('ERR max requests limit exceeded')),
    ).toBe(true);
    expect(
      bullmq.shouldIgnoreBullMqUnhandledRejection(new Error('Connection is closed.')),
    ).toBe(false);
  });
});
