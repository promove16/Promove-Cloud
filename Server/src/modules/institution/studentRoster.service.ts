import { randomBytes } from 'crypto';
import { z } from 'zod';
import { Readable } from 'stream';
import ExcelJS from 'exceljs';
import { logError } from '../../config/logger';
import { env } from '../../config/env';
import { UserRole } from '../../types/roles.types';
import { ApiError } from '../../utils/ApiError';
import { sanitizePlainText } from '../../utils/sanitizeText';
import { sendInstitutionStudentInviteEmail } from '../../services/emailService';
import { User } from '../user/user.model';
import { StudentAccessToken } from './studentAccessToken.model';
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
  createdEntries: StudentRosterEntryView[];
  updatedEntries: StudentRosterEntryView[];
  errors: Array<{
    row: number;
    email?: string;
    message: string;
  }>;
};

export type CancelStudentRosterInviteResult = {
  _id: string;
  cancelled: true;
  cancelledAt: Date;
};

type InstitutionRosterOwner = {
  _id: { toString(): string };
  role: UserRole.SCHOOL | UserRole.COLLEGE;
  displayName: string;
};

const ROSTER_INVITE_TOKEN_TTL_DAYS = 90;

const assertInstitutionRole = async (
  institutionId: string,
  institutionRole: UserRole.SCHOOL | UserRole.COLLEGE,
) => {
  const institution = await User.findById(institutionId)
    .select('_id role displayName')
    .lean<InstitutionRosterOwner | null>();

  if (!institution || institution.role !== institutionRole) {
    throw new ApiError(404, 'INSTITUTION_NOT_FOUND', 'Institution account not found');
  }

  return institution;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const resolveLatestActiveInstitutionToken = async (institutionId: string) => {
  const activeToken = await StudentAccessToken.findOne({
    institutionId,
    isActive: true,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  })
    .sort({ createdAt: -1 })
    .select('token')
    .lean();

  return activeToken?.token ?? null;
};

const generateStudentAccessToken = async (
  institutionRole: UserRole.SCHOOL | UserRole.COLLEGE,
): Promise<string> => {
  const prefix = institutionRole === UserRole.SCHOOL ? 'SCH' : 'COL';

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `${prefix}-${randomBytes(4).toString('hex').toUpperCase()}`;
    const existing = await StudentAccessToken.exists({ token: candidate });
    if (!existing) {
      return candidate;
    }
  }

  throw new ApiError(500, 'TOKEN_GENERATION_FAILED', 'Unable to generate a unique student token');
};

const ensureInviteInstitutionToken = async (institution: InstitutionRosterOwner) => {
  const existingToken = await resolveLatestActiveInstitutionToken(String(institution._id));
  if (existingToken) {
    return existingToken;
  }

  const token = await generateStudentAccessToken(institution.role);
  await StudentAccessToken.create({
    institutionId: institution._id,
    institutionRole: institution.role,
    createdBy: institution._id,
    label: 'Roster Invite',
    token,
    expiresAt: new Date(Date.now() + ROSTER_INVITE_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
  });

  return token;
};

const buildInstitutionStudentInviteLink = async (
  institution: InstitutionRosterOwner,
  inviteeEmail: string,
) => {
  const inviteUrl = new URL('/signup', env.CLIENT_URL);
  const activeToken = await ensureInviteInstitutionToken(institution);

  inviteUrl.searchParams.set('inviteRole', UserRole.STUDENT);
  inviteUrl.searchParams.set('inviteeEmail', normalizeEmail(inviteeEmail));
  inviteUrl.searchParams.set('inviterName', institution.displayName);
  inviteUrl.searchParams.set(
    'purpose',
    'Register with this same email to activate your student dashboard access.',
  );

  if (activeToken) {
    inviteUrl.searchParams.set('institutionToken', activeToken);
  }

  return inviteUrl.toString();
};

const sendStudentRosterInviteIfNeeded = async (
  institution: InstitutionRosterOwner,
  entry: StudentRosterEntryView,
) => {
  if (entry.status !== 'invited' || entry.linkedUserId) {
    return;
  }

  try {
    const inviteLink = await buildInstitutionStudentInviteLink(institution, entry.email);
    await sendInstitutionStudentInviteEmail({
      toEmail: entry.email,
      studentEmail: entry.email,
      institutionName: institution.displayName,
      institutionRole: institution.role,
      inviteLink,
    });
  } catch (error) {
    logError('Failed to send institution student roster invite email', error);
  }
};

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

type StudentRosterWorkbookRow = Partial<StudentRosterInput> & { __rowNumber: number };

const findColumnNumber = (headerColumns: Map<string, number>, candidates: string[]) => {
  const normalizedCandidates = candidates.map(normalizeHeader);
  const match = normalizedCandidates.find((candidate) => headerColumns.has(candidate));
  return match ? headerColumns.get(match) : undefined;
};

export const workbookRowsToPayloads = async (
  buffer: Buffer,
  fileName: string,
): Promise<StudentRosterWorkbookRow[]> => {
  const workbook = new ExcelJS.Workbook();

  try {
    if (/\.csv$/i.test(fileName)) {
      await workbook.csv.read(Readable.from([buffer]));
    } else {
      await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    }
  } catch (_error) {
    throw new ApiError(
      400,
      'INVALID_STUDENT_ROSTER_FILE',
      'Unable to read the uploaded roster file. Please upload a valid CSV or XLSX file.',
    );
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new ApiError(400, 'EMPTY_STUDENT_ROSTER_FILE', 'The uploaded file does not contain any sheets.');
  }

  const headerColumns = new Map<string, number>();
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, columnNumber) => {
    const normalized = normalizeHeader(cell.text);
    if (normalized) {
      headerColumns.set(normalized, columnNumber);
    }
  });

  const displayNameColumn = findColumnNumber(headerColumns, worksheetHeaders.displayName);
  const emailColumn = findColumnNumber(headerColumns, worksheetHeaders.email);
  const gradeOrProgramColumn = findColumnNumber(headerColumns, worksheetHeaders.gradeOrProgram);
  const rollNumberColumn = findColumnNumber(headerColumns, worksheetHeaders.rollNumber);
  const notesColumn = findColumnNumber(headerColumns, worksheetHeaders.notes);
  const rows: StudentRosterWorkbookRow[] = [];

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }

    const payload = {
      displayName: displayNameColumn ? row.getCell(displayNameColumn).text : '',
      email: emailColumn ? row.getCell(emailColumn).text : '',
      gradeOrProgram: gradeOrProgramColumn ? row.getCell(gradeOrProgramColumn).text : '',
      rollNumber: rollNumberColumn ? row.getCell(rollNumberColumn).text : '',
      notes: notesColumn ? row.getCell(notesColumn).text : '',
      __rowNumber: rowNumber,
    };

    const hasContent = Object.values(payload).some((value) => typeof value === 'string' && value.trim().length > 0);
    if (hasContent) {
      rows.push(payload);
    }
  });

  return rows;
};

