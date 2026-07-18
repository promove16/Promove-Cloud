import PDFDocument from 'pdfkit';
import { Types } from 'mongoose';
import { uploadFile } from './fileStorageService';
import { existsSync } from 'fs';
import path from 'path';

type PatentSystemDocumentKind = 'approval_summary' | 'handover_summary' | 'patent_certificate';

export interface PatentSystemDocumentInput {
  kind: PatentSystemDocumentKind;
  generatedAt: Date;
  projectTitle: string;
  studentName: string;
  studentEmail?: string;
  workspaceId?: string;
  patentId?: string;
  patentRequestId?: string;
  status: string;
  ipoApplicationNumber?: string;
  ipoFilingDate?: Date;
  publicationDate?: Date;
  grantNumber?: string;
  grantDate?: Date;
  note?: string;
}

const page = {
  marginX: 54,
  top: 52,
  bottom: 64,
  width: 487,
};

const colors = {
  title: '#1E1B4B',
  heading: '#4F46E5',
  body: '#1F2937',
  muted: '#6B7280',
  border: '#E2E8F0',
  softBorder: '#F1F5F9',
  panel: '#F8FAFC',
  panelAlt: '#F1F5F9',
  brandBlue: '#3B82F6',
  brandPurple: '#8B5CF6',
};

const formatDate = (value?: Date) =>
  value ? value.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Not recorded';

const titleCase = (value: string) =>
  value
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const pageBottom = (doc: PDFKit.PDFDocument) => doc.page.height - page.bottom;

const ensureSpace = (doc: PDFKit.PDFDocument, requiredHeight: number) => {
  if (doc.y + requiredHeight <= pageBottom(doc)) {
    return;
  }
  doc.addPage();
  doc.y = page.top;
};

const documentTitle = (kind: PatentSystemDocumentKind) => {
  if (kind === 'handover_summary') return 'ProMove Patent Handover Summary';
  if (kind === 'patent_certificate') return 'ProMove Patent Grant Certificate';
  return 'ProMove Patent Approval Summary';
};

const KIND_SUFFIX: Record<PatentSystemDocumentKind, string> = {
  handover_summary: 'HND',
  patent_certificate: 'CERT',
  approval_summary: 'APR',
};

const KIND_FILE_STEM: Record<PatentSystemDocumentKind, string> = {
  handover_summary: 'handover-summary',
  patent_certificate: 'patent-certificate',
  approval_summary: 'approval-summary',
};

const documentNumber = (data: PatentSystemDocumentInput) => {
  const sourceId = data.patentRequestId ?? data.patentId ?? data.workspaceId ?? 'record';
  const suffix = sourceId.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase() || 'RECORD';
  return `PM-PAT-${KIND_SUFFIX[data.kind]}-${suffix}`;
};

const safeFileName = (data: PatentSystemDocumentInput) => {
  const stem = data.projectTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'patent';
  return `${stem}-${KIND_FILE_STEM[data.kind]}.pdf`;
};

const getLogoPath = (): string | null => {
  const paths = [
    path.resolve(__dirname, '../../../Client/public/image/promoveLogo.png'),
    path.resolve(__dirname, '../../public/image/promoveLogo.png'),
  ];
  for (const p of paths) {
    if (existsSync(p)) {
      return p;
    }
  }
  return null;
};

const drawHeader = (doc: PDFKit.PDFDocument, data: PatentSystemDocumentInput) => {
  doc.y = page.top;

  const logoPath = getLogoPath();
  const titleX = logoPath ? page.marginX + 36 : page.marginX;

  if (logoPath) {
    doc.image(logoPath, page.marginX, page.top + 2, { width: 28, height: 28 });
  }

  doc
    .fillColor(colors.title)
    .fontSize(21)
    .font('Helvetica-Bold')
    .text('ProMove Innovation Cloud', titleX, page.top, { width: 320 });

  doc
    .fillColor(colors.muted)
    .fontSize(9)
    .font('Helvetica')
    .text('SYSTEM GENERATED PATENT DOCUMENT', page.marginX + 300, page.top + 4, {
      width: 187,
      align: 'right',
      characterSpacing: 0.8,
    });

  doc
    .fillColor(colors.body)
    .fontSize(12)
    .font('Helvetica')
    .text(documentTitle(data.kind), titleX, doc.y + 4, { width: 320 });

  doc
    .fontSize(9)
    .fillColor(colors.muted)
    .text(`No: ${documentNumber(data)}`, page.marginX + 300, page.top + 30, {
      width: 187,
      align: 'right',
    });

  const grad = doc.linearGradient(page.marginX, page.top + 64, page.marginX + page.width, page.top + 64);
  grad.stop(0, colors.brandBlue);
  grad.stop(1, colors.brandPurple);

  doc
    .moveTo(page.marginX, page.top + 64)
    .lineTo(page.marginX + page.width, page.top + 64)
    .lineWidth(3)
    .stroke(grad);

  doc.y = page.top + 82;
};

