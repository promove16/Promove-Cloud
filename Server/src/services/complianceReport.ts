import PDFDocument from 'pdfkit';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { Patent } from '../modules/patent/patent.model';
import { ScoreEvent } from '../modules/innovationScore/score.model';
import { Startup } from '../modules/startup/startup.model';
import { User } from '../modules/user/user.model';
import { Event } from '../modules/event/event.model';
import { ComplianceReport } from '../modules/institution/complianceReport.model';
import { PlacementRecord } from '../modules/college/placementRecord.model';
import { getStudentLeaderboard } from '../modules/school/school.service';
import { UserRole } from '../types/roles.types';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

type PolicyStatus = 'Active' | 'On Track' | 'Pending' | 'Inactive';

type ReportMetrics = {
  institutionType: 'school' | 'college';
  institutionName: string;
  location: string;
  academicYear: string;
  generatedAt: Date;
  iicStarRating: number;
  policies: Array<{ name: string; status: PolicyStatus; lastUpdated?: Date }>;
  totalStudents: number;
  totalInnovationActivities: number;
  patentsFiled: number;
  mentoringHours: number;
  startupsLaunched: number;
  topStudents: Array<{ rank: number; name: string; score: number }>;
  totalHRConnections: number;
  directShortlistsThisQuarter: number;
  studentsPlaced: number;
  placementVelocity: number;
  topHiringSector: string;
  placementTable: Array<{
    studentName: string;
    score: number;
    status: string;
    company: string;
  }>;
  mvpsLaunched: number;
  pennyInvestmentsRaised: number;
};

const loadReportMetrics = async (
  institutionId: string,
  institutionType: 'school' | 'college',
): Promise<ReportMetrics> => {
  const institution = await User.findById(institutionId)
    .select('role institutionProfile')
    .lean();

  if (!institution || institution.role !== institutionType) {
    throw new ApiError(404, 'INSTITUTION_NOT_FOUND', 'Institution not found');
  }

  const students = await User.find({
    institutionId,
    role: UserRole.STUDENT,
    isActive: true,
  })
    .select('_id displayName innovationScore')
    .lean();

  const studentIds = students.map((student) => student._id);
  const topStudentsPage = await getStudentLeaderboard(institutionId, undefined, 5);
  const topStudents = topStudentsPage.items.map((student) => ({
    rank: student.rank,
    name: student.displayName,
    score: student.innovationScore,
  }));

  const [totalInnovationActivities, patentsFiled, startupsLaunched, placements] = await Promise.all([
    studentIds.length > 0 ? ScoreEvent.countDocuments({ userId: { $in: studentIds } }) : 0,
    studentIds.length > 0 ? Patent.countDocuments({ studentId: { $in: studentIds } }) : 0,
    studentIds.length > 0 ? Startup.countDocuments({ founderIds: { $in: studentIds } }) : 0,
    institutionType === 'college' ? PlacementRecord.find({ collegeId: institutionId }).lean() : [],
  ]);

  const recruiterIds = new Set(
    placements
      .map((placement) => placement.recruiterId)
      .filter((value): value is NonNullable<typeof value> => Boolean(value))
      .map((value) => String(value)),
  );

  const quarterStart = new Date();
  quarterStart.setMonth(quarterStart.getMonth() - 3);
  const shortlistsThisQuarter = placements.filter(
    (placement) => placement.status === 'Shortlisted' && placement.updatedAt >= quarterStart,
  ).length;

  const hiredPlacements = placements.filter((placement) => placement.status === 'Hired');

  const recruiterUsers =
    recruiterIds.size > 0
      ? await User.find({ _id: { $in: Array.from(recruiterIds) } }).select('_id domain').lean()
      : [];
  const sectorCounts = recruiterUsers.reduce<Record<string, number>>((accumulator, recruiter) => {
    const sector = recruiter.domain ?? 'General';
    accumulator[sector] = (accumulator[sector] ?? 0) + 1;
    return accumulator;
  }, {});
  const topHiringSector =
    Object.entries(sectorCounts).sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'General';

  const placementTable = hiredPlacements.slice(0, 8).map((placement) => {
    const student = students.find((candidate) => String(candidate._id) === String(placement.studentId));
    return {
      studentName: student?.displayName ?? 'Student',
      score: student?.innovationScore ?? placement.innovationScoreAtTime,
      status: placement.status,
      company: placement.companyName ?? 'Campus Hiring Partner',
    };
  });

  const industryCollaborations =
    institution.institutionProfile?.stats.industryCollaborations ??
    (await Event.countDocuments({ institutionId }));

  return {
    institutionType,
    institutionName: institution.institutionProfile?.institutionName ?? 'Institution',
    location: institution.institutionProfile?.location ?? 'Not provided',
    academicYear: institution.institutionProfile?.academicYear ?? 'Current AY',
    generatedAt: new Date(),
    iicStarRating: institution.institutionProfile?.iicStarRating ?? 0,
    policies: institution.institutionProfile?.policies ?? [],
    totalStudents: students.length,
    totalInnovationActivities,
    patentsFiled,
    mentoringHours: institution.institutionProfile?.stats.totalMentoringHours ?? 0,
    startupsLaunched,
    topStudents,
    totalHRConnections: recruiterIds.size,
    directShortlistsThisQuarter: shortlistsThisQuarter,
    studentsPlaced: hiredPlacements.length,
    placementVelocity:
      students.length > 0 ? Number(((hiredPlacements.length / students.length) * 100).toFixed(2)) : 0,
    topHiringSector,
    placementTable,
    mvpsLaunched: startupsLaunched,
    pennyInvestmentsRaised: 0,
  };
};

