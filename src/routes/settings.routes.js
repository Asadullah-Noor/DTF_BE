import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { uploadLogo } from '../middleware/upload.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';
import { getSettings } from '../services/settings.js';

const router = Router();

const updateSchema = z.object({
  businessName: z.string().trim().min(1).optional(),
  address: z.string().trim().optional(),
  phone: z.string().trim().optional(),
});

router.get('/', asyncHandler(async (_req, res) => res.json(await getSettings())));

router.put(
  '/',
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const s = await getSettings();
    Object.assign(s, req.body);
    await s.save();
    res.json(s);
  })
);

router.post(
  '/logo',
  uploadLogo.single('logo'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Please choose a logo image');
    const s = await getSettings();
    s.logoUrl = '/uploads/' + req.file.filename;
    await s.save();
    res.json(s);
  })
);

export default router;