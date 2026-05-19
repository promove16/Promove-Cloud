import PDFDocument from 'pdfkit';
import { ApiError } from '../utils/ApiError';
import { Patent } from '../modules/patent/patent.model';
import { ScoreEvent } from '../modules/innovationScore/score.model';
import { Startup } from '../modules/startup/startup.model';
import { User } from '../modules/user/user.model';
import { Event } from '../modules/event/event.model';
import { ComplianceReport } from '../modules/institution/complianceReport.model';
import {
  calculateEstimatedIicRating,
  getInstitutionIicTelemetry,
} from '../modules/institution/iicRating.service';
import { PlacementRecord } from '../modules/college/placementRecord.model';
import { getStudentLeaderboard } from '../modules/school/school.service';
import { UserRole } from '../types/roles.types';
import { Workspace } from '../modules/workspace/workspace.model';
import { MAX_INNOVATION_SCORE } from '../modules/innovationScore/score.utils';
import { generatePresignedUrl, uploadFileToS3, type UploadedFileResult } from './fileStorageService';

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

const defaultReportPoliciesByType: Record<ReportMetrics['institutionType'], string[]> = {
  school: [
    'ATL / School Innovation Program',
    'SQAAF / School Quality Assurance',
    'NEP 2020 School Compliance',
    'Attendance Governance',
    'Student Safety & Conduct',
  ],
  college: [
    "IIC (Institution's Innovation Council)",
    'NAAC (Accreditation)',
    'NIRF (Innovation Ranking)',
    'AICTE Regulations',
    'NEP 2020 Compliance',
    'NISP (Innovation Startup Policy)',
  ],
};

const getReportProfile = (institutionType: ReportMetrics['institutionType']) =>
  institutionType === 'college'
    ? {
        subtitle: 'Higher Education Compliance Report',
        ratingLabel: 'IIC rating',
        summaryLabel: 'higher-education compliance milestones',
        innovationContext:
          'IIC-linked activities, startup proof, mentoring coverage, placement signals, and approved policy evidence',
      }
    : {
        subtitle: 'School Innovation & Compliance Report',
        ratingLabel: 'Innovation readiness',
        summaryLabel: 'school compliance milestones',
        innovationContext:
          'ATL/SQAAF-aligned activities, student innovation work, mentoring coverage, safety governance, and approved evidence',
      };

