import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

for (const k of ['MONGO_URI', 'JWT_SECRET']) {
  if (!process.env[k]) throw new Error(`Missing env var: ${k}`);
}

const uploadsDir = path.resolve(__dirname, '../../uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

export const env = {
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  ownerEmail: process.env.OWNER_EMAIL,
  ownerPassword: process.env.OWNER_PASSWORD,
  uploadsDir,
};