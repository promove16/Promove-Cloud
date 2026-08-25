import { Types } from 'mongoose';
import { Workspace } from '../workspace/workspace.model';

export const hasMentorStudentAssignment = async (mentorId: string, studentId: string) =>
  Boolean(
    await Workspace.exists({
      isActive: true,
      chatParticipants: {
        $elemMatch: {
          userId: new Types.ObjectId(mentorId),
          role: 'mentor',
        },
      },
      $or: [
        { ownerId: new Types.ObjectId(studentId) },
        { teamMemberIds: new Types.ObjectId(studentId) },
      ],
    }),
  );
