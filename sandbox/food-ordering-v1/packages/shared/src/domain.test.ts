import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransitionOrder, moneyPesewas } from './index.ts';

test('order lifecycle allows valid forward transitions', () => {
  assert.equal(canTransitionOrder('placed', 'accepted'), true);
  assert.equal(canTransitionOrder('ready', 'out_for_delivery'), true);
  assert.equal(canTransitionOrder('ready', 'completed'), true);
});

test('order lifecycle rejects invalid and terminal transitions', () => {
  assert.equal(canTransitionOrder('placed', 'completed'), false);
  assert.equal(canTransitionOrder('completed', 'cancelled'), false);
});

test('money uses non-negative integer pesewas', () => {
  assert.equal(moneyPesewas(1250), 1250);
  assert.throws(() => moneyPesewas(12.5), RangeError);
  assert.throws(() => moneyPesewas(-1), RangeError);
});
