import test from 'node:test';
import assert from 'node:assert/strict';
import { computeInvoiceStatus, remaining } from '../src/services/invoiceStatus.js';

test('pending when nothing paid', () => {
  assert.equal(computeInvoiceStatus(0, 10000), 'pending');
  assert.equal(computeInvoiceStatus(undefined, 10000), 'pending');
});

test('partial when some paid', () => {
  assert.equal(computeInvoiceStatus(4000, 10000), 'partial_paid');
});

test('paid when fully paid', () => {
  assert.equal(computeInvoiceStatus(10000, 10000), 'paid');
});

test('remaining never goes below zero', () => {
  assert.equal(remaining(10000, 4000), 6000);
  assert.equal(remaining(10000, 12000), 0);
});