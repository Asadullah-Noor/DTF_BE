import Invoice from '../models/Invoice.js';
import Party from '../models/Party.js';
import Transaction from '../models/Transaction.js';
import { nextInvoiceNumber } from '../models/Counter.js';
import { HttpError } from '../utils/HttpError.js';
import { computeTotals } from './invoiceCalc.js';
import { logAudit } from './audit.js';

async function assertClient(id) {
  const p = await Party.findById(id);
  if (!p) throw new HttpError(404, 'Client not found');
  if (p.type !== 'client') throw new HttpError(400, 'Invoices can only be made for clients');
  return p;
}

function totalsOrThrow(d) {
  const t = computeTotals(d.items, d.discount || 0);
  if (t.total <= 0) throw new HttpError(400, 'Invoice total must be greater than 0');
  return t;
}

export async function createInvoice(d) {
  await assertClient(d.clientId);
  const t = totalsOrThrow(d);

  const invoice = await Invoice.create({
    number: await nextInvoiceNumber(),
    clientId: d.clientId,
    issueDate: d.issueDate,
    dueDate: d.dueDate || undefined,
    ...t,
    paidAmount: 0,
    notes: d.notes || '',
  });

  try {
    await Transaction.create({
      date: invoice.issueDate,
      partyId: invoice.clientId,
      kind: 'invoice',
      debit: invoice.total,
      invoiceId: invoice._id,
      refNo: invoice.number,
    });
  } catch (e) {
    await invoice.deleteOne();
    throw e;
  }

  logAudit('create', 'Invoice', invoice._id, null, invoice);
  return invoice;
}

export async function updateInvoice(id, d) {
  const invoice = await Invoice.findById(id);
  if (!invoice) throw new HttpError(404, 'Invoice not found');

  if (String(d.clientId) !== String(invoice.clientId)) {
    if (invoice.paidAmount > 0) {
      throw new HttpError(400, 'Cannot change the client: payments are already recorded on this invoice');
    }
    await assertClient(d.clientId);
  }

  const t = totalsOrThrow(d);
  if (t.total < invoice.paidAmount) {
    throw new HttpError(400, 'Total cannot be less than the amount already received');
  }

  const before = invoice.toObject();
  invoice.set({
    clientId: d.clientId,
    issueDate: d.issueDate,
    dueDate: d.dueDate || undefined,
    ...t,
    notes: d.notes || '',
  });
  await invoice.save(); // status yahin auto-calculate hota hai

  await Transaction.updateOne(
    { invoiceId: invoice._id },
    {
      $set: {
        date: invoice.issueDate,
        partyId: invoice.clientId,
        debit: invoice.total,
        credit: 0,
        refNo: invoice.number,
      },
      $setOnInsert: { kind: 'invoice' },
    },
    { upsert: true }
  );

  logAudit('update', 'Invoice', invoice._id, before, invoice);
  return invoice;
}

export async function deleteInvoice(id) {
  const invoice = await Invoice.findById(id);
  if (!invoice) throw new HttpError(404, 'Invoice not found');
  if (invoice.paidAmount > 0) {
    throw new HttpError(400, 'Payments are linked to this invoice. Edit or delete those payments first.');
  }
  await Transaction.deleteMany({ invoiceId: invoice._id });
  await invoice.deleteOne();
  logAudit('delete', 'Invoice', invoice._id, invoice, null);
}