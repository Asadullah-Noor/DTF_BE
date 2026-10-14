import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

for (const k of ['MONGO_URI', 'JWT_SECRET']) {
  if (!process.env[k]) {
    throw new Error(`Missing env var: ${k}`);
  }
}

const uploadsDir = process.env.VERCEL
  ? '/tmp/uploads'
  : path.resolve(__dirname, '../../uploads');

fs.mkdirSync(uploadsDir, { recursive: true });

export const env = {
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientUrl: process.env.CLIENT_URL || 'https://waqasdtf.vercel.app',
  ownerEmail: process.env.OWNER_EMAIL,
  ownerPassword: process.env.OWNER_PASSWORD,
  uploadsDir,
};