import { createQueueWorker, QueueJob, notificationQueue } from '../config/bullmq';
import { User } from '../modules/user/user.model';
import {
  registerTokenUsage,
  resolveInstitutionToken,
} from '../modules/institution/institutionAccess.service';
import { UserRole } from '../types/roles.types';

type InstitutionVerifyJob = {
  userId: string;
  token: string;
};

export const startInstitutionVerifyWorker = () => {
  const worker = createQueueWorker<InstitutionVerifyJob>(
    'institution-verify',
    async (job: QueueJob<InstitutionVerifyJob>) => {
      const { userId, token } = job.data;
      const user = await User.findById(userId);

      if (!user || user.role !== UserRole.STUDENT) {
        return;
      }

      if (user.institutionVerificationStatus === 'verified') {
        return;
      }

      let tokenRecord;
      try {
        tokenRecord = await resolveInstitutionToken(token);
      } catch (_error) {
        await User.findByIdAndUpdate(userId, {
          institutionVerificationStatus: 'failed',
          registrationStage: 'basic',
          institutionId: null,
          institutionVerifiedAt: null,
        });

        await notificationQueue.add('send', {
          userId,
          type: 'system',
          title: 'Institution token not recognized',
          body: 'The token you entered could not be verified. Please check with your institution and try again.',
          link: '/dashboard/student/settings/institution',
        });
        return;
      }

      const institution = await User.findOne({
        _id: tokenRecord.institutionId,
        role: { $in: [UserRole.SCHOOL, UserRole.COLLEGE] },
        isActive: true,
      })
        .select('_id role displayName')
        .lean();

      if (!institution) {
        await User.findByIdAndUpdate(userId, {
          institutionVerificationStatus: 'failed',
          registrationStage: 'basic',
          institutionId: null,
          institutionVerifiedAt: null,
        });

        await notificationQueue.add('send', {
          userId,
          type: 'system',
          title: 'Institution token not recognized',
          body: 'The token you entered could not be verified. Please check with your institution and try again.',
          link: '/dashboard/student/settings/institution',
        });
        return;
      }

      const verifiedAt = new Date();
      await User.findByIdAndUpdate(userId, {
        institutionId: institution._id,
        institutionVerificationStatus: 'verified',
        institutionVerifiedAt: verifiedAt,
        registrationStage: 'institution_pending',
        accessGrantedBy: institution.role === UserRole.SCHOOL ? 'startup_school' : 'skill_dev',
        accessExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        verificationStatus: 'pending',
        verificationRejectedAt: undefined,
        verificationRejectedReason: undefined,
      });

      await registerTokenUsage(String(tokenRecord._id));

      await notificationQueue.add('send', {
        userId,
        type: 'system',
        title: `Institution verified: ${institution.displayName}`,
        body: 'Your institution has been linked. You now appear on their leaderboard.',
        link: '/dashboard/student/profile',
      });

      await notificationQueue.add('send', {
        userId: String(institution._id),
        type: 'system',
        title: 'New student joined via institution token',
        body: 'A student has verified using your token and joined your leaderboard.',
      });
    },
  );

  return worker;
};
