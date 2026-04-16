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
});
