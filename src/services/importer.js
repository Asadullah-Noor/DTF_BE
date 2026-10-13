import ExcelJS from 'exceljs';
import Party from '../models/Party.js';
import Transaction from '../models/Transaction.js';
import { HttpError } from '../utils/HttpError.js';

const ALIASES = {
  type: ['type'],
  date: ['date', 'dated'],
  party: ['client', 'party', 'customer', 'supplier', 'name'],
  debit: ['debit', 'dr'],
  credit: ['credit', 'cr'],
  notes: ['notes', 'note', 'detail', 'details', 'description', 'remarks'],
};

const plain = (v) => {
  if (v == null) return '';
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if ('result' in v) return v.result ?? '';
    if (v.richText) return v.richText.map((r) => r.text).join('');
    if ('text' in v) return v.text;
    return '';
  }
  return v;
};

export async function parseSheet(buffer) {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch {
    throw new HttpError(400, 'Could not read this file. Please upload a valid .xlsx file');
  }
  const ws = wb.worksheets[0];
  if (!ws) throw new HttpError(400, 'The file has no sheets');

  const headerRow = ws.getRow(1);
  const headers = [];
  for (let c = 1; c <= ws.columnCount; c++) {
    headers[c - 1] = String(plain(headerRow.getCell(c).value)).trim();
  }

  const rows = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const data = {};
    headers.forEach((h, i) => {
      if (h) data[h] = plain(row.getCell(i + 1).value);
    });
    if (Object.values(data).some((v) => v !== '' && v != null)) rows.push({ rowNum: n, data });
  });

  return { headers: headers.filter(Boolean), rows };
}

export function autoMapping(headers) {
  const mapping = {};
  for (const [field, names] of Object.entries(ALIASES)) {
    mapping[field] =
      headers.find((h) => names.includes(h.toLowerCase())) ||
      headers.find((h) => names.some((n) => h.toLowerCase().includes(n))) ||
      null;
  }
  return mapping;
}

export const isMappingComplete = (m) => !!(m.date && m.party && (m.debit || m.credit));

// Date ko UTC midnight par laate hain (timezone ka masla na ho)
function parseDate(v) {
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000)); // Excel serial
    return isNaN(d) ? null : d.toISOString().slice(0, 10);
  }
  if (typeof v === 'string' && v.trim()) {
    const s = v.trim();
    const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/); // dd/mm/yyyy
    if (m) {
      let [, d, mo, y] = m.map(Number);
      if (y < 100) y += 2000;
      const dt = new Date(Date.UTC(y, mo - 1, d));
      return dt.getUTCMonth() === mo - 1 ? dt.toISOString().slice(0, 10) : null;
    }
    const dt = new Date(s);
    return isNaN(dt) ? null : dt.toISOString().slice(0, 10);
  }
  return null;
}

// returns paisa, ya NaN agar amount ghalat ho
function parseAmount(v) {
  if (v === '' || v == null) return 0;
  if (typeof v === 'number') return Math.round(v * 100);
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isNaN(n) ? NaN : Math.round(n * 100);
}

const guessType = (v) => (/supplier|vendor/i.test(String(v || '')) ? 'supplier' : 'client');

export function normalizeRows(rows, mapping) {
  return rows.map(({ rowNum, data }) => {
    const errors = [];
    const date = parseDate(data[mapping.date]);
    const party = String(data[mapping.party] ?? '').trim();
    const debit = mapping.debit ? parseAmount(data[mapping.debit]) : 0;
    const credit = mapping.credit ? parseAmount(data[mapping.credit]) : 0;

    if (!date) errors.push('Invalid date');
    if (!party) errors.push('Missing client/supplier name');
    if (Number.isNaN(debit) || Number.isNaN(credit) || debit < 0 || credit < 0) errors.push('Invalid amount');
    else if (debit > 0 && credit > 0) errors.push('Both debit and credit filled');
    else if (debit === 0 && credit === 0) errors.push('No amount');

    return {
      rowNum,
      type: mapping.type ? guessType(data[mapping.type]) : 'client',
      date,
      party,
      debit: Number.isNaN(debit) ? 0 : debit,
      credit: Number.isNaN(credit) ? 0 : credit,
      notes: mapping.notes ? String(data[mapping.notes] ?? '') : '',
      errors,
    };
  });
}

const pKey = (type, name) => `${type}:${name.trim().toLowerCase()}`;

// Duplicate = same party + same amount + same date (DB mein ya file ke andar)
export async function markDuplicates(rows) {
  const parties = await Party.find().lean();
  const partyMap = new Map(parties.map((p) => [pKey(p.type, p.name), p]));

  const valid = rows.filter((r) => !(r.errors && r.errors.length));
  const ids = [...new Set(valid.map((r) => partyMap.get(pKey(r.type, r.party))?._id).filter(Boolean).map(String))];

  const existing = new Set();
  if (ids.length) {
    const txns = await Transaction.find({ partyId: { $in: ids } }).select('partyId date debit credit').lean();
    for (const t of txns) {
      existing.add(`${t.partyId}|${t.date.toISOString().slice(0, 10)}|${t.debit}|${t.credit}`);
    }
  }

  const seen = new Set();
  const newParties = new Map();

  for (const r of rows) {
    r.errors = r.errors || [];
    const party = partyMap.get(pKey(r.type, r.party));
    r.partyExists = !!party;
    r.duplicateReason = null;

    if (!r.errors.length) {
      if (!party) newParties.set(pKey(r.type, r.party), { name: r.party, type: r.type });

      const fileKey = `${pKey(r.type, r.party)}|${r.date}|${r.debit}|${r.credit}`;
      if (party && existing.has(`${party._id}|${r.date}|${r.debit}|${r.credit}`)) {
        r.duplicateReason = 'Already in ledger';
      } else if (seen.has(fileKey)) {
        r.duplicateReason = 'Repeated in file';
      }
      seen.add(fileKey);
    }
    r.status = r.errors.length ? 'error' : r.duplicateReason ? 'duplicate' : 'ok';
  }

  return {
    rows,
    summary: {
      total: rows.length,
      ok: rows.filter((r) => r.status === 'ok').length,
      duplicates: rows.filter((r) => r.status === 'duplicate').length,
      errors: rows.filter((r) => r.status === 'error').length,
      newParties: [...newParties.values()],
    },
  };
}