export const createStudentRosterEntry = async (
  institutionId: string,
  institutionRole: UserRole.SCHOOL | UserRole.COLLEGE,
  createdBy: string,
  payload: StudentRosterInput,
): Promise<StudentRosterEntryView> => {
  const institution = await assertInstitutionRole(institutionId, institutionRole);
  const result = await upsertRosterEntry(institutionId, institutionRole, createdBy, payload, 'manual');
  await sendStudentRosterInviteIfNeeded(institution, result.entry);
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
  const institution = await assertInstitutionRole(institutionId, institutionRole);

  const source: StudentRosterSource = /\.xlsx?$/i.test(file.originalname) ? 'xlsx' : 'csv';
  const rows = await workbookRowsToPayloads(file.buffer, file.originalname);

  if (rows.length === 0) {
    throw new ApiError(400, 'EMPTY_STUDENT_ROSTER_FILE', 'The uploaded roster file has no student rows.');
  }

  const entries: StudentRosterEntryView[] = [];
  const createdEntries: StudentRosterEntryView[] = [];
  const updatedEntries: StudentRosterEntryView[] = [];
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

      if (result.created) {
        await sendStudentRosterInviteIfNeeded(institution, result.entry);
      }

      entries.push(result.entry);
      if (result.created) {
        createdCount += 1;
        createdEntries.push(result.entry);
      } else {
        updatedCount += 1;
        updatedEntries.push(result.entry);
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
    createdEntries,
    updatedEntries,
    errors,
  };
};

export const importStudentRoster = importStudentRosterEntries;

export const cancelStudentRosterInvite = async (
  institutionId: string,
  institutionRole: UserRole.SCHOOL | UserRole.COLLEGE,
  rosterEntryId: string,
): Promise<CancelStudentRosterInviteResult> => {
  await assertInstitutionRole(institutionId, institutionRole);

  const entry = await InstitutionStudentRosterEntry.findOne({
    _id: rosterEntryId,
    institutionId,
    isActive: true,
  });

  if (!entry) {
    throw new ApiError(404, 'STUDENT_ROSTER_ENTRY_NOT_FOUND', 'Student roster entry not found');
  }

  if (entry.linkedUserId || entry.status !== 'invited') {
    throw new ApiError(
      400,
      'STUDENT_ROSTER_INVITE_NOT_CANCELLABLE',
      'Only pending student invites can be cancelled',
    );
  }

  entry.isActive = false;
  await entry.save();

  return {
    _id: String(entry._id),
    cancelled: true,
    cancelledAt: entry.updatedAt,
  };
};

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