const drawHeader = (doc: PDFKit.PDFDocument) => {
  doc
    .fillColor('#1A56DB')
    .fontSize(20)
    .text('ProMove Innovation Cloud')
    .moveDown(0.25)
    .fillColor('#E2E8F0')
    .fontSize(14)
    .text('Institutional Compliance Report')
    .moveDown(0.75)
    .strokeColor('#334155')
    .lineWidth(1)
    .moveTo(50, doc.y)
    .lineTo(545, doc.y)
    .stroke()
    .moveDown();
};

const drawInfoBlock = (doc: PDFKit.PDFDocument, metrics: ReportMetrics) => {
  doc
    .fillColor('#FFFFFF')
    .fontSize(12)
    .text(`Institution: ${metrics.institutionName}`)
    .text(`Location: ${metrics.location}`)
    .text(`Academic Year: ${metrics.academicYear}`)
    .text(`Generated on: ${metrics.generatedAt.toLocaleString('en-IN')}`)
    .text(`IIC Star Rating: ${metrics.iicStarRating.toFixed(1)} / 5.0`)
    .moveDown();
};

const drawSectionTitle = (doc: PDFKit.PDFDocument, title: string) => {
  doc.moveDown(0.5).fillColor('#93C5FD').fontSize(13).text(title).moveDown(0.35);
};

const drawKeyValueTable = (
  doc: PDFKit.PDFDocument,
  rows: Array<{ label: string; value: string; change?: string }>,
) => {
  rows.forEach((row) => {
    doc
      .fillColor('#E2E8F0')
      .fontSize(11)
      .text(row.label, 50, doc.y, { width: 240, continued: true })
      .text(row.value, { width: 140, continued: true })
      .fillColor('#94A3B8')
      .text(row.change ?? '-');
    doc.moveDown(0.2);
  });
};

const policyColorMap: Record<PolicyStatus, string> = {
  Active: '#16A34A',
  'On Track': '#2563EB',
  Pending: '#D97706',
  Inactive: '#DC2626',
};

const drawPolicyTable = (doc: PDFKit.PDFDocument, policies: ReportMetrics['policies']) => {
  policies.forEach((policy) => {
    doc
      .fillColor('#E2E8F0')
      .fontSize(10)
      .text(policy.name, 50, doc.y, { width: 250, continued: true });
    doc.fillColor(policyColorMap[policy.status]).text(policy.status, { width: 100, continued: true });
    doc
      .fillColor('#94A3B8')
      .text(policy.lastUpdated ? policy.lastUpdated.toLocaleDateString('en-IN') : 'Not updated');
    doc.moveDown(0.25);
  });
};

const finalizeDocument = async (doc: PDFKit.PDFDocument): Promise<Buffer> =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });

const uploadPdfToCloudinary = async (doc: PDFKit.PDFDocument, filename: string): Promise<string> => {
  const buffer = await finalizeDocument(doc);

  return new Promise<string>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',
        folder: 'compliance-reports',
        public_id: filename,
        format: 'pdf',
      },
      (
        error: Error | undefined,
        result: { secure_url?: string } | undefined,
      ) => {
        if (error || !result?.secure_url) {
          reject(error ?? new Error('Failed to upload compliance report'));
          return;
        }

        resolve(result.secure_url);
      },
    );

    Readable.from(buffer).pipe(uploadStream);
  });
};

const addFooter = (doc: PDFKit.PDFDocument) => {
  const range = doc.bufferedPageRange();
  for (let pageIndex = 0; pageIndex < range.count; pageIndex += 1) {
    doc.switchToPage(pageIndex);
    doc
      .fontSize(9)
      .fillColor('#94A3B8')
      .text('Generated by ProMove Innovation Cloud | Confidential', 50, doc.page.height - 50)
      .text(`Page ${pageIndex + 1} of ${range.count}`, 0, doc.page.height - 50, {
        align: 'right',
      });
  }
};

