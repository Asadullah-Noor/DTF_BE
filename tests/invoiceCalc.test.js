import test from 'node:test';
import assert from 'node:assert/strict';
import { computeTotals } from '../src/services/invoiceCalc.js';

test('amount = qty * rate, total = subtotal - discount', () => {
  const t = computeTotals(
    [
      { description: 'Logo', qty: 2.5, rate: 40000 },
      { description: 'Design', qty: 1, rate: 50000 },
    ],
    10000
  );
  assert.equal(t.items[0].amount, 100000);
  assert.equal(t.subtotal, 150000);
  assert.equal(t.total, 140000);
});

test('amounts are always whole paisa', () => {
  const t = computeTotals([{ description: 'x', qty: 0.333, rate: 1000 }]);
  assert.equal(Number.isInteger(t.total), true);
});

test('discount larger than subtotal is rejected', () => {
  assert.throws(() => computeTotals([{ description: 'x', qty: 1, rate: 1000 }], 2000), /Discount/);
});
