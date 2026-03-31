import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { User } from '../user/user.model';
import { ApiError } from '../../utils/ApiError';
import { REPORT_REASONS, ReportReason, UserReport } from './report.model';

const allowedReportReasons = new Set<ReportReason>(REPORT_REASONS);

export const createReport = async (req: Request, res: Response) => {
  const reporterId = new Types.ObjectId(req.user!._id);
  const { reportedUserId, reason, description } = req.body as {
    reportedUserId: string;
    reason: ReportReason;
    description?: string;
  };

  if (!Types.ObjectId.isValid(reportedUserId as string)) {
    throw new ApiError(400, 'INVALID_ID', 'Invalid reported user ID');
  }

  if (reporterId.toString() === reportedUserId) {
    throw new ApiError(400, 'SELF_REPORT', 'You cannot report yourself');
  }

  if (!allowedReportReasons.has(reason)) {
    throw new ApiError(400, 'INVALID_REASON', 'Invalid report reason');
  }

  const reportedUserExists = await User.exists({ _id: reportedUserId });
  if (!reportedUserExists) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'Reported user not found');
  }

  const existingReport = await UserReport.findOne({
    reporterId,
    reportedUserId: new Types.ObjectId(reportedUserId as string),
    status: 'pending',
  });

  if (existingReport) {
    throw new ApiError(400, 'ALREADY_REPORTED', 'You have already submitted a pending report for this user');
  }

  const report = await UserReport.create({
    reporterId,
    reportedUserId: new Types.ObjectId(reportedUserId as string),
    reason,
    description: typeof description === 'string' ? description.trim() : '',
  });

  res.status(201).json({ success: true, data: report });
};

export const getMyReports = async (req: Request, res: Response) => {
  const reporterId = new Types.ObjectId(req.user!._id);

  const reports = await UserReport.find({ reporterId })
    .sort({ createdAt: -1 })
    .lean();

  res.json({ success: true, data: reports });
};
