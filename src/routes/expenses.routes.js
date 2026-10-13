import { Router } from 'express';
import { z } from 'zod';
import Expense from '../models/Expense.js';
import Transaction from '../models/Transaction.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';
import { logAudit } from '../services/audit.js';

const router = Router();

const CATEGORIES = ['Electricity', 'Rent', 'Ink', 'Film', 'Powder', 'Other'];

const expenseSchema = z.object({
  date: z.coerce.date(),
  category: z.enum(CATEGORIES),
  amount: z.number().int().min(1, 'Amount must be greater than 0'),
  notes: z.string().optional(),
});

const listQuery = z.object({
  category: z.enum(CATEGORIES).optional().catch(undefined),
  from: z.coerce.date().optional().catch(undefined),
  to: z.coerce.date().optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
  limit: z.coerce.number().int().min(1).max(200).catch(50),
});

const txnFields = (e) => ({
  date: e.date,
  kind: 'expense',
  debit: e.amount,
  credit: 0,
  expenseId: e._id,
  notes: e.category + (e.notes ? ' - ' + e.notes : ''),
});

router.get(
  '/',
  validate(listQuery, 'query'),
  asyncHandler(async (req, res) => {
    const { category, from, to, page, limit } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = from;
      if (to) filter.date.$lte = new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1);
    }

    const [items, total, byCat] = await Promise.all([
      Expense.find(filter).sort({ date: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Expense.countDocuments(filter),
      Expense.aggregate([{ $match: filter }, { $group: { _id: '$category', total: { $sum: '$amount' } } }]),
    ]);

    res.json({
      items,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      categories: CATEGORIES,
      byCategory: Object.fromEntries(byCat.map((c) => [c._id, c.total])),
      grandTotal: byCat.reduce((s, c) => s + c.total, 0),
    });
  })
);

router.post(
  '/',
  validate(expenseSchema),
  asyncHandler(async (req, res) => {
    const e = await Expense.create(req.body);
    try {
      await Transaction.create(txnFields(e));
    } catch (err) {
      await e.deleteOne();
      throw err;
    }
    logAudit('create', 'Expense', e._id, null, e);
    res.status(201).json(e);
  })
);

router.put(
  '/:id',
  validate(expenseSchema),
  asyncHandler(async (req, res) => {
    const e = await Expense.findById(req.params.id);
    if (!e) throw new HttpError(404, 'Expense not found');
    const before = e.toObject();
    e.set(req.body);
    await e.save();
    await Transaction.updateOne({ expenseId: e._id }, { $set: txnFields(e) }, { upsert: true });
    logAudit('update', 'Expense', e._id, before, e);
    res.json(e);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const e = await Expense.findById(req.params.id);
    if (!e) throw new HttpError(404, 'Expense not found');
    await Transaction.deleteMany({ expenseId: e._id });
    await e.deleteOne();
    logAudit('delete', 'Expense', e._id, e, null);
    res.json({ message: 'Deleted' });
  })
);

export default router;