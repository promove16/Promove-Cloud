import { z } from 'zod';
import * as XLSX from 'xlsx';
import { UserRole } from '../../types/roles.types';
import { ApiError } from '../../utils/ApiError';
import { sanitizePlainText } from '../../utils/sanitizeText';
import { User } from '../user/user.model';
import {
  InstitutionStudentRosterEntry,
  IInstitutionStudentRosterEntry,
  StudentRosterSource,
  StudentRosterStatus,
} from './studentRoster.model';

const optionalRosterField = (max: number) =>
  z
    .union([z.string().trim().max(max), z.literal('')])
    .optional()
    .transform((value) => {
      if (!value) {
        return undefined;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    });

export const studentRosterEntrySchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  gradeOrProgram: optionalRosterField(120),
  rollNumber: optionalRosterField(80),
  notes: optionalRosterField(300),
});

export const manualStudentRosterEntrySchema = studentRosterEntrySchema;

export const listStudentRosterQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
});

type StudentRosterInput = z.infer<typeof studentRosterEntrySchema>;

type StudentRosterLinkedUser = {
  _id: { toString(): string };
  institutionId?: { toString(): string } | null;
  verificationStatus?: 'pending' | 'verified' | 'rejected' | 'not_required';
};

export type StudentRosterEntryView = {
  _id: string;
  displayName: string;
  email: string;
  status: StudentRosterStatus;
  onboardingStatus: 'listed' | 'pending_verification' | 'verified' | 'rejected';
  source: StudentRosterSource;
  createdAt: Date;
  updatedAt: Date;
  gradeOrProgram?: string;
  rollNumber?: string;
  notes?: string;
  linkedUserId?: string;
  registeredAt?: Date;
  reviewedAt?: Date;
};

export type StudentRosterImportSummary = {
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  created: number;
  updated: number;
  skipped: number;
  importedRows: number;
  entries: StudentRosterEntryView[];
  errors: Array<{
    row: number;
    email?: string;
    message: string;
  }>;
};

