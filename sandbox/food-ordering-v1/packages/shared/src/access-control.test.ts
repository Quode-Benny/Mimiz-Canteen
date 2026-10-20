import test from 'node:test';
import assert from 'node:assert/strict';
import { assertBranchAccess, canAccessBranch, canEditBranchPrice } from './access-control.ts';
const a = (role: 'kitchen_staff'|'rider'|'support_agent'|'branch_manager'|'super_admin', branchId: string|null) => ({ userId: 'staff-1', role, branchId });
test('branch staff are restricted to their assigned branch', () => { assert.equal(canAccessBranch(a('kitchen_staff','branch-a'),'branch-a'), true); assert.equal(canAccessBranch(a('kitchen_staff','branch-a'),'branch-b'), false); assert.throws(() => assertBranchAccess(a('rider','branch-a'),'branch-b'), { code: 'FORBIDDEN' }); });
test('support can be scoped to one branch or company-wide', () => { assert.equal(canAccessBranch(a('support_agent','branch-a'),'branch-b'), false); assert.equal(canAccessBranch(a('support_agent',null),'branch-b'), true); });
test('only super admins can change catalogue prices', () => { assert.equal(canEditBranchPrice(a('branch_manager','branch-a')), false); assert.equal(canEditBranchPrice(a('super_admin',null)), true); });
