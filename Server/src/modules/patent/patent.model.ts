import { Schema, model } from 'mongoose';
import { IPatent } from './patent.types';

const filingDocumentsSchema = new Schema<IPatent['filingDocuments']>(
  {
    inventionCategory: {
      type: String,
      enum: ['mobile_app_backend', 'iot_hardware_interface', 'mechanical_improvement', 'software_hardware_integration', 'other'],
      required: true,
    },
    specificationType: {
      type: String,
      enum: ['provisional', 'complete'],
      required: true,
    },
    inventorJournalSummary: { type: String, required: true },
    priorArtSearchSummary: { type: String, default: '' },
    prototypeStatus: {
      type: String,
      enum: ['concept_only', 'partial_prototype', 'working_prototype', 'validated_prototype'],
      required: true,
    },
    specificationDraft: { type: String, default: '' },
    abstractDraft: { type: String, default: '' },
    claimsDraft: { type: String, default: '' },
    drawingsPrepared: { type: Boolean, required: true },
    drawingsNotes: { type: String, default: '' },
    form1ApplicantDetailsConfirmed: { type: Boolean, required: true },
    form3ForeignFilingDetails: { type: String, default: undefined },
    form5InventorshipConfirmed: { type: Boolean, required: true },
    form26PowerOfAttorneyRequired: { type: Boolean, required: true },
    form26PowerOfAttorneyDetails: { type: String, default: undefined },
    examinationRequestPlan: { type: String, default: '' },
    publicDisclosureChecked: { type: Boolean, required: true },
    professionalSupportNeeded: { type: Boolean, required: true },
    costManagementNotes: { type: String, default: undefined },
  },
  { _id: false },
);

const supportingDocumentSchema = new Schema<IPatent['supportingDocuments'][number]>(
  {
    uploadId: { type: Schema.Types.ObjectId, default: undefined },
    fileUrl: { type: String, required: true },
    fileType: { type: String, enum: ['pdf', 'image'], required: true },
    fileName: { type: String, required: true },
    fileSizeBytes: { type: Number, required: true },
    note: { type: String, default: undefined },
    documentCategory: {
      type: String,
      enum: ['inventor_journal', 'prior_art_search', 'specification_draft', 'abstract_draft', 'claims_draft', 'drawings_diagrams', 'examination_request', 'form3_foreign_filing', 'cost_management'],
      default: undefined,
    },
  },
  { _id: false },
);

const patentSchema = new Schema<IPatent>(
  {
    studentId: { type: Schema.Types.ObjectId, required: true, index: true },
    workspaceId: { type: Schema.Types.ObjectId, default: undefined },
    projectTitle: { type: String, required: true, trim: true },
    questionnaire: {
      whatIsYourInnovation: { type: String, required: true },
      noveltyExplanation: { type: String, required: true },
      technicalDetails: { type: String, required: true },
      marketUseCase: { type: String, required: true },
      priorArtAwareness: { type: String, required: true },
    },
    filingDocuments: { type: filingDocumentsSchema, required: true },
    supportingDocuments: { type: [supportingDocumentSchema], default: [] },
    status: {
      type: String,
      enum: ['submitted', 'under_review', 'approved', 'rejected'],
      default: 'submitted',
    },
    submittedAt: { type: Date, default: () => new Date() },
    adminReviewedAt: { type: Date, default: undefined },
    adminReviewedBy: { type: Schema.Types.ObjectId, default: undefined },
    adminNotes: { type: String, default: undefined },
    scoreAwarded: { type: Boolean, default: false },
  },
  { timestamps: true },
);

patentSchema.index({ studentId: 1, status: 1 });

export const Patent = model<IPatent>('Patent', patentSchema);
