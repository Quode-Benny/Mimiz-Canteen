import type { Role } from './index.ts';
export interface StaffActor { userId: string; role: Exclude<Role, 'customer'>; branchId: string | null }
/** Apply to every branch-scoped query and mutation on the server. */
export function canAccessBranch(actor: StaffActor, branchId: string): boolean {
  if (actor.role === 'super_admin') return true;
  if (actor.role === 'support_agent' && actor.branchId === null) return true;
  return actor.branchId === branchId;
}
export function assertBranchAccess(actor: StaffActor, branchId: string): void { if (!canAccessBranch(actor, branchId)) { const error = new Error('You are not allowed to access this branch.'); Object.assign(error, { code: 'FORBIDDEN', status: 403 }); throw error; } }
export function canEditBranchPrice(actor: StaffActor): boolean { return actor.role === 'super_admin'; }
