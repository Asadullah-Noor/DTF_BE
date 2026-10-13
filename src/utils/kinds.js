export const KINDS = ['invoice', 'payment_in', 'material_purchase', 'payment_out', 'return', 'expense'];

export const KIND_LABELS = {
  invoice: 'Invoice',
  payment_in: 'Payment received',
  material_purchase: 'Material purchase',
  payment_out: 'Payment made',
  return: 'Return',
  expense: 'Expense',
};

// Har kind kis side par jati hai
export const KIND_SIDE = {
  invoice: 'debit',
  payment_in: 'credit',
  material_purchase: 'credit',
  payment_out: 'debit',
  return: 'debit',
  expense: 'debit',
};

// Har kind kis type ki party ke liye hai (expense ke liye party nahi)
export const KIND_PARTY = {
  invoice: 'client',
  payment_in: 'client',
  material_purchase: 'supplier',
  payment_out: 'supplier',
  return: 'supplier',
};

export function defaultKind(partyType, side) {
  if (partyType === 'client') return side === 'debit' ? 'invoice' : 'payment_in';
  return side === 'credit' ? 'material_purchase' : 'payment_out';
}