import PDFDocument from 'pdfkit';

export interface DealContractData {
  contractNumber: string;
  generatedAt: Date;
  adminApprovedAt: Date;
  mediatorLabel: string;
  mediationStatus: string;
  startupName: string;
  startupCategory: string;
  founderName: string;
  investorName: string;
  investorType: 'penny' | 'sole';
  investorRole: 'shareholder' | 'director' | 'observer';
  amountINR: number;
  equityPercent: number;
  sharesAllocated: number;
  shareClassLabel: string;
  sharePriceInr: number;
  transferValueInr: number;
  royaltyPercentage: number;
  royaltyAmountINR: number;
}

const page = {
  marginX: 54,
  top: 52,
  bottom: 64,
  width: 487,
};

const colors = {
  title: '#2563EB',
  heading: '#1D4ED8',
  body: '#1E293B',
  muted: '#64748B',
  border: '#CBD5E1',
  softBorder: '#E2E8F0',
  panel: '#F8FAFC',
  panelAlt: '#F1F5F9',
};

const formatINR = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatDate = (value: Date) =>
  value.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const pageBottom = (doc: PDFKit.PDFDocument) => doc.page.height - page.bottom;

const ensureSpace = (doc: PDFKit.PDFDocument, requiredHeight: number) => {
  if (doc.y + requiredHeight <= pageBottom(doc)) {
    return;
  }
  doc.addPage();
  doc.y = page.top;
};

const drawHeader = (doc: PDFKit.PDFDocument, data: DealContractData) => {
  doc.y = page.top;
  doc
    .fillColor(colors.title)
    .fontSize(21)
    .font('Helvetica-Bold')
    .text('ProMove Innovation Cloud', page.marginX, doc.y, { width: 320 });

  doc
    .fillColor(colors.muted)
    .fontSize(9)
    .font('Helvetica')
    .text('OFFICIAL INVESTMENT CONTRACT', page.marginX + 320, page.top + 4, {
      width: 167,
      align: 'right',
      characterSpacing: 1.1,
    });

  doc
    .fillColor(colors.body)
    .fontSize(12)
    .font('Helvetica')
    .text('Admin-Verified Equity Transfer Agreement', page.marginX, doc.y + 4, { width: 320 });

  doc
    .fontSize(9)
    .fillColor(colors.muted)
    .text(`No: ${data.contractNumber}`, page.marginX + 320, page.top + 28, {
      width: 167,
      align: 'right',
    });

  doc
    .moveTo(page.marginX, page.top + 64)
    .lineTo(page.marginX + page.width, page.top + 64)
    .lineWidth(1)
    .strokeColor(colors.border)
    .stroke();

  doc.y = page.top + 82;
};

const drawInfoBlock = (doc: PDFKit.PDFDocument, data: DealContractData) => {
  const y = doc.y;
  const rowHeight = 33;
  const columns = [
    { label: 'Startup', value: data.startupName },
    { label: 'Category', value: data.startupCategory || 'Not specified' },
    { label: 'Contract date', value: formatDate(data.generatedAt) },
    { label: 'Admin verified', value: formatDate(data.adminApprovedAt) },
  ];

  doc.roundedRect(page.marginX, y, page.width, 78, 10).fillAndStroke(colors.panel, colors.softBorder);

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
  doc
    .moveTo(page.marginX, doc.y + 17)
    .lineTo(page.marginX + page.width, doc.y + 17)
    .lineWidth(0.5)
    .strokeColor(colors.softBorder)
    .stroke();
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
  const headerHeight = 22;
  const rowHeight = 28;
  const labelX = page.marginX + 12;
  const valueX = page.marginX + 300;

  ensureSpace(doc, headerHeight + rowHeight);
  const headerY = doc.y;
  doc.rect(page.marginX, headerY, page.width, headerHeight).fill(colors.panelAlt);
  doc.fillColor(colors.muted).font('Helvetica-Bold').fontSize(8);
  doc.text('TERM', labelX, headerY + 7, { width: 270, lineBreak: false });
  doc.text('DETAIL', valueX, headerY + 7, { width: 175, align: 'right', lineBreak: false });
  doc.y = headerY + headerHeight;

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
    doc.text(row.label, labelX, rowY + 9, { width: 270, ellipsis: true, lineBreak: false });
    doc.font('Helvetica-Bold');
    doc.text(row.value, valueX, rowY + 9, { width: 175, align: 'right', ellipsis: true, lineBreak: false });

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
      .text('Generated by ProMove Innovation Cloud | Virtual simulation — non-binding', page.marginX, footerY, {
        width: 360,
        lineBreak: false,
      });
    doc.text(`Page ${pageIndex + 1} of ${range.count}`, page.marginX, footerY, {
      width: page.width,
      align: 'right',
      lineBreak: false,
    });
  }
};

export const buildDealContractDocument = (data: DealContractData): PDFKit.PDFDocument => {
  const doc = new PDFDocument({
    margin: page.marginX,
    size: 'A4',
    bufferPages: true,
    autoFirstPage: true,
  });

  drawHeader(doc, data);
  drawInfoBlock(doc, data);

  drawSectionTitle(doc, 'SECTION I: PARTIES');
  drawKeyValueTable(doc, [
    { label: 'Founder', value: data.founderName },
    { label: 'Investor', value: data.investorName },
    { label: 'Mediator', value: data.mediatorLabel || 'ProMove' },
  ]);

  drawSectionTitle(doc, 'SECTION II: FINAL TERMS');
  drawKeyValueTable(doc, [
    { label: 'Investment type', value: data.investorType === 'sole' ? 'Sole Investor (lead)' : 'Penny Investor (portfolio)' },
    { label: 'Investor role', value: titleCase(data.investorRole) },
    { label: 'Investment amount', value: formatINR(data.amountINR) },
    { label: 'Equity granted', value: `${data.equityPercent}%` },
    { label: 'Shares allocated', value: `${data.sharesAllocated.toLocaleString('en-IN')} (${data.shareClassLabel})` },
    { label: 'Indicative share price', value: formatINR(data.sharePriceInr) },
    { label: 'Transfer value', value: formatINR(data.transferValueInr || data.amountINR) },
    { label: `ProMove royalty (${data.royaltyPercentage}%)`, value: formatINR(data.royaltyAmountINR) },
  ]);

  drawSectionTitle(doc, 'SECTION III: ADMIN VERIFICATION');
  drawKeyValueTable(doc, [
    { label: 'Contract number', value: data.contractNumber },
    { label: 'Mediation status', value: titleCase(data.mediationStatus.replace(/_/g, ' ')) },
    { label: 'Equity transfer verified on', value: formatDate(data.adminApprovedAt) },
  ]);

  drawSectionTitle(doc, 'SECTION IV: NATURE OF AGREEMENT');
  drawParagraph(
    doc,
    'This is a virtual, non-binding simulation generated by the ProMove platform for educational and ' +
      'platform-internal record-keeping purposes only. It does not create real legal obligations and does ' +
      'not represent a transfer of actual money or securities. Any binding agreement requires separate ' +
      'offline execution.',
  );
  drawParagraph(
    doc,
    `By accepting the underlying deal and completing ProMove mediation review, ${data.founderName} (Founder) ` +
      `and ${data.investorName} (Investor) acknowledge the terms recorded above as their final, ` +
      'admin-verified position within the ProMove simulation.',
  );

  drawFooter(doc);
  return doc;
};

export const finalizeDealContract = (doc: PDFKit.PDFDocument): Promise<Buffer> =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
