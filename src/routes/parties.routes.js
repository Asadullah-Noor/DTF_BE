import { Router } from 'express';
import { z } from 'zod';
import Party from '../models/Party.js';
import Transaction from '../models/Transaction.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';
import { logAudit } from '../services/audit.js';
import { getSettings } from '../services/settings.js';
import { getBalanceMap, withBalance, getStatement } from '../services/partyService.js';
import { statementWorkbook } from '../services/excel.js';
import { streamStatementPdf } from '../services/statementPdf.js';

const router = Router();

const createSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  type: z.enum(['client', 'supplier']),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  openingBalance: z.number().int().optional(), // paisa, signed
  notes: z.string().optional(),
});
const updateSchema = createSchema.partial();

const listQuery = z.object({
  search: z.string().optional(),
  type: z.enum(['client', 'supplier']).optional().catch(undefined),
});

const rangeQuery = z.object({
  from: z.coerce.date().optional().catch(undefined),
  to: z.coerce.date().optional().catch(undefined),
});

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findParty = async (id) => {
  const p = await Party.findById(id);
  if (!p) throw new HttpError(404, 'Party not found');
  return p;
};

router.get(
  '/',
  validate(listQuery, 'query'),
  asyncHandler(async (req, res) => {
    const { search, type } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (search) filter.name = { $regex: escapeRegex(search), $options: 'i' };
    const [parties, map] = await Promise.all([
      Party.find(filter).sort({ name: 1 }).lean(),
      getBalanceMap(),
    ]);
    res.json(parties.map((p) => withBalance(p, map)));
  })
);

router.post(
  '/',
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const party = await Party.create(req.body);
    logAudit('create', 'Party', party._id, null, party);
    res.status(201).json(party);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const party = await findParty(req.params.id);
    const map = await getBalanceMap();
    res.json(withBalance(party.toObject(), map));
  })
);

router.put(
  '/:id',
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const party = await findParty(req.params.id);
    const before = party.toObject();
    if (req.body.type && req.body.type !== party.type && (await Transaction.exists({ partyId: party._id }))) {
      throw new HttpError(400, 'Cannot change type: this party already has transactions');
    }
    Object.assign(party, req.body);
    await party.save();
    logAudit('update', 'Party', party._id, before, party);
    res.json(party);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const party = await findParty(req.params.id);
    if (await Transaction.exists({ partyId: party._id })) {
      throw new HttpError(400, 'This party has transactions. Delete them first.');
    }
    await party.deleteOne();
    logAudit('delete', 'Party', party._id, party, null);
    res.json({ message: 'Deleted' });
  })
);

router.get(
  '/:id/statement',
  validate(rangeQuery, 'query'),
  asyncHandler(async (req, res) => {
    const party = await findParty(req.params.id);
    res.json(await getStatement(party.toObject(), req.query));
  })
);

router.get(
  '/:id/statement/excel',
  validate(rangeQuery, 'query'),
  asyncHandler(async (req, res) => {
    const party = await findParty(req.params.id);
    const [st, settings] = await Promise.all([getStatement(party.toObject(), req.query), getSettings()]);
    const wb = await statementWorkbook(st, settings);
    const safe = party.name.replace(/[^a-z0-9]+/gi, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="statement-${safe}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  })
);

router.get(
  '/:id/statement/pdf',
  validate(rangeQuery, 'query'),
  asyncHandler(async (req, res) => {
    const party = await findParty(req.params.id);
    const [st, settings] = await Promise.all([getStatement(party.toObject(), req.query), getSettings()]);
    streamStatementPdf(res, st, settings);
  })
);

export default router;