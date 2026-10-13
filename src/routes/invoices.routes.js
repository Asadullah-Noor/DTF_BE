import { Router } from 'express';
import { z } from 'zod';
import Invoice from '../models/Invoice.js';
import Payment from '../models/Payment.js';
import { validate, objectId } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';
import { remaining } from '../services/invoiceStatus.js';
import { createInvoice, updateInvoice, deleteInvoice } from '../services/invoiceService.js';
import { createPayment } from '../services/paymentService.js';

const router = Router();

const itemSchema = z.object({
  description: z.string().trim().min(1, 'Item description is required'),
  size: z.string().optional(),
  qty: z.number().positive('Quantity must be greater than 0'),
  rate: z.number().int().min(0),
});

const invoiceSchema = z.object({
  clientId: objectId,
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date().optional().nullable(),
  items: z.array(itemSchema).min(1, 'Add at least one item'),
  discount: z.number().int().min(0).default(0),
  notes: z.string().optional(),
});

const payNowSchema = z.object({
  date: z.coerce.date(),
  amount: z.number().int().min(1),
  notes: z.string().optional(),
});

const listQuery = z.object({
  status: z.enum(['pending', 'partial_paid', 'paid']).optional().catch(undefined),
  clientId: objectId.optional().catch(undefined),
  search: z.string().optional(),
  from: z.coerce.date().optional().catch(undefined),
  to: z.coerce.date().optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
  limit: z.coerce.number().int().min(1).max(200).catch(50),
});

const withRemaining = (i) => ({ ...i, remaining: remaining(i.total, i.paidAmount) });
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

router.get(
  '/',
  validate(listQuery, 'query'),
  asyncHandler(async (req, res) => {
    const { status, clientId, search, from, to, page, limit } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (clientId) filter.clientId = clientId;
    if (search) filter.number = { $regex: escapeRegex(search), $options: 'i' };
    if (from || to) {
      filter.issueDate = {};
      if (from) filter.issueDate.$gte = from;
      if (to) filter.issueDate.$lte = new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1);
    }

    const [items, total] = await Promise.all([
      Invoice.find(filter)
        .sort({ issueDate: -1, number: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('clientId', 'name')
        .lean(),
      Invoice.countDocuments(filter),
    ]);

    res.json({
      items: items.map(({ clientId, ...i }) =>
        withRemaining({ ...i, clientId: clientId?._id, client: clientId ? { _id: clientId._id, name: clientId.name } : null })
      ),
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    });
  })
);

router.post(
  '/',
  validate(invoiceSchema),
  asyncHandler(async (req, res) => {
    const inv = await createInvoice(req.body);
    res.status(201).json(withRemaining(inv.toObject()));
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const inv = await Invoice.findById(req.params.id).populate('clientId', 'name phone address type').lean();
    if (!inv) throw new HttpError(404, 'Invoice not found');

    const payments = await Payment.find({ 'allocations.invoiceId': inv._id }).sort({ date: 1 }).lean();
    const { clientId, ...rest } = inv;
    res.json(
      withRemaining({
        ...rest,
        clientId: clientId._id,
        client: clientId,
        payments: payments.map((p) => ({
          _id: p._id,
          date: p.date,
          notes: p.notes,
          amount: p.allocations.find((a) => String(a.invoiceId) === String(inv._id)).amount,
        })),
      })
    );
  })
);

router.put(
  '/:id',
  validate(invoiceSchema),
  asyncHandler(async (req, res) => {
    const inv = await updateInvoice(req.params.id, req.body);
    res.json(withRemaining(inv.toObject()));
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await deleteInvoice(req.params.id);
    res.json({ message: 'Deleted' });
  })
);

// "Record payment" button: is invoice par payment
router.post(
  '/:id/payments',
  validate(payNowSchema),
  asyncHandler(async (req, res) => {
    const inv = await Invoice.findById(req.params.id);
    if (!inv) throw new HttpError(404, 'Invoice not found');
    const left = remaining(inv.total, inv.paidAmount);
    if (req.body.amount > left) {
      throw new HttpError(400, 'Amount is more than the remaining balance of this invoice');
    }
    const payment = await createPayment({
      partyId: inv.clientId,
      kind: 'payment_in',
      date: req.body.date,
      amount: req.body.amount,
      allocations: [{ invoiceId: inv._id, amount: req.body.amount }],
      notes: req.body.notes,
    });
    res.status(201).json(payment);
  })
);

export default router;