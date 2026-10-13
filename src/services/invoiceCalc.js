import { HttpError } from '../utils/HttpError.js';

export function computeTotals(items, discount = 0) {
  const lines = items.map((i) => ({
    description: i.description,
    size: i.size || '',
    qty: i.qty,
    rate: i.rate,
    amount: Math.round(i.qty * i.rate),
  }));
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  if (discount > subtotal) throw new HttpError(400, 'Discount cannot be more than the subtotal');
  return { items: lines, subtotal, discount, total: subtotal - discount };
}
