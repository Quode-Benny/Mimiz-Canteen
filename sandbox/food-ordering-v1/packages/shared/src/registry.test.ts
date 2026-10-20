import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveProvider } from './registry.ts';
test('provider registry resolves configured adapter behind a shared interface', () => { const mock = { mode: 'mock' as const, initialize: async () => ({ reference: 'demo' }) }; const live = { mode: 'live' as const, initialize: async () => ({ reference: 'paystack' }) }; const selected = resolveProvider('mock', { mock, paystack: live }); assert.equal(selected, mock); });
test('provider registry fails closed when adapter missing', () => { assert.throws(() => resolveProvider('mock', {} as Record<'mock', object>), /No adapter registered/); });