const buildSchoolDocument = (metrics: ReportMetrics) => {
  const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });

  drawHeader(doc);
  drawInfoBlock(doc, metrics);

  drawSectionTitle(doc, 'SECTION I: EXECUTIVE SUMMARY');
  doc
    .fillColor('#E2E8F0')
    .fontSize(11)
    .text(
      `Overall Compliance Status: ON TRACK (${metrics.policies.filter((policy) => policy.status !== 'Inactive').length}/${Math.max(metrics.policies.length, 1)} milestones active or on track).`,
    )
    .moveDown(0.7)
    .text(
      `${metrics.institutionName} recorded ${metrics.totalInnovationActivities} innovation activities with ${metrics.patentsFiled} patent filings and ${metrics.startupsLaunched} startup launches in ${metrics.academicYear}.`,
    );

  drawSectionTitle(doc, 'SECTION II: KEY PERFORMANCE INDICATORS');
  drawKeyValueTable(doc, [
    { label: 'Total Student Innovators', value: String(metrics.totalStudents), change: `+${metrics.totalStudents} enrolled` },
    { label: 'Innovation Activities Conducted', value: String(metrics.totalInnovationActivities), change: `+${metrics.totalInnovationActivities} tracked` },
    { label: 'Patents/IPR Filed', value: String(metrics.patentsFiled), change: '-' },
    { label: 'Total Mentoring Hours', value: String(metrics.mentoringHours), change: '-' },
  ]);

  drawSectionTitle(doc, 'SECTION III: POLICY BREAKDOWN');
  drawPolicyTable(doc, metrics.policies);

  drawSectionTitle(doc, 'SECTION IV: TOP 5 STUDENT INNOVATORS');
  metrics.topStudents.forEach((student) => {
    doc.fillColor('#E2E8F0').fontSize(11).text(`${student.rank}. ${student.name} - ${student.score}/200`);
  });

  addFooter(doc);
  return doc;
};

const buildCollegeDocument = (metrics: ReportMetrics) => {
  const doc = buildSchoolDocument(metrics);

  drawSectionTitle(doc, 'SECTION V: PLACEMENT METRICS');
  drawKeyValueTable(doc, [
    { label: 'Total HR Connections', value: String(metrics.totalHRConnections), change: '-' },
    { label: 'Direct Shortlists This Quarter', value: String(metrics.directShortlistsThisQuarter), change: '-' },
    { label: 'Students Placed This Year', value: String(metrics.studentsPlaced), change: '-' },
    { label: 'Placement Velocity', value: `${metrics.placementVelocity}%`, change: metrics.topHiringSector },
  ]);

  metrics.placementTable.forEach((record) => {
    doc
      .fillColor('#E2E8F0')
      .fontSize(10)
      .text(record.studentName, 50, doc.y, { width: 180, continued: true })
      .text(`${record.score}`, { width: 80, continued: true })
      .text(record.status, { width: 90, continued: true })
      .text(record.company);
    doc.moveDown(0.2);
  });

  drawSectionTitle(doc, 'SECTION VI: IPR & INNOVATION METRICS');
  drawKeyValueTable(doc, [
    { label: 'Total Patents Filed', value: String(metrics.patentsFiled), change: '-' },
    { label: 'MVPs Launched', value: String(metrics.mvpsLaunched), change: '-' },
    { label: 'Total Penny Investments Raised by Students', value: `INR ${metrics.pennyInvestmentsRaised}`, change: '-' },
  ]);

  addFooter(doc);
  return doc;
};

const persistComplianceReport = async (
  institutionId: string,
  metrics: ReportMetrics,
  pdfUrl: string,
) => {
  await ComplianceReport.create({
    institutionId,
    institutionType: metrics.institutionType,
    generatedAt: metrics.generatedAt,
    pdfUrl,
    academicYear: metrics.academicYear,
    kpis: {
      totalStudents: metrics.totalStudents,
      totalInnovationActivities: metrics.totalInnovationActivities,
      patentsFiled: metrics.patentsFiled,
      mentoringHours: metrics.mentoringHours,
      startupsLaunched: metrics.startupsLaunched,
      totalHRConnections: metrics.totalHRConnections,
      studentsPlaced: metrics.studentsPlaced,
      placementVelocity: metrics.placementVelocity,
    },
  });
};

export const generateSchoolReport = async (institutionId: string): Promise<string> => {
  const metrics = await loadReportMetrics(institutionId, 'school');
  const doc = buildSchoolDocument(metrics);
  const pdfUrl = await uploadPdfToCloudinary(doc, `school-report-${institutionId}-${Date.now()}`);
  await persistComplianceReport(institutionId, metrics, pdfUrl);
  return pdfUrl;
};

export const generateCollegeReport = async (institutionId: string): Promise<string> => {
  const metrics = await loadReportMetrics(institutionId, 'college');
  const doc = buildCollegeDocument(metrics);
  const pdfUrl = await uploadPdfToCloudinary(doc, `college-report-${institutionId}-${Date.now()}`);
  await persistComplianceReport(institutionId, metrics, pdfUrl);
  return pdfUrl;
};
