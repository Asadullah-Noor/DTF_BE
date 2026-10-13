export function computeInvoiceStatus(paidAmount, total) {
  if (!paidAmount || paidAmount <= 0) return 'pending';
  if (paidAmount >= total) return 'paid';
  return 'partial_paid';
}

export const remaining = (total, paidAmount) => Math.max(total - (paidAmount || 0), 0);