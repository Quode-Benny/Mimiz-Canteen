export const roles = ['customer', 'kitchen_staff', 'rider', 'support_agent', 'branch_manager', 'super_admin'] as const;
export type Role = (typeof roles)[number];

export const orderStatuses = ['pending_payment', 'placed', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled', 'rejected'] as const;
export type OrderStatus = (typeof orderStatuses)[number];
export const orderTransitions: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  pending_payment: ['placed', 'cancelled'], placed: ['accepted', 'rejected', 'cancelled'], accepted: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'], ready: ['out_for_delivery', 'completed'], out_for_delivery: ['completed'],
  completed: [], cancelled: [], rejected: [],
};
export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean { return orderTransitions[from].includes(to); }
export type MoneyPesewas = number & { readonly __brand: 'MoneyPesewas' };
export function moneyPesewas(value: number): MoneyPesewas { if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('Money must be a non-negative integer number of pesewas'); return value as MoneyPesewas; }

export * from './providers.ts';
export * from './access-control.ts';
export * from './registry.ts';
