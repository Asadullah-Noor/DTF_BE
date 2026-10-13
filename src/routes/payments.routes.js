import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import Payment from '../models/Payment.js';
import { validate, objectId } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';
import { createPayment, updatePayment, deletePayment } from '../services/paymentService.js';

const router = Router();

const paymentSchema = z.object({
  partyId: objectId,
  kind: z.enum(['payment_in', 'payment_out']),
  date: z.coerce.date(),
  amount: z.number().int().min(1, 'Amount must be greater than 0'),
  allocations: z
    .array(z.object({ invoiceId: objectId, amount: z.number().int().min(1) }))
    .default([]),
  notes: z.string().optional(),
});

const listQuery = z.object({
  kind: z.enum(['payment_in', 'payment_out']).optional().catch(undefined),
  partyId: objectId.optional().catch(undefined),
  from: z.coerce.date().optional().catch(undefined),
  to: z.coerce.date().optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
  limit: z.coerce.number().int().min(1).max(200).catch(50),
});

router.get(
  '/',
  validate(listQuery, 'query'),
  asyncHandler(async (req, res) => {
    const { kind, partyId, from, to, page, limit } = req.query;
    const filter = {};
    if (kind) filter.kind = kind;
    if (partyId) filter.partyId = new mongoose.Types.ObjectId(partyId);
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = from;
      if (to) filter.date.$lte = new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1);
    }

    const [items, total] = await Promise.all([
      Payment.find(filter)
        .sort({ date: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('partyId', 'name type')
        .populate('allocations.invoiceId', 'number')
        .lean(),
      Payment.countDocuments(filter),
    ]);

    res.json({
      items: items.map(({ partyId, allocations, ...p }) => ({
        ...p,
        partyId: partyId?._id,
        party: partyId ? { _id: partyId._id, name: partyId.name, type: partyId.type } : null,
        allocations: allocations.map((a) => ({
          invoiceId: a.invoiceId?._id,
          number: a.invoiceId?.number,
          amount: a.amount,
        })),
      })),
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const p = await Payment.findById(req.params.id);
    if (!p) throw new HttpError(404, 'Payment not found');
    res.json(p);
  })
);

router.post('/', validate(paymentSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await createPayment(req.body));
}));

router.put('/:id', validate(paymentSchema), asyncHandler(async (req, res) => {
  res.json(await updatePayment(req.params.id, req.body));
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await deletePayment(req.params.id);
  res.json({ message: 'Deleted' });
}));

export default router;