import { Queue } from 'bullmq';
import { closeBullMqQueueSafely } from '../../src/config/bullmq';

describe('closeBullMqQueueSafely', () => {
  test('uses the internal BullMQ connection for forced queue shutdown', async () => {
    const internalClose = jest.fn().mockResolvedValue(undefined);
    const queueClose = jest.fn().mockResolvedValue(undefined);
    const queueDisconnect = jest.fn().mockResolvedValue(undefined);

    const queue = {
      close: queueClose,
      disconnect: queueDisconnect,
      connection: {
        close: internalClose,
      },
    } as unknown as Queue;

    await closeBullMqQueueSafely(queue, true);

    expect(internalClose).toHaveBeenCalledWith(true);
    expect(queueClose).not.toHaveBeenCalled();
    expect(queueDisconnect).not.toHaveBeenCalled();
  });

  test('falls back to the public queue close during normal shutdown', async () => {
    const internalClose = jest.fn().mockResolvedValue(undefined);
    const queueClose = jest.fn().mockResolvedValue(undefined);
    const queueDisconnect = jest.fn().mockResolvedValue(undefined);

    const queue = {
      close: queueClose,
      disconnect: queueDisconnect,
      connection: {
        close: internalClose,
      },
    } as unknown as Queue;

    await closeBullMqQueueSafely(queue, false);

    expect(queueClose).toHaveBeenCalledTimes(1);
    expect(internalClose).not.toHaveBeenCalled();
    expect(queueDisconnect).not.toHaveBeenCalled();
  });
});
