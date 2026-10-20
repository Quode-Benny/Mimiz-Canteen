import { assertProviderProductionSafety } from './lib/provider-config';
export async function register() { assertProviderProductionSafety(); }
