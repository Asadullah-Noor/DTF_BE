import PDFDocument from 'pdfkit';
import { formatRs } from '../utils/money.js';
import { amountInWords } from '../utils/amountInWords.js';
import { remaining } from './invoiceStatus.js';
import { C, L, R, W, pdfDate, drawHeader, drawFooter, sendPdf } from './pdfCommon.js';

const STATUS = {
  pending: { label: 'PENDING', bg: C.magenta, fg: '#fff' },
  partial_paid: { label: 'PARTIAL PAID', bg: C.yellow, fg: C.ink },
  paid: { label: 'PAID', bg: C.green, fg: '#fff' },
};

// kolumn: x, width, align
const COLS = {
  desc: [L, 230, 'left'],
  size: [L + 235, 70, 'left'],
  qty: [L + 310, 45, 'right'],
  rate: [L + 360, 70, 'right'],
  amount: [L + 435, 80, 'right'],
};

function cell(doc, key, text, y) {
  const [x, w, align] = COLS[key];
  doc.text(String(text), x, y, { width: w, align });
}

function tableHead(doc, y) {
  doc.rect(L, y, W, 22).fill(C.navy);
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#fff');
  const ty = y + 7;
  cell(doc, 'desc', 'Description', ty);
  cell(doc, 'size', 'Size / Meters', ty);
  cell(doc, 'qty', 'Qty', ty);
  cell(doc, 'rate', 'Rate', ty);
  cell(doc, 'amount', 'Amount', ty);
  return y + 28;
}

export function streamInvoicePdf(res, inv, settings) {
  const client = inv.clientId || {};
  const rem = remaining(inv.total, inv.paidAmount);
  const st = STATUS[inv.status] || STATUS.pending;

  const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: inv.number } });
  sendPdf(res, `${inv.number}.pdf`);
  doc.pipe(res);

  let y = drawHeader(doc, settings);

  // Title + number/date (left), status badge (right)
  doc.font('Helvetica-Bold').fontSize(20).fillColor(C.navy).text('INVOICE', L, y, { lineBreak: false });
  doc.roundedRect(R - 110, y + 2, 110, 22, 11).fill(st.bg);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(st.fg)
    .text(st.label, R - 110, y + 9, { width: 110, align: 'center', lineBreak: false });
  y += 34;

  // Bill to (left) | invoice info (right)
  doc.font('Helvetica-Bold').fontSize(8).fillColor(C.grey).text('BILL TO', L, y, { lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(12).fillColor(C.ink).text(client.name || '', L, y + 12, { width: 260 });
  doc.font('Helvetica').fontSize(9).fillColor(C.grey);
  if (client.phone) doc.text(client.phone, L, doc.y + 1, { width: 260 });
  if (client.address) doc.text(client.address, L, doc.y + 1, { width: 260 });
  const leftEnd = doc.y;

  const info = [['Invoice No', inv.number], ['Date', pdfDate(inv.issueDate)]];
  if (inv.dueDate) info.push(['Due Date', pdfDate(inv.dueDate)]);
  let iy = y;
  for (const [k, v] of info) {
    doc.font('Helvetica').fontSize(9).fillColor(C.grey).text(k, 340, iy, { width: 90, lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.ink).text(v, 430, iy - 1, { width: R - 430, align: 'right', lineBreak: false });
    iy += 16;
  }
  y = Math.max(leftEnd, iy) + 16;

  // Items table
  y = tableHead(doc, y);
  doc.font('Helvetica').fontSize(10).fillColor(C.ink);
  for (const it of inv.items) {
    const h = Math.max(doc.heightOfString(it.description, { width: COLS.desc[1] }), 12) + 10;
    if (y + h > 700) {
      doc.addPage();
      y = tableHead(doc, drawHeader(doc, settings));
      doc.font('Helvetica').fontSize(10).fillColor(C.ink);
    }
    cell(doc, 'desc', it.description, y);
    cell(doc, 'size', it.size || '-', y);
    cell(doc, 'qty', it.qty, y);
    cell(doc, 'rate', formatRs(it.rate), y);
    cell(doc, 'amount', formatRs(it.amount), y);
    y += h;
    doc.moveTo(L, y - 4).lineTo(R, y - 4).lineWidth(0.5).strokeColor(C.line).stroke();
  }

  // Totals (aakhri page par, jagah na ho to nayi page)
  if (y + 150 > 760) { doc.addPage(); y = drawHeader(doc, settings); }
  y += 8;
  const row = (label, value, opts = {}) => {
    doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts.big ? 12 : 10).fillColor(opts.color || C.ink);
    doc.text(label, 330, y, { width: 110, lineBreak: false });
    doc.text(value, 440, y, { width: R - 440, align: 'right', lineBreak: false });
    y += opts.big ? 22 : 18;
  };
  row('Subtotal', formatRs(inv.subtotal));
  if (inv.discount > 0) row('Discount', '- ' + formatRs(inv.discount), { color: C.magenta });
  doc.moveTo(330, y - 2).lineTo(R, y - 2).lineWidth(1).strokeColor(C.navy).stroke();
  y += 4;
  row('Total', formatRs(inv.total), { bold: true, big: true, color: C.navy });
  row('Received', formatRs(inv.paidAmount), { color: C.green });
  row('Remaining', formatRs(rem), { bold: true, color: rem > 0 ? C.magenta : C.green });

  // Amount in words
  y += 6;
  doc.roundedRect(L, y, W, 34, 4).fill(C.light);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(C.grey).text('AMOUNT IN WORDS (TOTAL)', L + 10, y + 6, { lineBreak: false });
  doc.font('Helvetica').fontSize(10).fillColor(C.ink).text(amountInWords(inv.total), L + 10, y + 18, { width: W - 20, lineBreak: false });
  y += 46;

  if (inv.notes) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.grey).text('NOTES', L, y, { lineBreak: false });
    doc.font('Helvetica').fontSize(9).fillColor(C.ink).text(inv.notes, L, y + 12, { width: W });
  }

  drawFooter(doc, 'Thank you for your business. This is a computer generated invoice.');
  doc.end();
}