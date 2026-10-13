import mongoose from 'mongoose';
import Payment from '../models/Payment.js';
import Party from '../models/Party.js';
import Invoice from '../models/Invoice.js';
import Transaction from '../models/Transaction.js';
import { HttpError } from '../utils/HttpError.js';
import { logAudit } from './audit.js';

const oid = (id) => new mongoose.Types.ObjectId(String(id));

// Is invoice par (kisi ek payment ko chhor kar) baaqi payments se kitna allocate hua
async function allocatedByOthers(invoiceId, excludePaymentId) {
  const match = { 'allocations.invoiceId': oid(invoiceId) };
  if (excludePaymentId) match._id = { $ne: oid(excludePaymentId) };
  const r = await Payment.aggregate([
    { $match: match },
    { $unwind: '$allocations' },
    { $match: { 'allocations.invoiceId': oid(invoiceId) } },
    { $group: { _id: null, total: { $sum: '$allocations.amount' } } },
  ]);
  return r[0]?.total || 0;
}

// paidAmount hamesha payments se dobara nikalta hai (status save() par khud set hota hai)
export async function recalcInvoice(invoiceId) {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) return;
  invoice.paidAmount = await allocatedByOthers(invoiceId, null);
  await invoice.save();
}

async function validate(d, excludePaymentId) {
  const party = await Party.findById(d.partyId);
  if (!party) throw new HttpError(404, 'Party not found');

  const expected = d.kind === 'payment_in' ? 'client' : 'supplier';
  if (party.type !== expected) {
    throw new HttpError(400, d.kind === 'payment_in'
      ? 'Payment received must be from a client'
      : 'Payment made must be to a supplier');
  }

  const allocs = d.allocations || [];
  if (d.kind === 'payment_out' && allocs.length) {
    throw new HttpError(400, 'Supplier payments cannot be linked to invoices');
  }
  if (new Set(allocs.map((a) => String(a.invoiceId))).size !== allocs.length) {
    throw new HttpError(400, 'Same invoice selected twice');
  }
  const sum = allocs.reduce((s, a) => s + a.amount, 0);
  if (sum > d.amount) throw new HttpError(400, 'Allocated amount is more than the payment amount');

  for (const a of allocs) {
    const inv = await Invoice.findById(a.invoiceId);
    if (!inv) throw new HttpError(404, 'Invoice not found');
    if (String(inv.clientId) !== String(party._id)) {
      throw new HttpError(400, `${inv.number} does not belong to this client`);
    }
    const other = await allocatedByOthers(inv._id, excludePaymentId);
    if (other + a.amount > inv.total) {
      throw new HttpError(400, `${inv.number}: amount is more than the remaining balance`);
    }
  }
}

const sideFields = (kind, amount) =>
  kind === 'payment_in' ? { debit: 0, credit: amount } : { debit: amount, credit: 0 };

export async function createPayment(d) {
  await validate(d, null);
  const payment = await Payment.create({
    partyId: d.partyId,
    kind: d.kind,
    date: d.date,
    amount: d.amount,
    allocations: d.allocations || [],
    notes: d.notes || '',
  });

  try {
    await Transaction.create({
      date: payment.date,
      partyId: payment.partyId,
      kind: payment.kind,
      ...sideFields(payment.kind, payment.amount),
      paymentId: payment._id,
      notes: payment.notes,
    });
  } catch (e) {
    await payment.deleteOne();
    throw e;
  }

  for (const a of payment.allocations) await recalcInvoice(a.invoiceId);
  logAudit('create', 'Payment', payment._id, null, payment);
  return payment;
}

export async function updatePayment(id, d) {
  const payment = await Payment.findById(id);
  if (!payment) throw new HttpError(404, 'Payment not found');

  // party aur kind badalna allowed nahi, delete karke nayi bana lein
  const data = { ...d, partyId: payment.partyId, kind: payment.kind };
  await validate(data, payment._id);

  const before = payment.toObject();
  const oldIds = payment.allocations.map((a) => String(a.invoiceId));

  payment.date = data.date;
  payment.amount = data.amount;
  payment.allocations = data.allocations || [];
  payment.notes = data.notes || '';
  await payment.save();

  await Transaction.updateOne(
    { paymentId: payment._id },
    { $set: { date: payment.date, notes: payment.notes, ...sideFields(payment.kind, payment.amount) } }
  );

  const ids = new Set([...oldIds, ...payment.allocations.map((a) => String(a.invoiceId))]);
  for (const invId of ids) await recalcInvoice(invId);

  logAudit('update', 'Payment', payment._id, before, payment);
  return payment;
}

export async function deletePayment(id) {
  const payment = await Payment.findById(id);
  if (!payment) throw new HttpError(404, 'Payment not found');
  const ids = payment.allocations.map((a) => String(a.invoiceId));

  await Transaction.deleteMany({ paymentId: payment._id });
  await payment.deleteOne();
  for (const invId of ids) await recalcInvoice(invId);

  logAudit('delete', 'Payment', payment._id, payment, null);
}