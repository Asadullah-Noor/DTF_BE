import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { receivablesAndPayables, monthlySummary, dashboard } from '../services/reportService.js';

const router = Router();

const monthQuery = z.object({ month: z.string().optional() });

router.get('/dashboard', asyncHandler(async (_req, res) => res.json(await dashboard())));

router.get(
  '/receivables',
  asyncHandler(async (_req, res) => {
    const r = await receivablesAndPayables();
    res.json({ items: r.receivables, total: r.totalReceivable });
  })
);

router.get(
  '/payables',
  asyncHandler(async (_req, res) => {
    const r = await receivablesAndPayables();
    res.json({ items: r.payables, total: r.totalPayable });
  })
);

router.get(
  '/monthly-summary',
  validate(monthQuery, 'query'),
  asyncHandler(async (req, res) => res.json(await monthlySummary(req.query.month)))
);

export default router;