const mergeReportPolicies = (
  institutionType: ReportMetrics['institutionType'],
  policies: ReportMetrics['policies'] = [],
): ReportMetrics['policies'] => {
  const policyMap = new Map(policies.map((policy) => [policy.name.toLowerCase(), policy]));
  const defaults = defaultReportPoliciesByType[institutionType].map((name) => {
    const match = policyMap.get(name.toLowerCase());
    return match ?? { name, status: 'Pending' as PolicyStatus };
  });
  const extras = policies.filter(
    (policy) =>
      !defaultReportPoliciesByType[institutionType].some(
        (defaultName) => defaultName.toLowerCase() === policy.name.toLowerCase(),
      ),
  );
  return [...defaults, ...extras];
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

  const [activeProjects, totalInnovationActivities, patentsFiled, startupsLaunched, placements, iicTelemetry] =
    await Promise.all([
      studentIds.length > 0 ? Workspace.countDocuments({ ownerId: { $in: studentIds }, isActive: true }) : 0,
      studentIds.length > 0 ? ScoreEvent.countDocuments({ userId: { $in: studentIds } }) : 0,
      studentIds.length > 0 ? Patent.countDocuments({ studentId: { $in: studentIds } }) : 0,
      studentIds.length > 0 ? Startup.countDocuments({ founderIds: { $in: studentIds } }) : 0,
      institutionType === 'college' ? PlacementRecord.find({ collegeId: institutionId }).lean() : [],
      getInstitutionIicTelemetry(institutionId, institutionType),
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

  const policies = mergeReportPolicies(institutionType, institution.institutionProfile?.policies ?? []);
  const iicRating = calculateEstimatedIicRating({
    totalStudents: students.length,
    activeProjects,
    totalInnovationActivities,
    patentsFiled,
    totalMentoringHours: institution.institutionProfile?.stats.totalMentoringHours ?? 0,
    startupsLaunched,
    industryCollaborations,
    structuredActivityCount: iicTelemetry.structuredActivityCount,
    activeQuarterCount: iicTelemetry.activeQuarterCount,
    policies,
  });

  return {
    institutionType,
    institutionName: institution.institutionProfile?.institutionName ?? 'Institution',
    location: institution.institutionProfile?.location ?? 'Not provided',
    academicYear: institution.institutionProfile?.academicYear ?? 'Current AY',
    generatedAt: new Date(),
    iicStarRating: iicRating.starRating,
    policies,
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

const page = {
  marginX: 54,
  top: 52,
  bottom: 64,
  width: 487,
};

const pdfColors = {
  title: '#2563EB',
  heading: '#1D4ED8',
  body: '#1E293B',
  muted: '#64748B',
  faint: '#E2E8F0',
  border: '#CBD5E1',
  softBorder: '#E2E8F0',
  panel: '#F8FAFC',
  panelAlt: '#F1F5F9',
};

const createReportDocument = () =>
  new PDFDocument({
    margin: page.marginX,
    size: 'A4',
    bufferPages: true,
    autoFirstPage: true,
  });

const pageBottom = (doc: PDFKit.PDFDocument) => doc.page.height - page.bottom;

const usablePageHeight = (doc: PDFKit.PDFDocument) => doc.page.height - page.top - page.bottom;

const addReportPage = (doc: PDFKit.PDFDocument) => {
  doc.addPage();
  doc.y = page.top;
};

const ensureSpace = (doc: PDFKit.PDFDocument, requiredHeight: number) => {
  const heightToFit = Math.min(requiredHeight, usablePageHeight(doc));
  if (doc.y + heightToFit <= pageBottom(doc)) {
    return;
  }

  addReportPage(doc);
};

type TableHeaderCell = {
  label: string;
  x: number;
  width: number;
  align?: 'left' | 'center' | 'right' | 'justify';
};

const drawTableHeader = (
  doc: PDFKit.PDFDocument,
  cells: TableHeaderCell[],
  headerHeight = 22,
) => {
  ensureSpace(doc, headerHeight + 30);
  const headerY = doc.y;
  doc.rect(page.marginX, headerY, page.width, headerHeight).fill(pdfColors.panelAlt);
  doc.fillColor(pdfColors.muted).font('Helvetica-Bold').fontSize(8);

  cells.forEach((cell) => {
    doc.text(cell.label, cell.x, headerY + 7, {
      width: cell.width,
      height: 10,
      align: cell.align,
      ellipsis: true,
      lineBreak: false,
    });
  });

  doc.y = headerY + headerHeight;
};

const ensureTableRowSpace = (
  doc: PDFKit.PDFDocument,
  rowHeight: number,
  headerCells: TableHeaderCell[],
  headerHeight = 22,
) => {
  if (doc.y + rowHeight <= pageBottom(doc)) {
    return;
  }

  addReportPage(doc);
  drawTableHeader(doc, headerCells, headerHeight);
};

const drawTableRowBackground = (doc: PDFKit.PDFDocument, rowY: number, rowHeight: number, index: number) => {
  doc.rect(page.marginX, rowY, page.width, rowHeight).fill(index % 2 === 0 ? '#FFFFFF' : pdfColors.panel);
  doc
    .moveTo(page.marginX, rowY + rowHeight)
    .lineTo(page.marginX + page.width, rowY + rowHeight)
    .lineWidth(0.5)
    .strokeColor(pdfColors.softBorder)
    .stroke();
};

const drawCellText = (
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  options: PDFKit.Mixins.TextOptions = {},
) => {
  doc.text(text, x, y, {
    width,
    height: 13,
    ellipsis: true,
    lineBreak: false,
    ...options,
  });
};

const drawHeader = (doc: PDFKit.PDFDocument, metrics: ReportMetrics) => {
  doc.y = page.top;
  doc
    .fillColor(pdfColors.title)
    .fontSize(21)
    .font('Helvetica-Bold')
    .text('ProMove Innovation Cloud', page.marginX, doc.y, { width: 310 });

  doc
    .fillColor(pdfColors.muted)
    .fontSize(9)
    .font('Helvetica')
    .text('CONFIDENTIAL REPORT', page.marginX + 340, page.top + 4, {
      width: 145,
      align: 'right',
      characterSpacing: 1.2,
    });

  doc
    .fillColor(pdfColors.body)
    .fontSize(12)
    .font('Helvetica')
    .text(getReportProfile(metrics.institutionType).subtitle, page.marginX, doc.y + 4, { width: 280 });

  doc
    .fontSize(9)
    .fillColor(pdfColors.muted)
    .text(metrics.generatedAt.toLocaleString('en-IN'), page.marginX + 330, page.top + 28, {
      width: 155,
      align: 'right',
    });

  doc
    .moveTo(page.marginX, page.top + 64)
    .lineTo(page.marginX + page.width, page.top + 64)
    .lineWidth(1)
    .strokeColor(pdfColors.border)
    .stroke();

  doc.y = page.top + 82;
};

const drawInfoBlock = (doc: PDFKit.PDFDocument, metrics: ReportMetrics) => {
  const y = doc.y;
  const rowHeight = 33;
  const reportProfile = getReportProfile(metrics.institutionType);
  const columns = [
    { label: 'Institution', value: metrics.institutionName },
    { label: 'Location', value: metrics.location },
    { label: 'Academic year', value: metrics.academicYear },
    { label: reportProfile.ratingLabel, value: `${metrics.iicStarRating.toFixed(1)} / 5.0` },
  ];

  doc
    .roundedRect(page.marginX, y, page.width, 78, 10)
    .fillAndStroke(pdfColors.panel, pdfColors.softBorder);

  columns.forEach((item, index) => {
    const columnWidth = page.width / 2;
    const x = page.marginX + (index % 2) * columnWidth + 16;
    const cellY = y + Math.floor(index / 2) * rowHeight + 12;

    doc
      .fillColor(pdfColors.muted)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(item.label.toUpperCase(), x, cellY, { width: columnWidth - 32 });
    doc
      .fillColor(pdfColors.body)
      .font('Helvetica')
      .fontSize(10)
      .text(item.value, x, cellY + 12, { width: columnWidth - 32, lineGap: 1 });
  });

  doc.y = y + 98;
};

const drawSectionTitle = (doc: PDFKit.PDFDocument, title: string) => {
  ensureSpace(doc, 42);
  doc.y += 4;
  doc
    .fillColor(pdfColors.heading)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(title, page.marginX, doc.y, { width: page.width, characterSpacing: 0.5 });
  doc
    .moveTo(page.marginX, doc.y + 17)
    .lineTo(page.marginX + page.width, doc.y + 17)
    .lineWidth(0.5)
    .strokeColor(pdfColors.softBorder)
    .stroke();
  doc.y += 28;
};

const drawParagraph = (doc: PDFKit.PDFDocument, text: string) => {
  const height = doc.heightOfString(text, { width: page.width, lineGap: 3 });
  ensureSpace(doc, height + 8);
  doc
    .fillColor(pdfColors.body)
    .font('Helvetica')
    .fontSize(10)
    .text(text, page.marginX, doc.y, { width: page.width, lineGap: 3 });
  doc.y += 8;
};

const drawKeyValueTable = (
  doc: PDFKit.PDFDocument,
  rows: Array<{ label: string; value: string; change?: string }>,
) => {
  const headerHeight = 22;
  const rowHeight = 30;

  const columns = {
    label: page.marginX + 12,
    value: page.marginX + 292,
    change: page.marginX + 382,
  };
  const headerCells: TableHeaderCell[] = [
    { label: 'METRIC', x: columns.label, width: 250 },
    { label: 'VALUE', x: columns.value, width: 70, align: 'right' },
    { label: 'NOTE', x: columns.change, width: 90 },
  ];

  drawTableHeader(doc, headerCells, headerHeight);

  rows.forEach((row, index) => {
    ensureTableRowSpace(doc, rowHeight, headerCells, headerHeight);
    const rowY = doc.y;
    drawTableRowBackground(doc, rowY, rowHeight, index);

    doc
      .fillColor(pdfColors.body)
      .font('Helvetica')
      .fontSize(9.5);
    drawCellText(doc, row.label, columns.label, rowY + 9, 250);
    doc.font('Helvetica-Bold');
    drawCellText(doc, row.value, columns.value, rowY + 9, 70, { align: 'right' });
    doc.font('Helvetica').fillColor(pdfColors.muted);
    drawCellText(doc, row.change ?? '-', columns.change, rowY + 9, 90);

    doc.y = rowY + rowHeight;
  });

  doc.y += 8;
};

const policyColorMap: Record<PolicyStatus, string> = {
  Active: '#16A34A',
  'On Track': '#2563EB',
  Pending: '#D97706',
  Inactive: '#DC2626',
};

const drawPolicyTable = (doc: PDFKit.PDFDocument, policies: ReportMetrics['policies']) => {
  if (policies.length === 0) {
    drawParagraph(doc, 'No policy rows have been approved for this institution yet.');
    return;
  }

  const headerHeight = 22;
  const rowHeight = 30;

  const columns = {
    name: page.marginX + 12,
    status: page.marginX + 290,
    updated: page.marginX + 385,
  };
  const headerCells: TableHeaderCell[] = [
    { label: 'POLICY', x: columns.name, width: 250 },
    { label: 'STATUS', x: columns.status, width: 78 },
    { label: 'UPDATED', x: columns.updated, width: 90 },
  ];

  drawTableHeader(doc, headerCells, headerHeight);

  policies.forEach((policy, index) => {
    ensureTableRowSpace(doc, rowHeight, headerCells, headerHeight);
    const rowY = doc.y;
    drawTableRowBackground(doc, rowY, rowHeight, index);

    doc
      .fillColor(pdfColors.body)
      .font('Helvetica')
      .fontSize(10);
    drawCellText(doc, policy.name, columns.name, rowY + 9, 250);
    doc
      .fillColor(policyColorMap[policy.status])
      .font('Helvetica-Bold')
      .fontSize(9.5);
    drawCellText(doc, policy.status, columns.status, rowY + 9, 78);
    doc
      .fillColor(pdfColors.muted)
      .font('Helvetica')
      .fontSize(9.5);
    drawCellText(
      doc,
      policy.lastUpdated ? policy.lastUpdated.toLocaleDateString('en-IN') : 'Not updated',
      columns.updated,
      rowY + 9,
      90,
    );

    doc.y = rowY + rowHeight;
  });

  doc.y += 8;
};

const drawStudentTable = (doc: PDFKit.PDFDocument, students: ReportMetrics['topStudents']) => {
  if (students.length === 0) {
    drawParagraph(doc, 'No ranked student innovators are available for this reporting period.');
    return;
  }

  drawKeyValueTable(
    doc,
    students.map((student) => ({
      label: `${student.rank}. ${student.name}`,
      value: `${student.score}/${MAX_INNOVATION_SCORE}`,
      change: 'Innovation score',
    })),
  );
};

const drawPlacementTable = (doc: PDFKit.PDFDocument, records: ReportMetrics['placementTable']) => {
  if (records.length === 0) {
    drawParagraph(doc, 'No hired placement records are available for this reporting period.');
    return;
  }

  const headerHeight = 22;
  const rowHeight = 30;

  const columns = {
    student: page.marginX + 12,
    score: page.marginX + 218,
    status: page.marginX + 288,
    company: page.marginX + 360,
  };
  const headerCells: TableHeaderCell[] = [
    { label: 'STUDENT', x: columns.student, width: 180 },
    { label: 'SCORE', x: columns.score, width: 50, align: 'right' },
    { label: 'STATUS', x: columns.status, width: 60 },
    { label: 'COMPANY', x: columns.company, width: 115 },
  ];

  drawTableHeader(doc, headerCells, headerHeight);

  records.forEach((record, index) => {
    ensureTableRowSpace(doc, rowHeight, headerCells, headerHeight);
    const rowY = doc.y;
    drawTableRowBackground(doc, rowY, rowHeight, index);

    doc
      .fillColor(pdfColors.body)
      .font('Helvetica')
      .fontSize(9.5);
    drawCellText(doc, record.studentName, columns.student, rowY + 9, 180);
    drawCellText(doc, String(record.score), columns.score, rowY + 9, 50, { align: 'right' });
    drawCellText(doc, record.status, columns.status, rowY + 9, 60);
    drawCellText(doc, record.company, columns.company, rowY + 9, 115);

    doc.y = rowY + rowHeight;
  });

  doc.y += 8;
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

const uploadPdfToStorage = async (doc: PDFKit.PDFDocument, filename: string): Promise<UploadedFileResult> => {
  const buffer = await finalizeDocument(doc);
  return uploadFileToS3({
    buffer,
    folder: 'compliance-reports',
    fileName: `${filename}.pdf`,
    contentType: 'application/pdf',
  });
};

const addFooter = (doc: PDFKit.PDFDocument) => {
  const range = doc.bufferedPageRange();
  for (let pageIndex = 0; pageIndex < range.count; pageIndex += 1) {
    doc.switchToPage(pageIndex);
    const footerY = doc.page.height - 72;
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor(pdfColors.muted)
      .text('Generated by ProMove Innovation Cloud | Confidential', page.marginX, footerY, {
        width: 310,
        lineBreak: false,
      });
    doc.text(`Page ${pageIndex + 1} of ${range.count}`, page.marginX, footerY, {
        width: page.width,
        align: 'right',
        lineBreak: false,
      });
  }
};

export const buildSchoolDocument = (metrics: ReportMetrics, shouldAddFooter = true) => {
  const doc = createReportDocument();
  const reportProfile = getReportProfile(metrics.institutionType);

  drawHeader(doc, metrics);
  drawInfoBlock(doc, metrics);

  drawSectionTitle(doc, 'SECTION I: EXECUTIVE SUMMARY');
  drawParagraph(
    doc,
    `Overall Compliance Status: ON TRACK (${metrics.policies.filter((policy) => policy.status !== 'Inactive').length}/${Math.max(metrics.policies.length, 1)} ${reportProfile.summaryLabel} active or on track).`,
  );
  drawParagraph(
    doc,
    `${metrics.institutionName} recorded ${metrics.totalInnovationActivities} innovation activities in ${metrics.academicYear}. This report evaluates ${reportProfile.innovationContext}.`,
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
  drawStudentTable(doc, metrics.topStudents);

  if (shouldAddFooter) {
    addFooter(doc);
  }
  return doc;
};

export const buildCollegeDocument = (metrics: ReportMetrics) => {
  const doc = buildSchoolDocument(metrics, false);

  drawSectionTitle(doc, 'SECTION V: PLACEMENT METRICS');
  drawKeyValueTable(doc, [
    { label: 'Total HR Connections', value: String(metrics.totalHRConnections), change: '-' },
    { label: 'Direct Shortlists This Quarter', value: String(metrics.directShortlistsThisQuarter), change: '-' },
    { label: 'Students Placed This Year', value: String(metrics.studentsPlaced), change: '-' },
    { label: 'Placement Velocity', value: `${metrics.placementVelocity}%`, change: metrics.topHiringSector },
  ]);

  drawPlacementTable(doc, metrics.placementTable);

  drawSectionTitle(doc, 'SECTION VI: IPR AND INNOVATION METRICS');
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
  uploaded: UploadedFileResult,
) => {
  await ComplianceReport.create({
    institutionId,
    institutionType: metrics.institutionType,
    generatedAt: metrics.generatedAt,
    pdfUrl: uploaded.url,
    storageProvider: uploaded.provider,
    storageKey: uploaded.key,
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
  const uploaded = await uploadPdfToStorage(doc, `school-report-${institutionId}-${Date.now()}`);
  await persistComplianceReport(institutionId, metrics, uploaded);
  return generatePresignedUrl(uploaded.key);
};

export const generateCollegeReport = async (institutionId: string): Promise<string> => {
  const metrics = await loadReportMetrics(institutionId, 'college');
  const doc = buildCollegeDocument(metrics);
  const uploaded = await uploadPdfToStorage(doc, `college-report-${institutionId}-${Date.now()}`);
  await persistComplianceReport(institutionId, metrics, uploaded);
  return generatePresignedUrl(uploaded.key);
};
