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
        'patent_certificate',
        'system_generated',
        'supporting_evidence',
        'other',
      ],
      required: true,
    },
    reviewStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'revision_requested'],
      default: 'pending',
    },
    reviewNote: { type: String, default: undefined },
    reviewedAt: { type: Date, default: undefined },
    reviewedBy: { type: Schema.Types.ObjectId, default: undefined },
    uploadedAt: { type: Date, default: () => new Date() },
    storageProvider: { type: String, enum: ['cloudinary', 's3'], default: undefined },
    storageKey: { type: String, default: undefined },
  },
  { _id: true },
);

const officialHandoverSchema = new Schema<NonNullable<IPatentRequest['officialHandover']>>(
  {
    documents: { type: [requestDocSchema], default: [] },
    note: { type: String, default: undefined },
    handedOverAt: { type: Date, default: undefined },
    handedOverBy: { type: Schema.Types.ObjectId, default: undefined },
    studentAcknowledgedAt: { type: Date, default: undefined },
    studentAcknowledgedBy: { type: Schema.Types.ObjectId, default: undefined },
  },
  { _id: false },
);

const patentRequestSchema = new Schema<IPatentRequest>(
  {
    studentId: { type: Schema.Types.ObjectId, required: true, index: true },
    workspaceId: { type: Schema.Types.ObjectId, default: undefined },

    // Simple support request fields (optional for basic requests)
    projectTitle: { type: String, default: undefined },
    description: { type: String, default: undefined },
    patentType: { type: String, enum: ['invention', 'design', 'trademark'], default: undefined },

    // Intake questionnaire (submitted when student chooses ProMove-assisted filing)
    questionnaire: {
      type: new Schema(
        {
          problemStatement: { type: String, default: '' },
          solutionDifferentiation: { type: String, default: '' },
          coreInnovation: { type: String, default: '' },
          priorArtStatus: { type: String, default: '' },
          workingMechanism: { type: String, default: '' },
          keyComponents: { type: String, default: '' },
          developmentStage: { type: String, default: '' },
          documentationReadiness: { type: String, default: '' },
          inventorOwnership: { type: String, default: '' },
          developmentContext: { type: String, default: '' },
          targetMarkets: { type: String, default: '' },
          commercializationStrategy: { type: String, default: '' },
          publicDisclosureStatus: { type: String, default: '' },
          legalAgreements: { type: String, default: '' },
          ipProtectionType: { type: String, default: '' },
        },
        { _id: false },
      ),
      default: undefined,
    },

    // Form 1 — Application for grant of patent
    inventionTitle: { type: String, default: undefined },
    inventionCategory: {
      type: String,
      enum: ['mobile_app_backend', 'iot_hardware_interface', 'mechanical_improvement', 'software_hardware_integration', 'other'],
      default: undefined,
    },
    applicantDetails: { type: applicantSchema, default: undefined },
    inventors: { type: [inventorSchema], default: [] },

    // Form 2 — Specification
    specificationType: {
      type: String,
      enum: ['provisional', 'complete'],
      default: 'provisional',
    },
    technicalField: { type: String, default: '' },
    backgroundArt: { type: String, default: '' },
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

    // Form 26 — Power of attorney (conditional on agent/attorney usage)
    powerOfAttorneyGranted: { type: Boolean, default: false },
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
    officialHandover: { type: officialHandoverSchema, default: undefined },

    // Status & tracking
    status: {
      type: String,
      enum: ['draft', 'submitted', 'documents_review', 'ready_for_filing', 'filed_with_ipo', 'published', 'examination_requested', 'fer_issued', 'fer_response_submitted', 'granted', 'rejected', 'abandoned',
        /* legacy compat */ 'under_review', 'in_progress', 'filed', 'completed', 'cancelled', 'filing_in_progress'],
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

    // Deadlines
    completeSpecDeadline: { type: Date, default: undefined },
    examRequestDeadline: { type: Date, default: undefined },
    ferResponseDeadline: { type: Date, default: undefined },

    // Legal metadata
    publicationDate: { type: Date, default: undefined },
    grantDate: { type: Date, default: undefined },
    controllerOffice: { type: String, default: undefined },
    examRequestForm: { type: String, enum: ['18', '18A'], default: undefined },
    expeditedGround: { type: String, default: undefined },
    section39Check: { type: Boolean, default: false },

    // Internal notes (admin-only)
    internalNotes: {
      type: [
        new Schema(
          {
            text: { type: String, required: true },
            createdAt: { type: Date, default: () => new Date() },
            createdBy: { type: Schema.Types.ObjectId, required: true },
          },
          { _id: true },
        ),
      ],
      default: [],
    },
  },
  { timestamps: true },
);

patentRequestSchema.index({ studentId: 1, status: 1 });
patentRequestSchema.index({ status: 1, adminAssignedTo: 1 });
patentRequestSchema.index({ completeSpecDeadline: 1 });

export const PatentRequest = model<IPatentRequest>('PatentRequest', patentRequestSchema);
