import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMonth } from '../src/services/reportService.js';

test('parses YYYY-MM', () => {
  assert.deepEqual(parseMonth('2026-09'), { y: 2026, m: 8 });
});

test('bad input falls back to current month', () => {
  const now = new Date();
  assert.deepEqual(parseMonth('abc'), { y: now.getUTCFullYear(), m: now.getUTCMonth() });
  assert.deepEqual(parseMonth('2026-13'), { y: now.getUTCFullYear(), m: now.getUTCMonth() });
});