const assertInstitutionRole = async (
  institutionId: string,
  institutionRole: UserRole.SCHOOL | UserRole.COLLEGE,
) => {
  const institution = await User.findById(institutionId).select('_id role displayName').lean();

  if (!institution || institution.role !== institutionRole) {
    throw new ApiError(404, 'INSTITUTION_NOT_FOUND', 'Institution account not found');
  }

  return institution;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const deriveRosterStatus = (user?: StudentRosterLinkedUser | null): StudentRosterStatus => {
  if (!user) {
    return 'invited';
  }

  if (user.verificationStatus === 'verified') {
    return 'verified';
  }

  if (user.verificationStatus === 'rejected') {
    return 'rejected';
  }

  return 'registered_pending';
};

const deriveOnboardingStatus = (
  status: StudentRosterStatus,
): StudentRosterEntryView['onboardingStatus'] => {
  switch (status) {
    case 'verified':
      return 'verified';
    case 'rejected':
      return 'rejected';
    case 'registered_pending':
      return 'pending_verification';
    default:
      return 'listed';
  }
};

const mapRosterEntry = (
  entry: Pick<
    IInstitutionStudentRosterEntry,
    | '_id'
    | 'displayName'
    | 'email'
    | 'status'
    | 'source'
    | 'createdAt'
    | 'updatedAt'
    | 'gradeOrProgram'
    | 'rollNumber'
    | 'notes'
    | 'linkedUserId'
    | 'registeredAt'
    | 'reviewedAt'
  >,
): StudentRosterEntryView => ({
  _id: String(entry._id),
  displayName: entry.displayName,
  email: entry.email,
  status: entry.status,
  onboardingStatus: deriveOnboardingStatus(entry.status),
  source: entry.source,
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt,
  ...(entry.gradeOrProgram ? { gradeOrProgram: entry.gradeOrProgram } : {}),
  ...(entry.rollNumber ? { rollNumber: entry.rollNumber } : {}),
  ...(entry.notes ? { notes: entry.notes } : {}),
  ...(entry.linkedUserId ? { linkedUserId: String(entry.linkedUserId) } : {}),
  ...(entry.registeredAt ? { registeredAt: entry.registeredAt } : {}),
  ...(entry.reviewedAt ? { reviewedAt: entry.reviewedAt } : {}),
});

const validateExistingStudentConflict = async (
  institutionId: string,
  email: string,
): Promise<StudentRosterLinkedUser | null> => {
  const existingStudent = await User.findOne({
    email: normalizeEmail(email),
    role: UserRole.STUDENT,
  })
    .select('_id institutionId verificationStatus')
    .lean<StudentRosterLinkedUser | null>();

  if (existingStudent?.institutionId && existingStudent.institutionId.toString() !== institutionId) {
    throw new ApiError(
      409,
      'STUDENT_EMAIL_ALREADY_CLAIMED',
      'This student email is already linked to another institution',
    );
  }

  return existingStudent;
};

const buildRosterUpdate = (
  payload: StudentRosterInput,
  source: StudentRosterSource,
  createdBy: string,
  linkedStudent?: StudentRosterLinkedUser | null,
  importedFileName?: string,
) => {
  const status = deriveRosterStatus(linkedStudent);
  const reviewedAt = status === 'verified' || status === 'rejected' ? new Date() : undefined;

  return {
    displayName: sanitizePlainText(payload.displayName),
    email: normalizeEmail(payload.email),
    ...(payload.gradeOrProgram ? { gradeOrProgram: sanitizePlainText(payload.gradeOrProgram) } : {}),
    ...(payload.rollNumber ? { rollNumber: sanitizePlainText(payload.rollNumber) } : {}),
    ...(payload.notes ? { notes: sanitizePlainText(payload.notes) } : {}),
    source,
    status,
    createdBy,
    ...(linkedStudent ? { linkedUserId: linkedStudent._id } : { linkedUserId: null }),
    ...(linkedStudent ? { registeredAt: new Date() } : { registeredAt: undefined }),
    ...(reviewedAt ? { reviewedAt } : { reviewedAt: undefined }),
    ...(importedFileName ? { importedFileName } : {}),
    isActive: true,
  };
};

const upsertRosterEntry = async (
  institutionId: string,
  institutionRole: UserRole.SCHOOL | UserRole.COLLEGE,
  createdBy: string,
  payload: StudentRosterInput,
  source: StudentRosterSource,
  importedFileName?: string,
) => {
  const linkedStudent = await validateExistingStudentConflict(institutionId, payload.email);
  const update = buildRosterUpdate(payload, source, createdBy, linkedStudent, importedFileName);

  const existing = await InstitutionStudentRosterEntry.findOne({
    institutionId,
    email: normalizeEmail(payload.email),
  });

  if (existing) {
    existing.displayName = update.displayName;
    existing.gradeOrProgram = update.gradeOrProgram;
    existing.rollNumber = update.rollNumber;
    existing.notes = update.notes;
    existing.source = update.source;
    existing.status = update.status;
    existing.createdBy = update.createdBy as never;
    existing.linkedUserId = (update.linkedUserId ?? null) as never;
    existing.registeredAt = update.registeredAt;
    existing.reviewedAt = update.reviewedAt;
    existing.importedFileName = update.importedFileName;
    existing.isActive = true;
    await existing.save();

    return {
      created: false,
      entry: mapRosterEntry(existing.toObject()),
    };
  }

  const created = await InstitutionStudentRosterEntry.create({
    institutionId,
    institutionRole,
    ...update,
  });

  return {
    created: true,
    entry: mapRosterEntry(created.toObject()),
  };
};

const worksheetHeaders = {
  displayName: ['displayname', 'name', 'studentname', 'student_name', 'fullname', 'full_name'],
  email: ['email', 'emailaddress', 'email_address', 'gmail', 'studentemail', 'student_email'],
  gradeOrProgram: ['grade', 'program', 'course', 'class', 'department', 'gradeorprogram'],
  rollNumber: ['rollnumber', 'roll_number', 'rollno', 'studentid', 'student_id', 'rollno.'],
  notes: ['notes', 'remarks', 'comment', 'comments'],
};

const normalizeHeader = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const pickColumn = (row: Record<string, unknown>, candidates: string[]) => {
  const entries = Object.entries(row);
  const match = entries.find(([key]) => candidates.includes(normalizeHeader(key)));
  return match?.[1];
};

const workbookRowsToPayloads = (buffer: Buffer): Array<Partial<StudentRosterInput> & { __rowNumber: number }> => {
  let workbook: XLSX.WorkBook;

  try {
    workbook = XLSX.read(buffer, {
      type: 'buffer',
      raw: false,
      cellDates: true,
    });
  } catch (_error) {
    throw new ApiError(
      400,
      'INVALID_STUDENT_ROSTER_FILE',
      'Unable to read the uploaded roster file. Please upload a valid CSV or XLSX file.',
    );
  }

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new ApiError(400, 'EMPTY_STUDENT_ROSTER_FILE', 'The uploaded file does not contain any sheets.');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  return rows.map((row, index) => ({
    displayName: String(pickColumn(row, worksheetHeaders.displayName) ?? ''),
    email: String(pickColumn(row, worksheetHeaders.email) ?? ''),
    gradeOrProgram: String(pickColumn(row, worksheetHeaders.gradeOrProgram) ?? ''),
    rollNumber: String(pickColumn(row, worksheetHeaders.rollNumber) ?? ''),
    notes: String(pickColumn(row, worksheetHeaders.notes) ?? ''),
    __rowNumber: index + 2,
  }));
};

export const createStudentRosterEntry = async (
  institutionId: string,
  institutionRole: UserRole.SCHOOL | UserRole.COLLEGE,
  createdBy: string,
  payload: StudentRosterInput,
): Promise<StudentRosterEntryView> => {
  await assertInstitutionRole(institutionId, institutionRole);
  const result = await upsertRosterEntry(institutionId, institutionRole, createdBy, payload, 'manual');
  return result.entry;
};

export const listStudentRosterEntries = async (
  institutionId: string,
  institutionRole: UserRole.SCHOOL | UserRole.COLLEGE,
  search?: string,
): Promise<StudentRosterEntryView[]> => {
  await assertInstitutionRole(institutionId, institutionRole);

  const entries = await InstitutionStudentRosterEntry.find({
    institutionId,
    isActive: true,
  })
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean();

  const mapped = entries.map((entry) => mapRosterEntry(entry));
  const normalizedSearch = search?.trim().toLowerCase();

  if (!normalizedSearch) {
    return mapped;
  }

  return mapped.filter((entry) =>
    [
      entry.displayName,
      entry.email,
      entry.gradeOrProgram,
      entry.rollNumber,
      entry.notes,
      entry.status,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(normalizedSearch),
  );
};

export const listStudentRoster = async (
  institutionId: string,
  institutionRole: UserRole.SCHOOL | UserRole.COLLEGE,
  search?: string,
) => {
  const entries = await listStudentRosterEntries(institutionId, institutionRole, search);

  return {
    summary: {
      total: entries.length,
      invited: entries.filter((entry) => entry.status === 'invited').length,
      registeredPending: entries.filter((entry) => entry.status === 'registered_pending').length,
      verified: entries.filter((entry) => entry.status === 'verified').length,
      rejected: entries.filter((entry) => entry.status === 'rejected').length,
    },
    entries,
  };
};

export const importStudentRosterEntries = async (
  institutionId: string,
  institutionRole: UserRole.SCHOOL | UserRole.COLLEGE,
  createdBy: string,
  file: { originalname: string; buffer: Buffer },
): Promise<StudentRosterImportSummary> => {
  await assertInstitutionRole(institutionId, institutionRole);

  const source: StudentRosterSource = /\.xlsx?$/i.test(file.originalname) ? 'xlsx' : 'csv';
  const rows = workbookRowsToPayloads(file.buffer);

  if (rows.length === 0) {
    throw new ApiError(400, 'EMPTY_STUDENT_ROSTER_FILE', 'The uploaded roster file has no student rows.');
  }

  const entries: StudentRosterEntryView[] = [];
  const errors: StudentRosterImportSummary['errors'] = [];
  let createdCount = 0;
  let updatedCount = 0;

  for (const row of rows) {
    try {
      const parsedRow = studentRosterEntrySchema.parse(row);
      const result = await upsertRosterEntry(
        institutionId,
        institutionRole,
        createdBy,
        parsedRow,
        source,
        file.originalname,
      );

      entries.push(result.entry);
      if (result.created) {
        createdCount += 1;
      } else {
        updatedCount += 1;
      }
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Unable to import this row';

      errors.push({
        row: row.__rowNumber,
        ...(row.email ? { email: String(row.email) } : {}),
        message,
      });
    }
  }

  return {
    createdCount,
    updatedCount,
    skippedCount: errors.length,
    created: createdCount,
    updated: updatedCount,
    skipped: errors.length,
    importedRows: rows.length,
    entries,
    errors,
  };
};

export const importStudentRoster = importStudentRosterEntries;

export const findInstitutionRosterMatchByEmail = async (email: string) => {
  const normalizedEmail = normalizeEmail(email);
  const entries = await InstitutionStudentRosterEntry.find({
    email: normalizedEmail,
    isActive: true,
  })
    .sort({ updatedAt: -1 })
    .lean();

  if (entries.length === 0) {
    return null;
  }

  const uniqueInstitutions = new Set(entries.map((entry) => String(entry.institutionId)));
  if (uniqueInstitutions.size > 1) {
    throw new ApiError(
      409,
      'INSTITUTION_ROSTER_CONFLICT',
      'This email is preloaded by multiple institutions. Please use the institution token provided to you.',
    );
  }

  return entries[0];
};

export const findClaimableStudentRosterEntry = findInstitutionRosterMatchByEmail;

export const markStudentRosterEntryRegistered = async (
  institutionId: string,
  email: string,
  userId: string,
) => {
  await InstitutionStudentRosterEntry.findOneAndUpdate(
    {
      institutionId,
      email: normalizeEmail(email),
      isActive: true,
    },
    {
      linkedUserId: userId,
      status: 'registered_pending',
      registeredAt: new Date(),
    },
  );
};

export const linkStudentRosterRecordToUser = async (
  rosterEntryId: string,
  userId: string,
) => {
  await InstitutionStudentRosterEntry.findByIdAndUpdate(rosterEntryId, {
    linkedUserId: userId,
    status: 'registered_pending',
    registeredAt: new Date(),
  });
};

export const syncStudentRosterVerificationStatus = async (
  institutionId: string,
  studentEmail: string,
  studentId: string,
  status: Extract<StudentRosterStatus, 'verified' | 'rejected'>,
) => {
  await InstitutionStudentRosterEntry.findOneAndUpdate(
    {
      institutionId,
      email: normalizeEmail(studentEmail),
      isActive: true,
    },
    {
      linkedUserId: studentId,
      status,
      reviewedAt: new Date(),
      registeredAt: new Date(),
    },
  );
};

export const syncStudentRosterStatusForUser = async (userId: string) => {
  const student = await User.findById(userId)
    .select('_id institutionId email verificationStatus role')
    .lean();

  if (!student || student.role !== UserRole.STUDENT || !student.institutionId) {
    return;
  }

  await InstitutionStudentRosterEntry.findOneAndUpdate(
    {
      institutionId: student.institutionId,
      email: normalizeEmail(student.email),
      isActive: true,
    },
    {
      linkedUserId: student._id,
      status: deriveRosterStatus(student),
    },
  );
};
