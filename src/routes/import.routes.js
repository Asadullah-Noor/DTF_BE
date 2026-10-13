import { Router } from 'express';
import { z } from 'zod';
import Party from '../models/Party.js';
import Transaction from '../models/Transaction.js';
import { validate } from '../middleware/validate.js';
import { uploadExcel } from '../middleware/upload.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';
import { defaultKind } from '../utils/kinds.js';
import { logAudit } from '../services/audit.js';
import {
  parseSheet,
  autoMapping,
  isMappingComplete,
  normalizeRows,
  markDuplicates,
} from '../services/importer.js';

const router = Router();

// Step 1: file upload -> preview (mapping optional, warna auto-detect)
router.post(
  '/preview',
  uploadExcel.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Please upload an Excel file');
    const { headers, rows } = await parseSheet(req.file.buffer);

    let mapping = autoMapping(headers);
    if (req.body.mapping) {
      try {
        const sent = JSON.parse(req.body.mapping);
        for (const k of Object.keys(mapping)) if (k in sent) mapping[k] = sent[k] || null;
      } catch {
        throw new HttpError(400, 'Invalid mapping');
      }
    }

    if (!isMappingComplete(mapping)) {
      return res.json({ headers, mapping, mappingComplete: false, totalRows: rows.length, rows: [], summary: null });
    }

    const { rows: checked, summary } = await markDuplicates(normalizeRows(rows, mapping));
    res.json({ headers, mapping, mappingComplete: true, totalRows: rows.length, rows: checked, summary });
  })
);

const confirmSchema = z.object({
  rows: z
    .array(
      z
        .object({
          type: z.enum(['client', 'supplier']),
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          party: z.string().trim().min(1),
          debit: z.number().int().min(0),
          credit: z.number().int().min(0),
          notes: z.string().optional(),
          allowDuplicate: z.boolean().optional(),
        })
        .refine((r) => (r.debit > 0) !== (r.credit > 0), 'Each row needs either debit or credit')
    )
    .min(1, 'No rows to import')
    .max(5000),
});

// Step 2: user ne jo rows chunin, unhein save karo
router.post(
  '/confirm',
  validate(confirmSchema),
  asyncHandler(async (req, res) => {
    // Duplicates dobara server par check hote hain (client par bharosa nahi)
    const { rows } = await markDuplicates(req.body.rows.map((r) => ({ ...r, errors: [] })));
    const toSave = rows.filter((r) => r.status === 'ok' || (r.status === 'duplicate' && r.allowDuplicate));
    const skipped = rows.length - toSave.length;

    // Missing parties banao
    const partyMap = new Map();
    for (const p of await Party.find().lean()) partyMap.set(`${p.type}:${p.name.toLowerCase()}`, p._id);

    const missing = new Map();
    for (const r of toSave) {
      const key = `${r.type}:${r.party.toLowerCase()}`;
      if (!partyMap.has(key)) missing.set(key, { name: r.party, type: r.type });
    }
    let createdParties = 0;
    if (missing.size) {
      const created = await Party.insertMany([...missing.values()]);
      created.forEach((p) => partyMap.set(`${p.type}:${p.name.toLowerCase()}`, p._id));
      createdParties = created.length;
    }

    const docs = toSave.map((r) => ({
      date: new Date(r.date + 'T00:00:00.000Z'),
      partyId: partyMap.get(`${r.type}:${r.party.toLowerCase()}`),
      kind: defaultKind(r.type, r.debit > 0 ? 'debit' : 'credit'),
      debit: r.debit,
      credit: r.credit,
      notes: r.notes || '',
      refNo: 'import',
    }));
    if (docs.length) await Transaction.insertMany(docs);

    logAudit('import', 'Transaction', undefined, null, { imported: docs.length, createdParties, skipped });
    res.json({ imported: docs.length, createdParties, skipped });
  })
);

export default router;