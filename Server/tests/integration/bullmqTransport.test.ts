describe('bullmq transport bootstrap', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalBullMqUseRedis = process.env.BULLMQ_USE_REDIS;
  const originalRedisPassword = process.env.UPSTASH_REDIS_PASSWORD;

  beforeEach(() => {
    jest.resetModules();
    process.env.NODE_ENV = 'development';
    process.env.BULLMQ_USE_REDIS = 'true';
    process.env.UPSTASH_REDIS_PASSWORD = 'password';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env.NODE_ENV = originalNodeEnv;
    process.env.BULLMQ_USE_REDIS = originalBullMqUseRedis;
    process.env.UPSTASH_REDIS_PASSWORD = originalRedisPassword;
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

  test('disables remote BullMQ during startup probing when Redis transport is unavailable', async () => {
    const connect = jest
      .fn()
      .mockRejectedValue(new Error('getaddrinfo ENOTFOUND grown-earwig-67101.upstash.io'));
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
