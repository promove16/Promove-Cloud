import { Types } from 'mongoose';
import { z } from 'zod';
import { logError } from '../../config/logger';
import { deleteStoredAsset, uploadFile } from '../../services/fileStorageService';
import { UserRole } from '../../types/roles.types';
import { ApiError } from '../../utils/ApiError';
import {
  INSTITUTION_DOCUMENT_CATEGORIES,
  INSTITUTION_DOCUMENT_LABELS,
  INSTITUTION_REGULATORY_BODIES,
} from './institutionVerification.constants';
import type {
  InstitutionRegulatoryBody,
  InstitutionVerificationDocument,
  InstitutionVerificationProfile,
  InstitutionVerificationReadiness,
} from '../user/user.types';

const pdfFileNamePattern = /\.pdf$/i;
const documentFieldPrefix = 'institutionDocument:';

export const institutionRegulatoryBodySchema = z.enum(INSTITUTION_REGULATORY_BODIES);
export const institutionDocumentCategorySchema = z.enum(INSTITUTION_DOCUMENT_CATEGORIES);

export const institutionVerificationInputSchema = z.object({
  regulatoryBodies: z.array(institutionRegulatoryBodySchema).max(8).default([]),
  affiliationName: z.string().trim().min(2).max(160).optional(),
  websiteUrl: z.string().trim().url().max(300).optional(),
  referenceCode: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(500).optional(),
});

const uniqueRegulatoryBodies = (regulatoryBodies: InstitutionRegulatoryBody[]) =>
  Array.from(new Set(regulatoryBodies));

const getDocumentCategoryFromFieldName = (fieldName: string) => {
  if (!fieldName.startsWith(documentFieldPrefix)) {
    throw new ApiError(
      400,
      'INVALID_INSTITUTION_DOCUMENT_FIELD',
      'Institution documents must be uploaded with a supported document category.',
    );
  }

  return institutionDocumentCategorySchema.parse(fieldName.slice(documentFieldPrefix.length));
};

const getFileType = (file: Express.Multer.File) => {
  const isPdf =
    file.mimetype === 'application/pdf' || pdfFileNamePattern.test(file.originalname);
  const isImage = file.mimetype.startsWith('image/');

  if (!isPdf && !isImage) {
    throw new ApiError(400, 'INVALID_FILE_TYPE', 'Only PDF or image files are allowed');
  }

  return isPdf ? 'pdf' : 'image';
};

export const getRequiredInstitutionDocumentCategories = (
  role: UserRole.SCHOOL | UserRole.COLLEGE,
  regulatoryBodies: InstitutionRegulatoryBody[],
) => {
  const required = new Set<(typeof INSTITUTION_DOCUMENT_CATEGORIES)[number]>([
    'governing_body_registration_certificate',
    'authorized_signatory_letter',
    'address_proof',
    'pan_or_tax_registration',
  ]);

  if (role === UserRole.SCHOOL) {
    required.add('recognition_certificate');
    required.add('board_affiliation_certificate');
    required.add('udise_certificate');
  }

  if (role === UserRole.COLLEGE) {
    required.add('affiliation_letter');
  }

  if (regulatoryBodies.includes('AICTE')) {
    required.add('aicte_approval_letter');
  }

  if (regulatoryBodies.includes('UGC')) {
    required.add('ugc_recognition_letter');
  }

  if (regulatoryBodies.includes('NAAC') || regulatoryBodies.includes('NBA')) {
    required.add('accreditation_certificate');
  }

  return Array.from(required);
};

export const buildInstitutionVerificationReadiness = (
  role: UserRole.SCHOOL | UserRole.COLLEGE,
  verification: Pick<InstitutionVerificationProfile, 'regulatoryBodies' | 'documents'>,
): InstitutionVerificationReadiness => {
  const regulatoryBodies = uniqueRegulatoryBodies(verification.regulatoryBodies ?? []);
  const requiredDocumentCategories = getRequiredInstitutionDocumentCategories(
    role,
    regulatoryBodies,
  );
  const uploadedDocumentCategories = Array.from(
    new Set((verification.documents ?? []).map((document) => document.category)),
  );
  const missingItems = requiredDocumentCategories
    .filter((category) => !uploadedDocumentCategories.includes(category))
    .map((category) => INSTITUTION_DOCUMENT_LABELS[category]);

  return {
    isReadyForReview: missingItems.length === 0,
    requiredDocumentCategories,
    uploadedDocumentCategories,
    missingItems,
  };
};

