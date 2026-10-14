import Party from '../models/Party.js';
import Invoice from '../models/Invoice.js';
import Expense from '../models/Expense.js';
import { getBalanceMap, withBalance } from './partyService.js';

const monthStart = (y, m) => new Date(Date.UTC(y, m, 1));

// "YYYY-MM" ko (year, monthIndex) mein badalta hai, warna maujooda mahina
export function parseMonth(str) {
  const m = /^(\d{4})-(\d{2})$/.exec(str || '');
  if (m && +m[2] >= 1 && +m[2] <= 12) return { y: +m[1], m: +m[2] - 1 };
  const now = new Date();
  return { y: now.getUTCFullYear(), m: now.getUTCMonth() };
}

async function sumInvoices(from, to) {
  const r = await Invoice.aggregate([
    { $match: { issueDate: { $gte: from, $lt: to } } },
    { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
  ]);
  return { total: r[0]?.total || 0, count: r[0]?.count || 0 };
}

async function sumExpenses(from, to) {
  const r = await Expense.aggregate([
    { $match: { date: { $gte: from, $lt: to } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return r[0]?.total || 0;
}

export async function receivablesAndPayables() {
  const [parties, map] = await Promise.all([Party.find().lean(), getBalanceMap()]);
  const all = parties.map((p) => withBalance(p, map));

  const receivables = all
    .filter((p) => p.type === 'client' && p.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .map((p) => ({ _id: p._id, name: p.name, phone: p.phone, amount: p.balance }));

  const payables = all
    .filter((p) => p.type === 'supplier' && p.balance < 0)
    .sort((a, b) => a.balance - b.balance)
    .map((p) => ({ _id: p._id, name: p.name, phone: p.phone, amount: -p.balance }));

  return {
    receivables,
    payables,
    totalReceivable: receivables.reduce((s, r) => s + r.amount, 0),
    totalPayable: payables.reduce((s, r) => s + r.amount, 0),
  };
}

export async function monthlySummary(monthStr) {
  const { y, m } = parseMonth(monthStr);
  const from = monthStart(y, m);
  const to = monthStart(y, m + 1);

  const [sales, expenses, byCat] = await Promise.all([
    sumInvoices(from, to),
    sumExpenses(from, to),
    Expense.aggregate([
      { $match: { date: { $gte: from, $lt: to } } },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
    ]),
  ]);

  return {
    month: `${y}-${String(m + 1).padStart(2, '0')}`,
    sales: sales.total,
    invoiceCount: sales.count,
    expenses,
    profit: sales.total - expenses,
    expensesByCategory: byCat.map((c) => ({ category: c._id, total: c.total })),
  };
}

// Pichle 6 mahine (maujooda samet): sales vs expenses
export async function sixMonthSeries() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const out = [];
  for (let i = 5; i >= 0; i--) {
    const from = monthStart(y, m - i);
    const to = monthStart(y, m - i + 1);
    const [sales, expenses] = await Promise.all([sumInvoices(from, to), sumExpenses(from, to)]);
    out.push({
      month: from.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
      key: from.toISOString().slice(0, 7),
      sales: sales.total,
      expenses,
    });
  }
  return out;
}

export async function dashboard() {
  const now = new Date();
  const thisM = monthStart(now.getUTCFullYear(), now.getUTCMonth());
  const nextM = monthStart(now.getUTCFullYear(), now.getUTCMonth() + 1);
  const lastM = monthStart(now.getUTCFullYear(), now.getUTCMonth() - 1);

  const [thisSales, lastSales, rp, pending, series, recent] = await Promise.all([
    sumInvoices(thisM, nextM),
    sumInvoices(lastM, thisM),
    receivablesAndPayables(),
    Invoice.aggregate([
      { $match: { status: { $in: ['pending', 'partial_paid'] } } },
      { $group: { _id: null, count: { $sum: 1 }, outstanding: { $sum: { $subtract: ['$total', '$paidAmount'] } } } },
    ]),
    sixMonthSeries(),
    recentEntries(),
  ]);

  const growth = lastSales.total > 0
    ? Math.round(((thisSales.total - lastSales.total) / lastSales.total) * 1000) / 10
    : null;

  return {
    salesThisMonth: thisSales.total,
    salesGrowthPercent: growth, // null = pichle mahine koi sale nahi
    totalReceivable: rp.totalReceivable,
    receivableClients: rp.receivables.length,
    totalPayable: rp.totalPayable,
    payableSuppliers: rp.payables.length,
    pendingInvoices: pending[0]?.count || 0,
    pendingOutstanding: pending[0]?.outstanding || 0,
    series,
    recent,
  };
}

async function recentEntries() {
  const Transaction = (await import('../models/Transaction.js')).default;
  const items = await Transaction.find()
    .sort({ date: -1, createdAt: -1 })
    .limit(8)
    .populate('partyId', 'name')
    .lean();
  return items.map(({ partyId, ...t }) => ({
    _id: t._id,
    date: t.date,
    kind: t.kind,
    debit: t.debit,
    credit: t.credit,
    party: partyId ? partyId.name : null,
    notes: t.notes,
    refNo: t.refNo,
  }));
}