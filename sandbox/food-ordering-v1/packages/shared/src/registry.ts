export type ProviderMap = Readonly<Record<string, unknown>>;
/** Resolve an adapter once at the application boundary; domain services receive only the interface. */
export function resolveProvider<Adapters extends ProviderMap, Key extends keyof Adapters & string>(key: Key, adapters: Adapters): Adapters[Key] { const adapter = adapters[key]; if (!adapter) throw new Error('No adapter registered for provider: '+key); return adapter; }
