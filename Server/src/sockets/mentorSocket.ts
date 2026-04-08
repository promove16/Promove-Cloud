import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { Server } from 'socket.io';
import { env } from '../config/env';
import { redis } from '../config/redis';
import { MentorSession } from '../modules/mentor/mentorSession.model';
import { UserRole } from '../types/roles.types';

interface MentorSocketPayload extends jwt.JwtPayload {
  _id: string;
  role: UserRole;
  email: string;
  type: 'access';
}

// A mentor may watch a student only if at least one MentorSession exists
// linking them. This is the canonical relationship — if the student has not
// agreed to be mentored by this user, no session record exists.
const isMentorOfStudent = async (mentorId: string, studentId: string) =>
  Boolean(
    await MentorSession.exists({
      mentorId: new Types.ObjectId(mentorId),
      studentId: new Types.ObjectId(studentId),
    }),
  );

export const initMentorSocket = (io: Server) => {
  const mentor = io.of('/mentor');

  mentor.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Unauthorized'));

    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
        algorithms: ['RS256'],
      }) as MentorSocketPayload;

      // Only mentors may connect to /mentor. Without this, ANY authenticated
      // user could call mentor:watch and join a student's feed room.
      if (decoded.role !== UserRole.MENTOR) {
        return next(new Error('Unauthorized'));
      }

      socket.data.userId = decoded._id;
      socket.data.role = decoded.role;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  mentor.on('connection', (socket) => {
    const mentorId: string = socket.data.userId;
    socket.join(`mentor:${mentorId}`);

    // Re-join previously watched student feeds, but re-verify the mentorship
    // relationship — a mentor may have been removed since the cache was set,
    // and we don't want stale Redis entries to keep them subscribed.
    void (async () => {
      const watchedStudents = (await redis.smembers(`mentor:watch:${mentorId}`)) as string[];
      for (const studentId of watchedStudents) {
        if (!Types.ObjectId.isValid(studentId)) {
          await redis.srem(`mentor:watch:${mentorId}`, studentId);
          continue;
        }
        if (await isMentorOfStudent(mentorId, studentId)) {
          socket.join(`student-feed:${studentId}`);
        } else {
          await redis.srem(`mentor:watch:${mentorId}`, studentId);
          await redis.srem(`student:watchers:${studentId}`, mentorId);
        }
      }
    })();

    socket.on('mentor:watch', async ({ studentId }: { studentId: string }) => {
      if (!studentId || !Types.ObjectId.isValid(studentId)) {
        socket.emit('mentor:error', { message: 'Invalid student id' });
        return;
      }

      // Tenant check: only mentors who actually have a session with this
      // student may subscribe to their activity feed.
      if (!(await isMentorOfStudent(mentorId, studentId))) {
        socket.emit('mentor:error', { message: 'No mentorship relationship with this student' });
        return;
      }

      socket.join(`student-feed:${studentId}`);
      await redis.sadd(`mentor:watch:${mentorId}`, studentId);
      await redis.sadd(`student:watchers:${studentId}`, mentorId);
    });

    socket.on('mentor:unwatch', async ({ studentId }: { studentId: string }) => {
      if (!studentId || !Types.ObjectId.isValid(studentId)) {
        socket.emit('mentor:error', { message: 'Invalid student id' });
        return;
      }

      socket.leave(`student-feed:${studentId}`);
      await redis.srem(`mentor:watch:${mentorId}`, studentId);
      await redis.srem(`student:watchers:${studentId}`, mentorId);
    });

    socket.on('disconnect', () => {
      socket.leave(`mentor:${mentorId}`);
    });
  });
};
