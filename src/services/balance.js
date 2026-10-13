// balance = openingBalance + sum(debit) - sum(credit)
export function computeBalance(openingBalance = 0, txns = []) {
  return txns.reduce((b, t) => b + (t.debit || 0) - (t.credit || 0), openingBalance || 0);
}

// Positive = aap ko milenge (client), negative = aap ko dene hain (supplier)
export function balanceLabel(balance) {
  if (balance > 0) return 'You will receive';
  if (balance < 0) return 'You will pay';
  return 'Settled';
}

// Bank statement jaisa running balance
export function buildStatement(openingBalance, txns) {
  const sorted = [...txns].sort(
    (a, b) =>
      new Date(a.date) - new Date(b.date) ||
      new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
  );
  let running = openingBalance || 0;
  let totalDebit = 0;
  let totalCredit = 0;
  const rows = sorted.map((t) => {
    totalDebit += t.debit || 0;
    totalCredit += t.credit || 0;
    running += (t.debit || 0) - (t.credit || 0);
    return { ...t, balance: running };
  });
  return {
    openingBalance: openingBalance || 0,
    rows,
    totalDebit,
    totalCredit,
    closingBalance: running,
    closingLabel: balanceLabel(running),
  };
}