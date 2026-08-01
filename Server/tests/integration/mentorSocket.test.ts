import { redis } from '../../src/config/redis';
import { Workspace } from '../../src/modules/workspace/workspace.model';
import { initMentorSocket } from '../../src/sockets/mentorSocket';

const flushPromises = async () =>
  new Promise<void>((resolve) => {
    setImmediate(resolve);
  });

const createHarness = () => {
  let connectionHandler: ((socket: any) => void) | undefined;
  const namespace = {
    use: jest.fn(),
    on: jest.fn((event: string, handler: (socket: any) => void) => {
      if (event === 'connection') {
        connectionHandler = handler;
      }
    }),
  };
  const io = {
    of: jest.fn(() => namespace),
  };

  initMentorSocket(io as any);

  if (!connectionHandler) {
    throw new Error('Mentor socket connection handler was not registered');
  }

  const handlers = new Map<string, (...args: any[]) => Promise<void> | void>();
  const socket = {
    data: {
      userId: '507f1f77bcf86cd799439011',
      role: 'mentor',
    },
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
    on: jest.fn((event: string, handler: (...args: any[]) => Promise<void> | void) => {
      handlers.set(event, handler);
    }),
  };

  return {
    socket,
    connect: () => connectionHandler?.(socket),
    getHandler: (event: string) => {
      const handler = handlers.get(event);
      if (!handler) {
        throw new Error(`Missing socket handler for ${event}`);
      }
      return handler;
    },
  };
};

describe('mentor socket Redis error handling', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('emits mentor:error instead of crashing when restoring watched students times out', async () => {
    jest.spyOn(redis, 'smembers').mockRejectedValueOnce(new Error('TimeoutError'));

    const harness = createHarness();
    harness.connect();
    await flushPromises();

    expect(harness.socket.join).toHaveBeenCalledWith('mentor:507f1f77bcf86cd799439011');
    expect(harness.socket.emit).toHaveBeenCalledWith('mentor:error', {
      message: 'Live mentor feed is temporarily unavailable',
    });
  });

  it('emits mentor:error when Redis fails during mentor:watch', async () => {
    jest.spyOn(Workspace, 'exists').mockResolvedValueOnce({ _id: 'workspace-id' } as any);
    jest.spyOn(redis, 'sadd').mockRejectedValueOnce(new Error('TimeoutError'));
    const acknowledge = jest.fn();

    const harness = createHarness();
    harness.connect();

    const watchHandler = harness.getHandler('mentor:watch');
    await watchHandler({ studentId: '507f191e810c19729de860ea' }, acknowledge);

    expect(harness.socket.leave).toHaveBeenCalledWith('student-feed:507f191e810c19729de860ea');
    expect(harness.socket.emit).toHaveBeenCalledWith('mentor:error', {
      message: 'Unable to watch this student right now',
    });
    expect(acknowledge).toHaveBeenCalledWith({
      success: false,
      message: 'Unable to watch this student right now',
    });
  });

  it('pins a student from an assigned mentor workspace and acknowledges success', async () => {
    jest.spyOn(Workspace, 'exists').mockResolvedValueOnce({ _id: 'workspace-id' } as any);
    jest.spyOn(redis, 'sadd').mockResolvedValue(1);
    const acknowledge = jest.fn();

    const harness = createHarness();
    harness.connect();

    const watchHandler = harness.getHandler('mentor:watch');
    await watchHandler({ studentId: '507f191e810c19729de860ea' }, acknowledge);

    expect(harness.socket.join).toHaveBeenCalledWith('student-feed:507f191e810c19729de860ea');
    expect(acknowledge).toHaveBeenCalledWith({ success: true });
  });
});
