import test from 'node:test';
import assert from 'node:assert/strict';
import { computeBalance, buildStatement, balanceLabel } from '../src/services/balance.js';

test('client: invoice - payment = what they owe', () => {
  const b = computeBalance(0, [{ debit: 25000 }, { credit: 10000 }]);
  assert.equal(b, 15000);
  assert.equal(balanceLabel(b), 'You will receive');
});

test('supplier: purchase - payment = negative (you will pay)', () => {
  const b = computeBalance(0, [{ credit: 60000 }, { debit: 30000 }]);
  assert.equal(b, -30000);
  assert.equal(balanceLabel(b), 'You will pay');
});

test('opening balance is included', () => {
  assert.equal(computeBalance(500000, [{ debit: 1200000 }, { credit: 1200000 }]), 500000);
});

test('no transactions returns opening balance', () => {
  assert.equal(computeBalance(0, []), 0);
  assert.equal(computeBalance(undefined, undefined), 0);
});

test('settled label when balance is zero', () => {
  assert.equal(balanceLabel(0), 'Settled');
});

test('statement has running balance in date order', () => {
  const st = buildStatement(1000, [
    { date: '2026-09-10', credit: 300 },
    { date: '2026-09-01', debit: 500 },
  ]);
  assert.deepEqual(st.rows.map((r) => r.balance), [1500, 1200]);
  assert.equal(st.closingBalance, 1200);
  assert.equal(st.totalDebit, 500);
  assert.equal(st.totalCredit, 300);
});