const uploadInstitutionDocument = async (
  userId: string,
  file: Express.Multer.File,
  category: (typeof INSTITUTION_DOCUMENT_CATEGORIES)[number],
): Promise<InstitutionVerificationDocument> => {
  const fileType = getFileType(file);
  const uploaded = await uploadFile({
    buffer: file.buffer,
    folder: `promove/institution-verification/${userId}`,
    fileName: file.originalname,
    contentType: file.mimetype || (fileType === 'pdf' ? 'application/pdf' : 'image/jpeg'),
  });

  return {
    _id: new Types.ObjectId(),
    category,
    fileUrl: uploaded.url,
    fileType,
    fileName: file.originalname,
    fileSizeBytes: file.size,
    uploadedAt: new Date(),
    uploadedBy: new Types.ObjectId(userId),
    storageProvider: uploaded.provider,
    storageKey: uploaded.key,
  };
};

export const buildInstitutionVerificationProfile = async (input: {
  role: UserRole.SCHOOL | UserRole.COLLEGE;
  userId: string;
  verificationInput?: z.input<typeof institutionVerificationInputSchema>;
  files?: Express.Multer.File[];
}) => {
  const verificationInput = institutionVerificationInputSchema.parse(
    input.verificationInput ?? {},
  );
  const files = input.files ?? [];
  const seenCategories = new Set<(typeof INSTITUTION_DOCUMENT_CATEGORIES)[number]>();
  const documents: InstitutionVerificationDocument[] = [];

  for (const file of files) {
    const category = getDocumentCategoryFromFieldName(file.fieldname);

    if (seenCategories.has(category)) {
      throw new ApiError(
        400,
        'DUPLICATE_INSTITUTION_DOCUMENT',
        `Upload only one file for ${INSTITUTION_DOCUMENT_LABELS[category]}.`,
      );
    }

    seenCategories.add(category);
    documents.push(await uploadInstitutionDocument(input.userId, file, category));
  }

  const regulatoryBodies = uniqueRegulatoryBodies(verificationInput.regulatoryBodies);
  const readiness = buildInstitutionVerificationReadiness(input.role, {
    regulatoryBodies,
    documents,
  });

  if (!readiness.isReadyForReview) {
    throw new ApiError(
      400,
      'MISSING_INSTITUTION_DOCUMENTS',
      `Upload all required institution documents before submitting. Missing: ${readiness.missingItems.join(', ')}`,
    );
  }

  return {
    regulatoryBodies,
    ...(verificationInput.affiliationName
      ? { affiliationName: verificationInput.affiliationName }
      : {}),
    ...(verificationInput.websiteUrl ? { websiteUrl: verificationInput.websiteUrl } : {}),
    ...(verificationInput.referenceCode
      ? { referenceCode: verificationInput.referenceCode }
      : {}),
    ...(verificationInput.notes ? { notes: verificationInput.notes } : {}),
    documents,
    readiness,
  } satisfies InstitutionVerificationProfile;
};

export const assertInstitutionVerificationReadyForApproval = (
  role: UserRole.SCHOOL | UserRole.COLLEGE,
  verification?: InstitutionVerificationProfile,
) => {
  if (!verification) {
    throw new ApiError(
      400,
      'INSTITUTION_DOCUMENTS_REQUIRED',
      'Institution verification documents are required before approval.',
    );
  }

  const readiness = buildInstitutionVerificationReadiness(role, verification);

  if (!readiness.isReadyForReview) {
    throw new ApiError(
      400,
      'INSTITUTION_DOCUMENTS_INCOMPLETE',
      `Institution approval is blocked until all required documents are uploaded. Missing: ${readiness.missingItems.join(', ')}`,
    );
  }
};

export const cleanupInstitutionVerificationDocuments = async (documents?: InstitutionVerificationDocument[]) => {
  const cleanupTargets = documents ?? [];
  await Promise.all(
    cleanupTargets.map(async (document) => {
      try {
        await deleteStoredAsset({
          storageProvider: document.storageProvider,
          storageKey: document.storageKey,
          cloudinaryPublicId: document.cloudinaryPublicId,
          legacyCloudinaryResourceType: document.fileType === 'pdf' ? 'raw' : 'image',
        });
      } catch (error) {
        logError('Failed to delete institution verification document from storage', error);
      }
    }),
  );
};