const drawInfoBlock = (doc: PDFKit.PDFDocument, data: PatentSystemDocumentInput) => {
  const y = doc.y;
  const rowHeight = 33;
  const columns = [
    { label: 'Startup / project', value: data.projectTitle },
    { label: 'Student', value: data.studentName },
    { label: 'Workflow status', value: titleCase(data.status) },
    { label: 'Generated on', value: formatDate(data.generatedAt) },
  ];

  doc.roundedRect(page.marginX, y, page.width, 78, 8).fillAndStroke(colors.panel, colors.softBorder);

  columns.forEach((item, index) => {
    const columnWidth = page.width / 2;
    const x = page.marginX + (index % 2) * columnWidth + 16;
    const cellY = y + Math.floor(index / 2) * rowHeight + 12;

    doc
      .fillColor(colors.muted)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(item.label.toUpperCase(), x, cellY, { width: columnWidth - 32 });
    doc
      .fillColor(colors.body)
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
    .fillColor(colors.heading)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(title, page.marginX, doc.y, { width: page.width, characterSpacing: 0.5 });

  const grad = doc.linearGradient(page.marginX, doc.y + 17, page.marginX + 80, doc.y + 17);
  grad.stop(0, colors.brandBlue);
  grad.stop(1, colors.brandPurple);

  doc
    .moveTo(page.marginX, doc.y + 17)
    .lineTo(page.marginX + page.width, doc.y + 17)
    .lineWidth(0.5)
    .strokeColor(colors.softBorder)
    .stroke();

  doc
    .moveTo(page.marginX, doc.y + 17)
    .lineTo(page.marginX + 80, doc.y + 17)
    .lineWidth(1.5)
    .stroke(grad);

  doc.y += 28;
};

const drawParagraph = (doc: PDFKit.PDFDocument, text: string) => {
  const height = doc.heightOfString(text, { width: page.width, lineGap: 3 });
  ensureSpace(doc, height + 8);
  doc
    .fillColor(colors.body)
    .font('Helvetica')
    .fontSize(10)
    .text(text, page.marginX, doc.y, { width: page.width, lineGap: 3 });
  doc.y += 8;
};

const drawKeyValueTable = (doc: PDFKit.PDFDocument, rows: Array<{ label: string; value: string }>) => {
  const rowHeight = 28;

  rows.forEach((row, index) => {
    ensureSpace(doc, rowHeight);
    const rowY = doc.y;
    doc.rect(page.marginX, rowY, page.width, rowHeight).fill(index % 2 === 0 ? '#FFFFFF' : colors.panel);
    doc
      .moveTo(page.marginX, rowY + rowHeight)
      .lineTo(page.marginX + page.width, rowY + rowHeight)
      .lineWidth(0.5)
      .strokeColor(colors.softBorder)
      .stroke();

    doc.fillColor(colors.body).font('Helvetica').fontSize(9.5);
    doc.text(row.label, page.marginX + 12, rowY + 9, { width: 245, ellipsis: true, lineBreak: false });
    doc.font('Helvetica-Bold');
    doc.text(row.value, page.marginX + 270, rowY + 9, { width: 205, align: 'right', ellipsis: true, lineBreak: false });

    doc.y = rowY + rowHeight;
  });

  doc.y += 8;
};

const drawFooter = (doc: PDFKit.PDFDocument) => {
  const range = doc.bufferedPageRange();
  for (let pageIndex = 0; pageIndex < range.count; pageIndex += 1) {
    doc.switchToPage(pageIndex);
    const footerY = doc.page.height - 72;
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor(colors.muted)
      .text('Generated by ProMove Innovation Cloud | Platform workflow record, not a government patent certificate', page.marginX, footerY, {
        width: 380,
        lineBreak: false,
      });
    doc.text(`Page ${pageIndex + 1} of ${range.count}`, page.marginX, footerY, {
      width: page.width,
      align: 'right',
      lineBreak: false,
    });
  }
};

const drawCertificateBorder = (doc: PDFKit.PDFDocument) => {
  const inset = 20;
  doc
    .rect(inset, inset, doc.page.width - inset * 2, doc.page.height - inset * 2)
    .lineWidth(1.5)
    .strokeColor(colors.brandPurple)
    .stroke();
  doc
    .rect(inset + 6, inset + 6, doc.page.width - (inset + 6) * 2, doc.page.height - (inset + 6) * 2)
    .lineWidth(0.75)
    .strokeColor(colors.brandBlue)
    .stroke();
};

const drawCertificateBody = (doc: PDFKit.PDFDocument, data: PatentSystemDocumentInput) => {
  drawCertificateBorder(doc);

  doc.y = page.top + 20;

  const logoPath = getLogoPath();
  if (logoPath) {
    doc.image(logoPath, doc.page.width / 2 - 20, doc.y, { width: 40, height: 40 });
    doc.y += 52;
  }

  doc
    .fillColor(colors.muted)
    .font('Helvetica')
    .fontSize(10)
    .text('PROMOVE INNOVATION CLOUD', page.marginX, doc.y, {
      width: page.width,
      align: 'center',
      characterSpacing: 2,
    });
  doc.y += 22;

  doc
    .fillColor(colors.title)
    .font('Helvetica-Bold')
    .fontSize(26)
    .text('Patent Grant Certificate', page.marginX, doc.y, { width: page.width, align: 'center' });
  doc.y += 42;

  const grad = doc.linearGradient(doc.page.width / 2 - 60, doc.y, doc.page.width / 2 + 60, doc.y);
  grad.stop(0, colors.brandBlue);
  grad.stop(1, colors.brandPurple);
  doc
    .moveTo(doc.page.width / 2 - 60, doc.y)
    .lineTo(doc.page.width / 2 + 60, doc.y)
    .lineWidth(2)
    .stroke(grad);
  doc.y += 30;

  doc
    .fillColor(colors.muted)
    .font('Helvetica')
    .fontSize(11)
    .text('This is to certify that the patent workflow for the invention titled', page.marginX, doc.y, {
      width: page.width,
      align: 'center',
    });
  doc.y += 24;

  doc
    .fillColor(colors.body)
    .font('Helvetica-Bold')
    .fontSize(18)
    .text(data.projectTitle, page.marginX, doc.y, { width: page.width, align: 'center' });
  doc.y += 34;

  doc
    .fillColor(colors.muted)
    .font('Helvetica')
    .fontSize(11)
    .text(`submitted by ${data.studentName}, has been recorded as GRANTED on the ProMove platform.`, page.marginX, doc.y, {
      width: page.width,
      align: 'center',
      lineGap: 3,
    });
  doc.y += 48;

  const rows = [
    { label: 'IPO application number', value: data.ipoApplicationNumber ?? 'Not recorded' },
    { label: 'IPO filing date', value: formatDate(data.ipoFilingDate) },
    { label: 'Grant date', value: formatDate(data.grantDate) },
    { label: 'Certificate number', value: documentNumber(data) },
  ];

  const rowWidth = page.width / 2;
  doc.roundedRect(page.marginX, doc.y, page.width, 78, 8).fillAndStroke(colors.panel, colors.softBorder);
  const tableTop = doc.y;
  rows.forEach((row, index) => {
    const x = page.marginX + (index % 2) * rowWidth + 20;
    const y = tableTop + Math.floor(index / 2) * 33 + 12;
    doc
      .fillColor(colors.muted)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(row.label.toUpperCase(), x, y, { width: rowWidth - 40 });
    doc
      .fillColor(colors.body)
      .font('Helvetica')
      .fontSize(10.5)
      .text(row.value, x, y + 12, { width: rowWidth - 40 });
  });
  doc.y = tableTop + 98;

  const disclaimerTop = doc.page.height - page.bottom - 54;
  const signatureY = doc.y + (disclaimerTop - doc.y) / 2 - 10;

  doc
    .moveTo(doc.page.width / 2 - 90, signatureY)
    .lineTo(doc.page.width / 2 + 90, signatureY)
    .lineWidth(1)
    .strokeColor(colors.border)
    .stroke();
  doc
    .fillColor(colors.body)
    .font('Helvetica-Bold')
    .fontSize(10)
    .text('ProMove Patent Support Team', page.marginX, signatureY + 8, { width: page.width, align: 'center' });
  doc
    .fillColor(colors.muted)
    .font('Helvetica')
    .fontSize(8.5)
    .text('Authorized platform record', page.marginX, signatureY + 21, { width: page.width, align: 'center' });

  doc
    .fillColor(colors.muted)
    .font('Helvetica')
    .fontSize(8.5)
    .text(
      'This certificate is a ProMove platform record confirming the grant status captured in the patent workflow. It is not a government-issued patent certificate, filing receipt, or legal proof of grant. Refer to the applicable patent office record for the official certificate.',
      page.marginX + 20,
      disclaimerTop,
      { width: page.width - 40, align: 'center', lineGap: 2 },
    );

  doc
    .fillColor(colors.muted)
    .font('Helvetica')
    .fontSize(9)
    .text(
      `Generated on ${formatDate(data.generatedAt)} - Document No. ${documentNumber(data)}`,
      page.marginX,
      doc.page.height - page.bottom - 8,
      { width: page.width, align: 'center' },
    );
};

const buildPatentSystemDocument = (data: PatentSystemDocumentInput): PDFKit.PDFDocument => {
  const doc = new PDFDocument({
    margin: page.marginX,
    size: 'A4',
    bufferPages: true,
    autoFirstPage: true,
  });

  if (data.kind === 'patent_certificate') {
    drawCertificateBody(doc, data);
    return doc;
  }

  drawHeader(doc, data);
  drawInfoBlock(doc, data);

  drawSectionTitle(doc, 'SECTION I: WORKFLOW RECORD');
  drawKeyValueTable(doc, [
    { label: 'Document number', value: documentNumber(data) },
    { label: 'Patent record', value: data.patentRequestId ?? data.patentId ?? 'Not recorded' },
    { label: 'Workspace', value: data.workspaceId ?? 'Not recorded' },
    { label: 'Student email', value: data.studentEmail ?? 'Not recorded' },
  ]);

  drawSectionTitle(doc, 'SECTION II: PATENT STATUS');
  drawKeyValueTable(doc, [
    { label: 'IPO application number', value: data.ipoApplicationNumber ?? 'Not recorded' },
    { label: 'IPO filing date', value: formatDate(data.ipoFilingDate) },
    { label: 'Publication date', value: formatDate(data.publicationDate) },
    { label: 'Grant number', value: data.grantNumber ?? 'Not recorded' },
    { label: 'Grant date', value: formatDate(data.grantDate) },
  ]);

  drawSectionTitle(doc, 'SECTION III: SYSTEM NOTE');
  drawParagraph(
    doc,
    data.note?.trim() ||
      'This document was generated by ProMove to record the patent workflow status available inside the platform at the time of generation.',
  );
  drawParagraph(
    doc,
    'This system-generated document is an internal ProMove workflow record. It is not a government-issued patent certificate, filing receipt, or legal proof of patent grant. Official government documents must be uploaded separately when available.',
  );

  drawFooter(doc);
  return doc;
};

const finalizePatentSystemDocument = (doc: PDFKit.PDFDocument): Promise<Buffer> =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });

export const renderPatentSystemDocument = async (data: PatentSystemDocumentInput) => ({
  buffer: await finalizePatentSystemDocument(buildPatentSystemDocument(data)),
  fileName: safeFileName(data),
});

export const createPatentSystemDocument = async (data: PatentSystemDocumentInput) => {
  const buffer = await finalizePatentSystemDocument(buildPatentSystemDocument(data));
  const fileName = safeFileName(data);
  const uploaded = await uploadFile({
    buffer,
    folder: 'promove/patent-system-documents',
    fileName,
    contentType: 'application/pdf',
  });

  return {
    _id: new Types.ObjectId(),
    fileUrl: uploaded.url,
    fileType: 'pdf' as const,
    fileName,
    fileSizeBytes: buffer.length,
    documentCategory: 'system_generated' as const,
    reviewStatus: 'approved' as const,
    uploadedAt: data.generatedAt,
    note: 'System-generated ProMove patent workflow summary.',
    storageProvider: uploaded.provider,
    storageKey: uploaded.key,
  };
};
