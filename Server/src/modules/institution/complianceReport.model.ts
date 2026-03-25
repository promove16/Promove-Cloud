import { Schema, Types, model } from 'mongoose';

export interface IComplianceReport {
  _id: Types.ObjectId;
  institutionId: Types.ObjectId;
  institutionType: 'school' | 'college';
  generatedAt: Date;
  pdfUrl: string;
  academicYear: string;
  kpis: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

const complianceReportSchema = new Schema<IComplianceReport>(
  {
    institutionId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    institutionType: {
      type: String,
      enum: ['school', 'college'],
      required: true,
    },
    generatedAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
    pdfUrl: {
      type: String,
      required: true,
      trim: true,
    },
    academicYear: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
    },
    kpis: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

complianceReportSchema.index({ institutionId: 1, generatedAt: -1 });

export const ComplianceReport = model<IComplianceReport>(
  'ComplianceReport',
  complianceReportSchema,
);
