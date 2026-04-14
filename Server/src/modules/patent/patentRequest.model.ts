import { Schema, model } from 'mongoose';
import { IPatentRequest } from './patent.types';

const inventorSchema = new Schema<IPatentRequest['inventors'][number]>(
  {
    fullName: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    nationality: { type: String, required: true, trim: true },
    contribution: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const applicantSchema = new Schema<IPatentRequest['applicantDetails']>(
  {
    fullName: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    entityType: {
      type: String,
      enum: ['individual', 'startup', 'institution', 'small_entity'],
      required: true,
    },
    dpiitNumber: { type: String, default: undefined },
    institutionName: { type: String, default: undefined },
  },
  { _id: false },
);

const requestDocSchema = new Schema<IPatentRequest['documents'][number]>(
  {
    uploadId: { type: Schema.Types.ObjectId, default: undefined },
    fileUrl: { type: String, required: true },
    fileType: { type: String, enum: ['pdf', 'image'], required: true },
    fileName: { type: String, required: true },
    fileSizeBytes: { type: Number, required: true },
    note: { type: String, default: undefined },
    documentCategory: {
      type: String,
      enum: [
        'form1_application',
        'form2_specification',
        'form3_foreign_filing',
        'form5_inventorship',
        'form26_power_of_attorney',
        'form28_startup_status',
        'drawings',
        'prior_art_report',
        'assignment_deed',
        'priority_document',
        'other',
      ],
      required: true,
    },
  },
  { _id: false },
);

const patentRequestSchema = new Schema<IPatentRequest>(
  {
    studentId: { type: Schema.Types.ObjectId, required: true, index: true },
    workspaceId: { type: Schema.Types.ObjectId, default: undefined },

    // Form 1 — Application for grant of patent
    inventionTitle: { type: String, required: true, trim: true },
    inventionCategory: {
      type: String,
      enum: ['mobile_app_backend', 'iot_hardware_interface', 'mechanical_improvement', 'software_hardware_integration', 'other'],
      required: true,
    },
    applicantDetails: { type: applicantSchema, required: true },
    inventors: { type: [inventorSchema], required: true },

    // Form 2 — Specification
    specificationType: {
      type: String,
      enum: ['provisional', 'complete'],
      required: true,
    },
    technicalField: { type: String, required: true },
    backgroundArt: { type: String, required: true },
    inventionDescription: { type: String, required: true },
    abstractText: { type: String, required: true },
    claimsText: { type: String, required: true },
    drawingsDescription: { type: String, default: undefined },
    bestMode: { type: String, required: true },

    // Form 3 — Foreign filing statement
    hasFiledAbroad: { type: Boolean, required: true },
    foreignFilingCountries: { type: String, default: undefined },
    foreignApplicationNumbers: { type: String, default: undefined },

    // Form 5 — Declaration of inventorship
    inventorDeclarationConfirmed: { type: Boolean, required: true },

    // Form 26 — Power of attorney
    powerOfAttorneyGranted: { type: Boolean, required: true },
    attorneyDetails: { type: String, default: undefined },

    // Form 28 — Startup / small entity / institution status
    claimingFeeReduction: { type: Boolean, default: false },
    feeReductionEntityType: {
      type: String,
      enum: ['individual', 'startup', 'institution', 'small_entity'],
      default: undefined,
    },
    dpiitRecognitionNumber: { type: String, default: undefined },

    // Prior art & novelty
    priorArtSearchSummary: { type: String, required: true },
    priorArtReferences: { type: String, default: undefined },
    noveltyStatement: { type: String, required: true },

    // Examination plan
    proposedExaminationType: {
      type: String,
      enum: ['normal', 'expedited'],
      default: 'normal',
    },
    publicDisclosureStatus: { type: Boolean, required: true },

    // Documents
    documents: { type: [requestDocSchema], default: [] },

    // Status & tracking
    status: {
      type: String,
      enum: ['draft', 'submitted', 'documents_review', 'filing_in_progress', 'filed_with_ipo', 'examination_requested', 'granted', 'rejected'],
      default: 'submitted',
    },
    submittedAt: { type: Date, default: undefined },
    ipoApplicationNumber: { type: String, default: undefined },
    ipoFilingDate: { type: Date, default: undefined },
    ipoPriorityDate: { type: Date, default: undefined },
    adminAssignedTo: { type: Schema.Types.ObjectId, default: undefined },
    adminNotes: { type: String, default: undefined },
    scoreAwarded: { type: Boolean, default: false },
    trackingTimeline: {
      type: [
        new Schema(
          {
            status: { type: String, required: true },
            note: { type: String, default: undefined },
            updatedAt: { type: Date, default: () => new Date() },
            updatedBy: { type: Schema.Types.ObjectId, default: undefined },
          },
          { _id: true },
        ),
      ],
      default: [],
    },
    nextActionRequired: { type: String, default: undefined },
    lastStatusUpdate: { type: Date, default: undefined },
  },
  { timestamps: true },
);

patentRequestSchema.index({ studentId: 1, status: 1 });

export const PatentRequest = model<IPatentRequest>('PatentRequest', patentRequestSchema);
