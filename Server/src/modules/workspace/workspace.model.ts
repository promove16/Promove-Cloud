import { Schema, model } from 'mongoose';
import { IWorkspace } from './workspace.types';

const milestoneNames = [
  'Research & Planning',
  'Design & Prototyping',
  'Development',
  'Testing & Validation',
  'Final Delivery',
] as const;

const workspaceSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
    teamMemberIds: { type: [Schema.Types.ObjectId], required: true, default: [] },
    claimedProblemId: { type: Schema.Types.ObjectId, default: undefined, index: true },
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    stage: {
      type: String,
      required: true,
      enum: ['Ideation', 'Problem', 'Build', 'Patent', 'Launch'],
      default: 'Problem',
    },
    progressPercent: { type: Number, default: 0 },
    milestones: {
      type: [
        new Schema(
          {
            name: { type: String, enum: milestoneNames, required: true },
            isCompleted: { type: Boolean, default: false },
            completedAt: { type: Date, default: undefined },
            completedBy: { type: Schema.Types.ObjectId, default: undefined },
            completionPercent: { type: Number, default: 0 },
          },
          { _id: true },
        ),
      ],
      default: () =>
        milestoneNames.map((name) => ({
          name,
          isCompleted: false,
          completionPercent: 0,
        })),
    },
    tasks: {
      type: [
        new Schema(
          {
            title: { type: String, required: true, trim: true },
            priority: { type: String, enum: ['High', 'Medium', 'Low'], default: 'Medium' },
            assignedTo: { type: Schema.Types.ObjectId, default: undefined },
            dueDate: { type: Date, default: undefined },
            done: { type: Boolean, default: false },
            createdAt: { type: Date, default: () => new Date() },
          },
          { _id: true },
        ),
      ],
      default: [],
    },
    uploads: {
      type: [
        new Schema(
          {
            fileUrl: { type: String, required: true },
            fileType: { type: String, enum: ['pdf', 'image', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'video', 'audio', 'other'], required: true },
            fileName: { type: String, required: true },
            fileSizeBytes: { type: Number, required: true },
            uploadedBy: { type: Schema.Types.ObjectId, required: true },
            uploadedAt: { type: Date, default: () => new Date() },
            note: { type: String, default: undefined },
            category: { type: String, enum: ['bug_report', 'error_log', 'screenshot', 'test_result', 'design_mockup', 'other'], default: 'other' },
            storageProvider: { type: String, enum: ['cloudinary', 's3'], default: undefined },
            storageKey: { type: String, default: undefined },
            cloudinaryPublicId: { type: String, default: undefined },
            mimeType: { type: String, default: undefined },
          },
          { _id: true },
        ),
      ],
      default: [],
    },
    repoSubmissions: {
      type: [
        new Schema(
          {
            provider: { type: String, enum: ['github'], required: true },
            repoUrl: { type: String, required: true, trim: true, maxlength: 300 },
            displayName: { type: String, required: true, trim: true, maxlength: 160 },
            branch: { type: String, default: undefined, trim: true, maxlength: 120 },
            commitHash: { type: String, default: undefined, trim: true, maxlength: 40 },
            note: { type: String, default: undefined, trim: true, maxlength: 300 },
            uploadedBy: { type: Schema.Types.ObjectId, required: true },
            uploadedAt: { type: Date, default: () => new Date() },
          },
          { _id: true },
        ),
      ],
      default: [],
    },
    codeSubmissions: {
      type: [
        new Schema(
          {
            title: { type: String, required: true, trim: true, maxlength: 120 },
            language: { type: String, required: true, trim: true, maxlength: 60 },
            summary: { type: String, default: undefined, trim: true, maxlength: 300 },
            codeSnippet: { type: String, required: true, maxlength: 8000 },
            lineCount: { type: Number, required: true, min: 1, max: 500 },
            uploadedBy: { type: Schema.Types.ObjectId, required: true },
            uploadedAt: { type: Date, default: () => new Date() },
          },
          { _id: true },
        ),
      ],
      default: [],
    },
    progressUpdates: {
      type: [
        new Schema(
          {
            submittedBy: { type: Schema.Types.ObjectId, required: true },
            note: { type: String, required: true, trim: true },
            milestoneRef: { type: String, default: undefined },
            submittedAt: { type: Date, default: () => new Date() },
          },
          { _id: true },
        ),
      ],
      default: [],
    },
    chatParticipants: {
      type: [
        new Schema(
          {
            userId: { type: Schema.Types.ObjectId, required: true },
            role: { type: String, enum: ['mentor', 'investor'], required: true },
            addedBy: { type: Schema.Types.ObjectId, required: true },
            addedAt: { type: Date, default: () => new Date() },
          },
          { _id: true },
        ),
      ],
      default: [],
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

workspaceSchema.index({ teamMemberIds: 1 });
workspaceSchema.index(
  { ownerId: 1, claimedProblemId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isActive: true,
      claimedProblemId: { $type: 'objectId' },
    },
  },
);

export const Workspace = model<IWorkspace>('Workspace', workspaceSchema);
