import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import Party from '../models/Party.js';
import Transaction from '../models/Transaction.js';
import { validate, objectId } from '../middleware/validate.js';
import { uploadAttachment } from '../middleware/upload.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';
import { KINDS, KIND_LABELS, KIND_SIDE, KIND_PARTY, defaultKind } from '../utils/kinds.js';
import { logAudit } from '../services/audit.js';

const router = Router();

const baseSchema = z.object({
  date: z.coerce.date(),
  partyId: objectId.optional(),
  kind: z.enum(KINDS).optional(),
  debit: z.number().int().min(0).optional(),
  credit: z.number().int().min(0).optional(),
  refNo: z.string().optional(),
  notes: z.string().optional(),
  attachmentUrl: z.string().optional(),
});

const createSchema = baseSchema.refine(
  (d) => ((d.debit || 0) > 0) !== ((d.credit || 0) > 0),
  'Enter either a debit or a credit amount (not both, not zero)'
);

const listQuery = z.object({
  from: z.coerce.date().optional().catch(undefined),
  to: z.coerce.date().optional().catch(undefined),
  partyId: objectId.optional().catch(undefined),
  kind: z.enum(KINDS).optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
  limit: z.coerce.number().int().min(1).max(200).catch(50),
});

// Rules check karke final debit/credit/kind/partyId banata hai
async function buildEntry(d) {
  const side = (d.debit || 0) > 0 ? 'debit' : 'credit';
  let party = null;
  if (d.partyId) {
    party = await Party.findById(d.partyId);
    if (!party) throw new HttpError(404, 'Party not found');
  }

  let kind = d.kind;
  if (!kind) {
    if (!party) throw new HttpError(400, 'Please select a party');
    kind = defaultKind(party.type, side);
  }
  if (kind === 'expense') {
    party = null; // expense ki koi party nahi
  } else if (!party) {
    throw new HttpError(400, 'Please select a party');
  }
  if (KIND_SIDE[kind] !== side) {
    throw new HttpError(400, `${KIND_LABELS[kind]} must be a ${KIND_SIDE[kind]} entry`);
  }
  if (party && KIND_PARTY[kind] && KIND_PARTY[kind] !== party.type) {
    throw new HttpError(400, `${KIND_LABELS[kind]} can only be used with a ${KIND_PARTY[kind]}`);
  }

  return {
    date: d.date,
    partyId: party ? party._id : undefined,
    kind,
    debit: d.debit || 0,
    credit: d.credit || 0,
    refNo: d.refNo ?? '',
    notes: d.notes ?? '',
    attachmentUrl: d.attachmentUrl ?? '',
  };
}

const isLinked = (t) => !!(t.invoiceId || t.paymentId || t.expenseId);

// Bill photo / PDF upload. Sirf file save hoti hai, koi text extraction nahi.
router.post(
  '/upload',
  uploadAttachment.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Please choose a file');
    res.status(201).json({ url: '/uploads/' + req.file.filename });
  })
);

router.get(
  '/',
  validate(listQuery, 'query'),
  asyncHandler(async (req, res) => {
    const { from, to, partyId, kind, page, limit } = req.query;
    const filter = {};
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = from;
      if (to) filter.date.$lte = new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1);
    }
    if (partyId) filter.partyId = new mongoose.Types.ObjectId(partyId);
    if (kind) filter.kind = kind;

    const [items, total, sums] = await Promise.all([
      Transaction.find(filter)
        .sort({ date: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('partyId', 'name type')
        .lean(),
      Transaction.countDocuments(filter),
      Transaction.aggregate([
        { $match: filter },
        { $group: { _id: null, debit: { $sum: '$debit' }, credit: { $sum: '$credit' } } },
      ]),
    ]);

    res.json({
      items: items.map(({ partyId, ...t }) => ({
        ...t,
        partyId: partyId?._id,
        party: partyId ? { _id: partyId._id, name: partyId.name, type: partyId.type } : null,
        linked: isLinked(t),
      })),
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      totals: { debit: sums[0]?.debit || 0, credit: sums[0]?.credit || 0 },
    });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const t = await Transaction.findById(req.params.id).populate('partyId', 'name type');
    if (!t) throw new HttpError(404, 'Transaction not found');
    res.json(t);
  })
);

router.post(
  '/',
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const t = await Transaction.create(await buildEntry(req.body));
    logAudit('create', 'Transaction', t._id, null, t);
    res.status(201).json(t);
  })
);

router.put(
  '/:id',
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const t = await Transaction.findById(req.params.id);
    if (!t) throw new HttpError(404, 'Transaction not found');
    if (isLinked(t)) {
      throw new HttpError(400, 'This entry belongs to an invoice, payment or expense. Edit it from there.');
    }
    const before = t.toObject();
    t.set(await buildEntry(req.body));
    await t.save();
    logAudit('update', 'Transaction', t._id, before, t);
    res.json(t);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const t = await Transaction.findById(req.params.id);
    if (!t) throw new HttpError(404, 'Transaction not found');
    if (isLinked(t)) {
      throw new HttpError(400, 'This entry belongs to an invoice, payment or expense. Delete it from there.');
    }
    await t.deleteOne();
    logAudit('delete', 'Transaction', t._id, t, null);
    res.json({ message: 'Deleted' });
  })
);

export default router;