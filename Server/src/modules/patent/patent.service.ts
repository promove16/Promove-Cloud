import { z } from 'zod';
import { notificationQueue } from '../../config/bullmq';
import { applyScoreAsync } from '../../services/scoreEngine';
import { Patent } from './patent.model';

export const patentSubmissionSchema = z.object({
  projectTitle: z.string().trim().min(2).max(200),
  workspaceId: z.string().optional(),
  questionnaire: z.object({
    whatIsYourInnovation: z.string().trim().min(50),
    noveltyExplanation: z.string().trim().min(50),
    technicalDetails: z.string().trim().min(50),
    marketUseCase: z.string().trim().min(50),
    priorArtAwareness: z.string().trim().min(50),
  }),
});

export const submitPatent = async (userId: string, payload: z.infer<typeof patentSubmissionSchema>) => {
  const patent = await Patent.create({
    studentId: userId,
    workspaceId: payload.workspaceId,
    projectTitle: payload.projectTitle,
    questionnaire: payload.questionnaire,
    status: 'submitted',
    submittedAt: new Date(),
  });

  await applyScoreAsync({
    userId,
    trigger: 'PATENT_SUBMITTED',
    metadata: { patentId: String(patent._id) },
  });

  await notificationQueue.add('patent-admin', {
    userId,
    type: 'patent_status',
    title: 'Patent submission received',
    body: `Your patent submission for ${payload.projectTitle} is now in review.`,
    link: '/patent-support',
  });

  return patent.toObject();
};

export const getMyPatents = async (userId: string) =>
  Patent.find({ studentId: userId }).sort({ createdAt: -1 }).lean();
