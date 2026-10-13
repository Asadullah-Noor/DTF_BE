import Transaction from '../models/Transaction.js';
import { computeBalance, balanceLabel, buildStatement } from './balance.js';

// Sab parties ka total debit/credit ek hi query mein
export async function getBalanceMap() {
  const rows = await Transaction.aggregate([
    { $match: { partyId: { $ne: null } } },
    { $group: { _id: '$partyId', debit: { $sum: '$debit' }, credit: { $sum: '$credit' } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r]));
}

export function withBalance(party, map) {
  const t = map.get(String(party._id)) || { debit: 0, credit: 0 };
  const balance = computeBalance(party.openingBalance, [t]);
  return {
    ...party,
    totalDebit: t.debit,
    totalCredit: t.credit,
    balance,
    balanceLabel: balanceLabel(balance),
  };
}

// from/to optional. from se pehle ki entries opening balance mein jama hoti hain.
export async function getStatement(party, { from, to } = {}) {
  const all = await Transaction.find({ partyId: party._id }).sort({ date: 1, createdAt: 1 }).lean();
  const end = to ? new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1) : null;

  const before = from ? all.filter((t) => t.date < from) : [];
  const inRange = all.filter((t) => (!from || t.date >= from) && (!end || t.date <= end));

  const opening = computeBalance(party.openingBalance, before);
  return {
    party: { _id: party._id, name: party.name, type: party.type, phone: party.phone, address: party.address },
    from: from || null,
    to: to || null,
    ...buildStatement(opening, inRange),
  };
}