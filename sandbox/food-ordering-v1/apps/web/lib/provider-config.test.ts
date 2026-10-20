import test from 'node:test';
import assert from 'node:assert/strict';
import { assertProviderProductionSafety, isOnlinePaymentAvailable, type ProviderConfig } from './provider-config.ts';
const demo: ProviderConfig = { payment: 'mock', sms: 'console', email: 'console', maps: 'osm', storage: 'local', errors: 'log' };
test('production rejects simulated payment and console messaging by default', () => { assert.throws(() => assertProviderProductionSafety({ NODE_ENV: 'production' }, demo), /Production startup blocked/); });
test('explicit soft-launch opt-in allows startup but hides online checkout', () => { const env = { NODE_ENV: 'production', ALLOW_MOCK_IN_PRODUCTION: 'true' }; assert.doesNotThrow(() => assertProviderProductionSafety(env, demo)); assert.equal(isOnlinePaymentAvailable(env, demo), false); });
test('development can use demo adapters', () => { assert.doesNotThrow(() => assertProviderProductionSafety({ NODE_ENV: 'development' }, demo)); assert.equal(isOnlinePaymentAvailable({ NODE_ENV: 'development' }, demo), true); });
