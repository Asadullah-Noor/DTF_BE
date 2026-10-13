import { z } from 'zod';
import { HttpError } from '../utils/HttpError.js';

export const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source] ?? {});
  if (!result.success) {
    const msg = result.error.issues
      .map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
      .join(', ');
    return next(new HttpError(400, msg));
  }
  // Express 5 mein req.query read-only hai, is liye defineProperty
  Object.defineProperty(req, source, { value: result.data, writable: true, configurable: true });
  next();
};