import PDFDocument from 'pdfkit';
import { formatRs } from '../utils/money.js';
import { KIND_LABELS } from '../utils/kinds.js';
import { C, L, R, W, pdfDate, drawHeader, drawFooter, sendPdf } from './pdfCommon.js';
import { getSettings } from '../services/settings.js';
import { streamInvoicePdf } from '../services/invoicePdf.js';
const COLS = {
  date: [L, 62, 'left'],
  detail: [L + 68, 187, 'left'],
  debit: [L + 260, 75, 'right'],
  credit: [L + 340, 75, 'right'],
  balance: [L + 420, 95, 'right'],
};
const cell = (doc, key, text, y) => {
  const [x, w, align] = COLS[key];
  doc.text(String(text), x, y, { width: w, align });
};
const bal = (v) => formatRs(Math.abs(v)) + (v > 0 ? ' Dr' : v < 0 ? ' Cr' : '');

function head(doc, y) {
  doc.rect(L, y, W, 22).fill(C.navy);
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#fff');
  const ty = y + 7;
  cell(doc, 'date', 'Date', ty); cell(doc, 'detail', 'Detail', ty);
  cell(doc, 'debit', 'Debit', ty); cell(doc, 'credit', 'Credit', ty); cell(doc, 'balance', 'Balance', ty);
  return y + 28;
}

export function streamStatementPdf(res, st, settings) {
  const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: 'Statement ' + st.party.name } });
  const safe = st.party.name.replace(/[^a-z0-9]+/gi, '_');
  sendPdf(res, `statement-${safe}.pdf`);
  doc.pipe(res);

  let y = drawHeader(doc, settings);
  doc.font('Helvetica-Bold').fontSize(18).fillColor(C.navy).text('ACCOUNT STATEMENT', L, y, { lineBreak: false });
  y += 28;
  doc.font('Helvetica-Bold').fontSize(12).fillColor(C.ink).text(st.party.name, L, y, { width: 300 });
  doc.font('Helvetica').fontSize(9).fillColor(C.grey);
  doc.text(st.party.type === 'client' ? 'Client' : 'Supplier', L, doc.y + 1);
  if (st.party.phone) doc.text(st.party.phone, L, doc.y + 1);
  const period = `Period: ${st.from ? pdfDate(st.from) : 'Start'} to ${st.to ? pdfDate(st.to) : 'Today'}`;
  doc.text(period, 340, y, { width: R - 340, align: 'right' });
  y = Math.max(doc.y, y + 40) + 12;

  y = head(doc, y);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(C.ink);
  cell(doc, 'detail', 'Opening balance', y);
  cell(doc, 'balance', bal(st.openingBalance), y);
  y += 20;

  doc.font('Helvetica').fontSize(9).fillColor(C.ink);
  for (const r of st.rows) {
    const detail = [KIND_LABELS[r.kind], r.refNo, r.notes].filter(Boolean).join(' - ');
    const h = Math.max(doc.heightOfString(detail, { width: COLS.detail[1] }), 11) + 9;
    if (y + h > 740) {
      doc.addPage();
      y = head(doc, drawHeader(doc, settings));
      doc.font('Helvetica').fontSize(9).fillColor(C.ink);
    }
    cell(doc, 'date', pdfDate(r.date), y);
    cell(doc, 'detail', detail, y);
    cell(doc, 'debit', r.debit ? formatRs(r.debit) : '', y);
    cell(doc, 'credit', r.credit ? formatRs(r.credit) : '', y);
    cell(doc, 'balance', bal(r.balance), y);
    y += h;
    doc.moveTo(L, y - 4).lineTo(R, y - 4).lineWidth(0.5).strokeColor(C.line).stroke();
  }

  if (y + 60 > 780) { doc.addPage(); y = drawHeader(doc, settings); }
  y += 4;
  doc.rect(L, y, W, 26).fill(C.light);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(C.navy);
  const ty = y + 8;
  cell(doc, 'detail', 'Total', ty);
  cell(doc, 'debit', formatRs(st.totalDebit), ty);
  cell(doc, 'credit', formatRs(st.totalCredit), ty);
  y += 36;

  const tone = st.closingBalance > 0 ? C.green : st.closingBalance < 0 ? C.magenta : C.grey;
  doc.font('Helvetica-Bold').fontSize(13).fillColor(tone)
    .text(`Closing balance: ${formatRs(Math.abs(st.closingBalance))} (${st.closingLabel})`, L, y, { width: W, align: 'right' });

  drawFooter(doc, 'Computer generated statement.');
  doc.end();
}
