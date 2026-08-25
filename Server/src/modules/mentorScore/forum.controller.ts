import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { ApiError } from '../../utils/ApiError';
import { ApiResponse } from '../../utils/ApiResponse';
import { ForumPost, ForumAnswer } from './forum.model';
import { awardMentorPoints } from './mentorScore.service';
import { MentorScoreTrigger } from './mentorScore.types';
import { UserRole } from '../../types/roles.types';

const HELPFUL_VOTE_POINTS       = 5;
const VERIFIED_SOLUTION_POINTS  = 15;

// ─── Posts ────────────────────────────────────────────────────────────────────

export const createPost = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Not authenticated');

  const { title, body, tags } = req.body as {
    title: string;
    body:  string;
    tags?: string[];
  };

  if (!title?.trim() || !body?.trim()) {
    throw new ApiError(400, 'MISSING_FIELDS', 'title and body are required');
  }

  const post = await ForumPost.create({
    authorId:   req.user._id,
    authorRole: req.user.role,
    title:      title.trim(),
    body:       body.trim(),
    tags:       tags ?? [],
  });

  res.status(201).json(new ApiResponse(post));
};

export const listPosts = async (req: Request, res: Response) => {
  const tag    = req.query.tag    as string | undefined;
  const solved = req.query.solved as string | undefined;
  const page   = Math.max(1, parseInt(String(req.query.page))  || 1);
  const limit  = Math.min(50, Math.max(1, parseInt(String(req.query.limit)) || 20));
  const skip   = (page - 1) * limit;

  const filter: Record<string, unknown> = {};
  if (tag)            filter.tags   = tag;
  if (solved === 'true')  filter.solved = true;
  if (solved === 'false') filter.solved = false;

  // Track view count only if a single post is being accessed elsewhere;
  // list view increments are skipped intentionally
  const [posts, total] = await Promise.all([
    ForumPost.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('authorId', 'displayName avatar role')
      .lean(),
    ForumPost.countDocuments(filter),
  ]);

  res.json(new ApiResponse({ posts, total, page, limit }));
};

export const getPost = async (req: Request, res: Response) => {
  const postId = String(req.params.id);

  const [post] = await Promise.all([
    ForumPost.findByIdAndUpdate(postId, { $inc: { viewCount: 1 } }, { new: true })
      .populate('authorId', 'displayName avatar role headline')
      .lean(),
  ]);

  if (!post) throw new ApiError(404, 'POST_NOT_FOUND', 'Post not found');

  const answers = await ForumAnswer.find({ postId })
    .sort({ isVerifiedSolution: -1, helpfulCount: -1 })
    .populate('authorId', 'displayName avatar role headline')
    .lean();

  res.json(new ApiResponse({ post, answers }));
};

// ─── Answers ──────────────────────────────────────────────────────────────────

export const createAnswer = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Not authenticated');

  const postId = String(req.params.postId);
  const { body } = req.body as { body: string };

  if (!body?.trim()) throw new ApiError(400, 'BODY_REQUIRED', 'Answer body is required');

  const post = await ForumPost.findById(postId);
  if (!post) throw new ApiError(404, 'POST_NOT_FOUND', 'Post not found');

  const answer = await ForumAnswer.create({
    postId,
    authorId:   req.user._id,
    authorRole: req.user.role,
    body:       body.trim(),
  });

  await ForumPost.updateOne({ _id: postId }, { $inc: { answerCount: 1 } });

  res.status(201).json(new ApiResponse(answer));
};

// ─── Helpful Vote ─────────────────────────────────────────────────────────────

export const markHelpful = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Not authenticated');

  const answerId = String(req.params.answerId);
  const voterId  = new Types.ObjectId(String(req.user._id));

  const answer = await ForumAnswer.findById(answerId);
  if (!answer) throw new ApiError(404, 'ANSWER_NOT_FOUND', 'Answer not found');

  // Cannot vote on your own answer
  if (answer.authorId.equals(voterId)) {
    throw new ApiError(400, 'CANNOT_VOTE_OWN', 'You cannot mark your own answer as helpful');
  }

  // Idempotent toggle — remove vote if already cast
  const alreadyVoted = answer.helpfulVotes.some((id) => id.equals(voterId));
  if (alreadyVoted) {
    await ForumAnswer.updateOne(
      { _id: answerId },
      { $pull: { helpfulVotes: voterId }, $inc: { helpfulCount: -1 } },
    );
    return res.json(new ApiResponse({ helpful: false }));
  }

  await ForumAnswer.updateOne(
    { _id: answerId },
    { $addToSet: { helpfulVotes: voterId }, $inc: { helpfulCount: 1 } },
  );

  // Award points only if the answer author is a mentor
  if (answer.authorRole === UserRole.MENTOR) {
    await awardMentorPoints({
      mentorId:       answer.authorId,
      trigger:        MentorScoreTrigger.FORUM_ANSWER_HELPFUL,
      delta:          HELPFUL_VOTE_POINTS,
      phase:          3,
      idempotencyKey: `forum_helpful:${answerId}:${String(voterId)}`,
      metadata:       { postId: answer.postId, answerId, voterId: String(voterId) },
    });
  }

  res.json(new ApiResponse({ helpful: true }));
};

// ─── Mark Verified Solution ──────────────────────────────────────────────────
// The student who asked the question can verify one answer as the solution.
// Admins can verify on behalf of the author as well.

export const markVerifiedSolution = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Not authenticated');

  const answerId = String(req.params.answerId);

  const answer = await ForumAnswer.findById(answerId);
  if (!answer) throw new ApiError(404, 'ANSWER_NOT_FOUND', 'Answer not found');

  if (answer.isVerifiedSolution) {
    return res.json(new ApiResponse({ message: 'Already marked as verified solution' }));
  }

  // One verified solution per post
  const alreadyHasSolution = await ForumAnswer.exists({
    postId: answer.postId,
    isVerifiedSolution: true,
  });
  if (alreadyHasSolution) {
    throw new ApiError(400, 'POST_ALREADY_SOLVED', 'This post already has a verified solution');
  }

  const post = await ForumPost.findById(answer.postId).select('authorId').lean();
  if (!post) throw new ApiError(404, 'POST_NOT_FOUND', 'Post not found');

  const isAdmin      = req.user.role === UserRole.ADMIN;
  const isPostAuthor = post.authorId.equals(req.user._id);

  if (!isAdmin && !isPostAuthor) {
    throw new ApiError(403, 'NOT_ALLOWED', 'Only the post author or an admin can verify a solution');
  }

  // A user cannot verify their own answer as the solution
  if (answer.authorId.equals(req.user._id)) {
    throw new ApiError(400, 'CANNOT_VERIFY_OWN', 'You cannot mark your own answer as the verified solution');
  }

  await ForumAnswer.updateOne({ _id: answerId }, { $set: { isVerifiedSolution: true } });
  await ForumPost.updateOne({ _id: answer.postId }, { $set: { solved: true } });

  if (answer.authorRole === UserRole.MENTOR) {
    await awardMentorPoints({
      mentorId:       answer.authorId,
      trigger:        MentorScoreTrigger.FORUM_VERIFIED_SOLUTION,
      delta:          VERIFIED_SOLUTION_POINTS,
      phase:          3,
      idempotencyKey: `forum_verified:${answerId}`,
      metadata:       { postId: answer.postId, answerId },
    });
  }

  res.json(new ApiResponse({ verified: true }));
};
