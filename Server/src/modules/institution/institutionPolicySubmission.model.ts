import { Schema, Types, model } from 'mongoose';
import type { InstitutionPolicy } from '../user/user.types';

export const institutionPolicySubmissionStatus = ['pending', 'approved', 'rejected', 'edit_requested'] as const;

export interface IInstitutionPolicySubmission {
  _id: Types.ObjectId;
  institutionId: Types.ObjectId;
  institutionType: 'school' | 'college';
  policies: InstitutionPolicy[];
  summaryNote?: string;
  status: (typeof institutionPolicySubmissionStatus)[number];
  submittedBy: Types.ObjectId;
  submittedAt: Date;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  adminNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const policySchema = new Schema<IInstitutionPolicySubmission['policies'][number]>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    status: {
      type: String,
      enum: ['Active', 'On Track', 'Pending', 'Inactive'],
      required: true,
    },
    lastUpdated: {
      type: Date,
      default: undefined,
    },
    evidence: {
      type: [
        new Schema<IInstitutionPolicySubmission['policies'][number]['evidence'][number]>(
          {
            title: {
              type: String,
              required: true,
              trim: true,
              maxlength: 160,
            },
            type: {
              type: String,
              enum: [
                'policy_document',
                'activity_report',
                'attendance_log',
                'photo',
                'video',
                'meeting_minutes',
                'certificate',
                'mou',
                'external_audit',
                'other',
              ],
              required: true,
            },
            url: {
              type: String,
              required: true,
              trim: true,
              maxlength: 2048,
            },
            notes: {
              type: String,
              trim: true,
              maxlength: 600,
              default: undefined,
            },
            submittedAt: {
              type: Date,
              default: undefined,
            },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { _id: false },
);

const institutionPolicySubmissionSchema = new Schema<IInstitutionPolicySubmission>(
  {
    institutionId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    institutionType: {
      type: String,
      enum: ['school', 'college'],
      required: true,
    },
    policies: {
      type: [policySchema],
      default: [],
    },
    summaryNote: {
      type: String,
      trim: true,
      maxlength: 1500,
      default: undefined,
    },
    status: {
      type: String,
      enum: institutionPolicySubmissionStatus,
      default: 'pending',
      index: true,
    },
    submittedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    submittedAt: {
      type: Date,
      default: () => new Date(),
      index: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: undefined,
    },
    reviewedAt: {
      type: Date,
      default: undefined,
    },
    adminNotes: {
      type: String,
      trim: true,
      maxlength: 1500,
      default: undefined,
    },
  },
  { timestamps: true },
);

institutionPolicySubmissionSchema.index({ institutionId: 1, updatedAt: -1 });
institutionPolicySubmissionSchema.index({ status: 1, submittedAt: -1 });

export const InstitutionPolicySubmission = model<IInstitutionPolicySubmission>(
  'InstitutionPolicySubmission',
  institutionPolicySubmissionSchema,
);
