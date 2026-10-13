import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import User from '../models/User.js';
import { env } from '../config/env.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many login attempts. Try again later.' },
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const changeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'At least 8 characters'),
});

router.post(
  '/login',
  loginLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    const ok = user && (await bcrypt.compare(password, user.passwordHash));
    if (!ok) throw new HttpError(401, 'Invalid email or password');

    const token = jwt.sign({ id: user._id, email: user.email }, env.jwtSecret, {
      expiresIn: env.jwtExpiresIn,
    });
    res.json({ token, user: { id: user._id, email: user.email } });
  })
);

router.post(
  '/change-password',
  requireAuth,
  validate(changeSchema),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new HttpError(400, 'Current password is incorrect');
    }
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.json({ message: 'Password changed' });
  })
);

export default router;