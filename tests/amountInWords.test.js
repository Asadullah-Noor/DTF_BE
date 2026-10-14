import test from 'node:test';
import assert from 'node:assert/strict';
import { amountInWords } from '../src/utils/amountInWords.js';

test('simple amounts', () => {
  assert.equal(amountInWords(200000), 'Rupees Two Thousand Only');
  assert.equal(amountInWords(150000), 'Rupees One Thousand Five Hundred Only');
});

test('lakh and crore system', () => {
  assert.equal(amountInWords(12345000), 'Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Only');
  assert.equal(amountInWords(1000000000), 'Rupees One Crore Only');
});

test('paisa and zero', () => {
  assert.equal(amountInWords(10050), 'Rupees One Hundred and Fifty Paisa Only');
  assert.equal(amountInWords(0), 'Zero Rupees Only');
});