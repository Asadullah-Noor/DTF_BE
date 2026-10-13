import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { HttpError } from '../utils/HttpError.js';

const IMAGES = ['image/png', 'image/jpeg', 'image/webp'];

const disk = (allowed, label) =>
  multer({
    storage: multer.diskStorage({
      destination: env.uploadsDir,
      filename: (_req, file, cb) =>
        cb(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase()),
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) =>
      allowed.includes(file.mimetype) ? cb(null, true) : cb(new HttpError(400, `Only ${label} allowed`)),
  });

export const uploadAttachment = disk([...IMAGES, 'application/pdf'], 'PNG, JPG, WEBP or PDF');
export const uploadLogo = disk(IMAGES, 'PNG, JPG or WEBP');

export const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    file.originalname.toLowerCase().endsWith('.xlsx')
      ? cb(null, true)
      : cb(new HttpError(400, 'Only .xlsx files are supported')),
});