import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { ApiError } from '../../utils/ApiError';
import { ApiResponse } from '../../utils/ApiResponse';
import { MentorResource } from './mentorResource.model';
import { awardMentorPoints } from './mentorScore.service';
import { MentorScoreTrigger } from './mentorScore.types';

const DOWNLOAD_MILESTONE = 10;
const MILESTONE_POINTS   = 20;

// ─── Mentor: Upload Resource ──────────────────────────────────────────────────

export const uploadResource = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Not authenticated');

  const { title, description, type, fileUrl, tags } = req.body as {
    title:        string;
    description?: string;
    type:         'case_study' | 'guide' | 'template';
    fileUrl:      string;
    tags?:        string[];
  };

  if (!title || !type || !fileUrl) {
    throw new ApiError(400, 'MISSING_FIELDS', 'title, type, and fileUrl are required');
  }

  const resource = await MentorResource.create({
    mentorId:    req.user._id,
    title:       title.trim(),
    description: description?.trim() ?? '',
    type,
    fileUrl,
    tags:        tags ?? [],
  });

  res.status(201).json(new ApiResponse(resource));
};

// ─── Anyone: List Resources ───────────────────────────────────────────────────

export const listResources = async (req: Request, res: Response) => {
  const type     = req.query.type     as string | undefined;
  const tag      = req.query.tag      as string | undefined;
  const curated  = req.query.curated  === 'true';
  const page     = Math.max(1, parseInt(String(req.query.page))  || 1);
  const limit    = Math.min(50, Math.max(1, parseInt(String(req.query.limit)) || 20));
  const skip     = (page - 1) * limit;

  const filter: Record<string, unknown> = {};
  if (type)    filter.type             = type;
  if (tag)     filter.tags             = tag;
  if (curated) filter.isCuratedByAdmin = true;

  const [resources, total] = await Promise.all([
    MentorResource.find(filter)
      .sort({ downloadCount: -1 })
      .skip(skip)
      .limit(limit)
      .populate('mentorId', 'displayName avatar headline')
      .lean(),
    MentorResource.countDocuments(filter),
  ]);

  res.json(new ApiResponse({ resources, total, page, limit }));
};

// ─── Anyone: Download Resource (tracks unique users + multi-milestone) ────────

export const downloadResource = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Not authenticated');

  const resourceId = String(req.params.id);
  const userId     = new Types.ObjectId(String(req.user._id));

  // Atomically add to unique downloaders and increment raw count
  const resource = await MentorResource.findByIdAndUpdate(
    resourceId,
    { $addToSet: { downloadedByUsers: userId }, $inc: { downloadCount: 1 } },
    { new: true },
  );

  if (!resource) throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'Resource not found');

  const uniqueCount       = resource.downloadedByUsers.length;
  const expectedMilestones = Math.floor(uniqueCount / DOWNLOAD_MILESTONE);

  // Replay every reached milestone through the idempotent score gateway before
  // recording it on the resource. This also heals a previous partial failure
  // where the resource milestone was saved but the score event was not.
  for (let milestone = 1; milestone <= expectedMilestones; milestone += 1) {
    await awardMentorPoints({
      mentorId: resource.mentorId,
      trigger: MentorScoreTrigger.RESOURCE_MILESTONE_REACHED,
      delta: MILESTONE_POINTS,
      phase: 3,
      idempotencyKey: `resource_milestone:${resourceId}:${milestone}`,
      metadata: { resourceId, milestone, uniqueCount },
    });
  }

  if (expectedMilestones > 0) {
    await MentorResource.updateOne(
      { _id: resourceId },
      { $max: { milestonesAwarded: expectedMilestones } },
    );
  }

  res.json(new ApiResponse({ fileUrl: resource.fileUrl, title: resource.title }));
};

// ─── Anyone: Save / Unsave Resource ──────────────────────────────────────────

export const toggleSaveResource = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Not authenticated');

  const resourceId = String(req.params.id);
  const userId     = new Types.ObjectId(String(req.user._id));

  const resource = await MentorResource.findById(resourceId);
  if (!resource) throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'Resource not found');

  const alreadySaved = resource.savedByUsers.some((id) => id.equals(userId));

  if (alreadySaved) {
    await MentorResource.updateOne(
      { _id: resourceId },
      { $pull: { savedByUsers: userId }, $inc: { savedCount: -1 } },
    );
    return res.json(new ApiResponse({ saved: false }));
  }

  const updated = await MentorResource.findByIdAndUpdate(
    resourceId,
    { $addToSet: { savedByUsers: userId }, $inc: { savedCount: 1 } },
    { new: true },
  );

  res.json(new ApiResponse({ saved: true, savedCount: updated?.savedCount }));
};

// ─── Admin: Flag as Curated ───────────────────────────────────────────────────

export const flagAsCurated = async (req: Request, res: Response) => {
  const resourceId     = String(req.params.id);
  const { curatorBonus } = req.body as { curatorBonus?: number };

  const resource = await MentorResource.findByIdAndUpdate(
    resourceId,
    { $set: { isCuratedByAdmin: true } },
    { new: true },
  );
  if (!resource) throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'Resource not found');

  if (curatorBonus && curatorBonus > 0) {
    await awardMentorPoints({
      mentorId:       resource.mentorId,
      trigger:        MentorScoreTrigger.ADMIN_ADJUSTMENT,
      delta:          curatorBonus,
      phase:          3,
      idempotencyKey: `curator_bonus:${resourceId}`,
      metadata:       { resourceId, reason: 'Master Contributor flag' },
    });
  }

  res.json(new ApiResponse(resource));
};
