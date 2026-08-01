import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { Server } from 'socket.io';
import { env } from '../config/env';
import { logError } from '../config/logger';
import { redis } from '../config/redis';
import { hasMentorStudentAssignment } from '../modules/mentor/mentorAssignment.service';
import { UserRole } from '../types/roles.types';

interface MentorSocketPayload extends jwt.JwtPayload {
  _id: string;
  role: UserRole;
  email: string;
  type: 'access';
}

// The live-feed policy must match the assignment policy used by GET
// /api/mentor/students; otherwise a student can appear in the feed but cannot
// be pinned until a session already exists.
const isMentorOfStudent = async (mentorId: string, studentId: string) =>
  hasMentorStudentAssignment(mentorId, studentId);

type MentorWatchAck = (response: { success: boolean; message?: string }) => void;

const emitMentorError = (
  socket: {
    emit: (event: string, payload: { message: string }) => void;
  },
  message: string,
) => {
  socket.emit('mentor:error', { message });
};

const restoreWatchedStudents = async (
  socket: {
    join: (room: string) => void;
    emit: (event: string, payload: { message: string }) => void;
  },
  mentorId: string,
) => {
  try {
    const watchedStudents = (await redis.smembers(`mentor:watch:${mentorId}`)) as string[];

    for (const studentId of watchedStudents) {
      if (!Types.ObjectId.isValid(studentId)) {
        await redis.srem(`mentor:watch:${mentorId}`, studentId);
        continue;
      }

      if (await isMentorOfStudent(mentorId, studentId)) {
        socket.join(`student-feed:${studentId}`);
        continue;
      }

      await redis.srem(`mentor:watch:${mentorId}`, studentId);
      await redis.srem(`student:watchers:${studentId}`, mentorId);
    }
  } catch (error) {
    logError(`Failed to restore mentor watch list for mentor ${mentorId}`, error);
    emitMentorError(socket, 'Live mentor feed is temporarily unavailable');
  }
};

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
    // relationship - a mentor may have been removed since the cache was set,
    // and we don't want stale Redis entries to keep them subscribed.
    void restoreWatchedStudents(socket, mentorId);

    socket.on('mentor:watch', async ({ studentId }: { studentId?: string } = {}, acknowledge?: MentorWatchAck) => {
      try {
        if (!studentId || !Types.ObjectId.isValid(studentId)) {
          emitMentorError(socket, 'Invalid student id');
          acknowledge?.({ success: false, message: 'Invalid student id' });
          return;
        }

        // Tenant check: only mentors assigned to one of this student's active
        // workspaces may subscribe to their activity feed.
        if (!(await isMentorOfStudent(mentorId, studentId))) {
          emitMentorError(socket, 'No mentorship relationship with this student');
          acknowledge?.({ success: false, message: 'No mentorship relationship with this student' });
          return;
        }

        await Promise.all([
          redis.sadd(`mentor:watch:${mentorId}`, studentId),
          redis.sadd(`student:watchers:${studentId}`, mentorId),
        ]);
        socket.join(`student-feed:${studentId}`);
        acknowledge?.({ success: true });
      } catch (error) {
        logError(`Failed to watch student ${studentId} for mentor ${mentorId}`, error);
        socket.leave(`student-feed:${studentId}`);
        emitMentorError(socket, 'Unable to watch this student right now');
        acknowledge?.({ success: false, message: 'Unable to watch this student right now' });
      }
    });

    socket.on('mentor:unwatch', async ({ studentId }: { studentId?: string } = {}, acknowledge?: MentorWatchAck) => {
      try {
        if (!studentId || !Types.ObjectId.isValid(studentId)) {
          emitMentorError(socket, 'Invalid student id');
          acknowledge?.({ success: false, message: 'Invalid student id' });
          return;
        }

        socket.leave(`student-feed:${studentId}`);
        await Promise.all([
          redis.srem(`mentor:watch:${mentorId}`, studentId),
          redis.srem(`student:watchers:${studentId}`, mentorId),
        ]);
        acknowledge?.({ success: true });
      } catch (error) {
        logError(`Failed to unwatch student ${studentId} for mentor ${mentorId}`, error);
        emitMentorError(socket, 'Unable to stop watching this student right now');
        acknowledge?.({ success: false, message: 'Unable to stop watching this student right now' });
      }
    });

    socket.on('disconnect', () => {
      socket.leave(`mentor:${mentorId}`);
    });
  });
};
