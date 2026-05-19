import {
  QueueJob,
  bidExpiryQueue,
  createQueueWorker,
  hasActiveBullMqRedisConnection,
  hasBullMqRedisConnection,
} from '../config/bullmq';
import { logError, logger } from '../config/logger';
import { Bid } from '../modules/bidding/bidding.model';
import { BIDDING_EXPIRY_DAYS, BIDDING_SOLE_AUTO_CLOSE_DAYS } from '../modules/bidding/bidding.types';

type BidExpiryJobData = {
  type: 'bid_expiry_check';
  triggeredAt: string;
};

const BID_EXPIRY_SCHEDULER_ID = 'bid-expiry-every-5-minutes';

export const startBidExpiryWorker = () =>
  createQueueWorker<BidExpiryJobData>(
    'bid-expiry',
    async (job: QueueJob<BidExpiryJobData>) => {
      if (job.data.type !== 'bid_expiry_check') {
        logger.warn('Skipping unknown bid expiry job', { jobName: job.name, jobId: job.id });
        return;
      }

      const now = new Date();
      const expiryThreshold = new Date(now.getTime() - BIDDING_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
      const soleCloseThreshold = new Date(now.getTime() - BIDDING_SOLE_AUTO_CLOSE_DAYS * 24 * 60 * 60 * 1000);
      const viewedExpiryThreshold = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

      const expired = await Bid.updateMany(
        {
          status: { $in: ['pending', 'negotiating'] },
          createdAt: { $lte: expiryThreshold },
          expiresAt: { $lte: now },
        },
        { $set: { status: 'expired' } },
      );

      const staleViewed = await Bid.updateMany(
        {
          status: 'viewed',
          viewedAt: { $lte: viewedExpiryThreshold },
        },
        { $set: { status: 'expired' } },
      );

      const soleAcceptedClose = await Bid.updateMany(
        {
          status: 'accepted',
          bidType: 'sole',
          acceptedAt: { $lte: soleCloseThreshold },
        },
        { $set: { status: 'closed' } },
      );

      if (expired.modifiedCount > 0 || staleViewed.modifiedCount > 0 || soleAcceptedClose.modifiedCount > 0) {
        logger.info('Bid expiry cleanup completed', {
          expired: expired.modifiedCount,
          staleViewed: staleViewed.modifiedCount,
          soleClosed: soleAcceptedClose.modifiedCount,
        });
      }
    },
    { concurrency: 1 },
  );

export const scheduleBidExpiryJob = async () => {
  if (!hasBullMqRedisConnection) {
    logger.warn('Skipping bid expiry scheduler because BullMQ Redis is not configured.');
    return;
  }

  if (!hasActiveBullMqRedisConnection()) {
    logger.warn('Skipping bid expiry scheduler because BullMQ Redis transport is unavailable.');
    return;
  }

  try {
    await bidExpiryQueue.add(
      'bid-expiry:check',
      {
        type: 'bid_expiry_check',
        triggeredAt: new Date().toISOString(),
      },
      {
        repeat: { every: 5 * 60 * 1000 },
        jobId: BID_EXPIRY_SCHEDULER_ID,
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    );

    logger.info('Bid expiry scheduler registered', { interval: '5 minutes' });
  } catch (error) {
    logError('Failed to schedule bid expiry job', error);
  }
};


