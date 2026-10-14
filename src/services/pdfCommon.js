import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const C = {
  navy: '#0B3A6B', cyan: '#00A8F0', magenta: '#E6287E', yellow: '#F5C518',
  ink: '#1F2933', grey: '#6B7280', line: '#E5E7EB', light: '#F5F7FA', green: '#16A34A',
};
export const L = 40;   // left margin
export const R = 555;  // right edge
export const W = R - L;

export const pdfDate = (d) => {
  if (!d) return '';
  const [y, m, day] = new Date(d).toISOString().slice(0, 10).split('-');
  return `${day}-${m}-${y}`;
};

// Settings ka logo (PNG/JPG), warna server/assets/logo.png
function logoPath(settings) {
  const url = settings.logoUrl || '';
  const list = [];
  if (url.startsWith('/uploads/')) list.push(path.join(env.uploadsDir, path.basename(url)));
  list.push(path.resolve(__dirname, '../../assets/logo.png'));
  return list.find((p) => /\.(png|jpe?g)$/i.test(p) && fs.existsSync(p)) || null;
}

// Har page ke upar: logo + business details. Return: agla y.
export function drawHeader(doc, settings) {
  const lp = logoPath(settings);
  let drawn = false;
  if (lp) {
    try { doc.image(lp, L, 34, { fit: [170, 62] }); drawn = true; } catch { /* logo na chale to text */ }
  }
  if (!drawn) {
    doc.font('Helvetica-Bold').fontSize(18).fillColor(C.navy).text(settings.businessName, L, 48, { lineBreak: false });
  }

  doc.font('Helvetica-Bold').fontSize(12).fillColor(C.navy)
    .text(settings.businessName, 300, 38, { width: 255, align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor(C.grey);
  if (settings.address) doc.text(settings.address, 300, doc.y + 1, { width: 255, align: 'right' });
  if (settings.phone) doc.text('Phone: ' + settings.phone, 300, doc.y + 1, { width: 255, align: 'right' });

  doc.moveTo(L, 104).lineTo(R, 104).lineWidth(2).strokeColor(C.navy).stroke();
  [C.cyan, C.magenta, C.yellow].forEach((c, i) => doc.rect(L + i * 24, 106, 24, 3).fill(c));
  return 124;
}

export function drawFooter(doc, text) {
  doc.font('Helvetica').fontSize(8).fillColor(C.grey)
    .text(text, L, 800, { width: W, align: 'center', lineBreak: false });
}

export function sendPdf(res, filename) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
}