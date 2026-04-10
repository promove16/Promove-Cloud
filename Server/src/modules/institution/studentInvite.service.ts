import { logError } from '../../config/logger';
import { User } from '../user/user.model';
import { UserRole } from '../../types/roles.types';
import { sendStudentInviteEmail } from '../../services/emailService';
import { getOrCreateActiveStudentAccessToken } from './institutionAccess.service';

export const sendStudentRosterInvite = async (params: {
  institutionId: string;
  institutionRole: UserRole.SCHOOL | UserRole.COLLEGE;
  createdBy: string;
  studentEmail: string;
  studentName: string;
}) => {
  const institution = await User.findOne({
    _id: params.institutionId,
    role: params.institutionRole,
  })
    .select('_id displayName role')
    .lean();

  if (!institution) {
    return;
  }

  try {
    const token = await getOrCreateActiveStudentAccessToken(
      params.institutionId,
      params.institutionRole,
      params.createdBy,
    );

    await sendStudentInviteEmail({
      toEmail: params.studentEmail,
      studentName: params.studentName,
      institutionName: institution.displayName,
      institutionRole: institution.role,
      institutionToken: token,
    });
  } catch (error) {
    logError('Failed to send student roster invite email', error);
  }
};
