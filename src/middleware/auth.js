import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError } from '../utils/HttpError.js';

export function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Not authenticated'));
  try {
    req.user = jwt.verify(token, env.jwtSecret);
    next();
  } catch {
    next(new HttpError(401, 'Invalid or expired token'));
  }
}