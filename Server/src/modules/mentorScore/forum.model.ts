import { Schema, Types, model } from 'mongoose';

// ─── Forum Post ───────────────────────────────────────────────────────────────

export interface IForumPost {
  _id:         Types.ObjectId;
  authorId:    Types.ObjectId;
  authorRole:  string;
  title:       string;
  body:        string;
  tags:        string[];
  answerCount: number;
  viewCount:   number;
  solved:      boolean;
  createdAt:   Date;
  updatedAt:   Date;
}

const forumPostSchema = new Schema<IForumPost>(
  {
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    authorRole: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    body: {
      type: String,
      required: true,
      maxlength: 8000,
    },
    tags: {
      type: [String],
      default: [],
    },
    answerCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    viewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    solved: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

forumPostSchema.index({ tags: 1 });
forumPostSchema.index({ createdAt: -1 });
forumPostSchema.index({ answerCount: -1 });
forumPostSchema.index({ solved: 1 });

export const ForumPost = model<IForumPost>('ForumPost', forumPostSchema);

// ─── Forum Answer ─────────────────────────────────────────────────────────────

export interface IForumAnswer {
  _id:                Types.ObjectId;
  postId:             Types.ObjectId;
  authorId:           Types.ObjectId;
  authorRole:         string;
  body:               string;
  helpfulVotes:       Types.ObjectId[];
  helpfulCount:       number;
  isVerifiedSolution: boolean;
  pointsAwarded:      boolean;
  createdAt:          Date;
  updatedAt:          Date;
}

const forumAnswerSchema = new Schema<IForumAnswer>(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: 'ForumPost',
      required: true,
      index: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    authorRole: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
    body: {
      type: String,
      required: true,
      maxlength: 8000,
    },
    helpfulVotes: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    helpfulCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isVerifiedSolution: {
      type: Boolean,
      default: false,
    },
    pointsAwarded: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

forumAnswerSchema.index({ postId: 1, helpfulCount: -1 });
forumAnswerSchema.index({ authorId: 1 });
forumAnswerSchema.index({ isVerifiedSolution: 1 });

export const ForumAnswer = model<IForumAnswer>('ForumAnswer', forumAnswerSchema);
