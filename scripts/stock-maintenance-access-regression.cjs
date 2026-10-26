const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('src/views/material/record/stockAccess.ts', 'utf8');
let user = { userIdentity: 2, departIds: ['department-a'] };
let login = {};
const permissions = new Set();
const moduleObject = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
  exports: moduleObject.exports,
  require(name) {
    if (name === 'vue') return { reactive: value => value };
    if (name.includes('ProjectDetail.api')) return { getMembers: async () => [] };
    if (name.includes('usePermission')) return { usePermission: () => ({ hasPermission: code => permissions.has(code) }) };
    if (name.includes('modules/user')) return { useUserStore: () => ({ get getUserInfo() { return user; }, get getLoginInfo() { return login; } }) };
    if (name.includes('approvalStatus')) return { APPROVAL_PENDING: '2', APPROVAL_APPROVED: '1', getApprovalStatusMeta: () => ({}) };
    throw new Error(name);
  },
});
const { canApprove, canExecute } = moduleObject.exports.useStockAccess();
const record = { status: '2', applyType: 'OUT', usageType: 'MAINTENANCE', deptId: 'department-a' };
assert.equal(canApprove(record), true, '维修负责人无需菜单审批权限');
assert.equal(canApprove({ ...record, status: '1' }), false);
assert.equal(canApprove({ ...record, deptId: 'other' }), false);
assert.equal(canApprove({ ...record, deptId: '' }), false);
user = { userIdentity: 1, departIds: ['department-a'] };
assert.equal(canApprove(record), false, '普通成员不放行');
user = {};
login = { userInfo: { userIdentity: '2', departIds: 'other, department-a' } };
assert.equal(canApprove(record), true, '兼容登录信息及逗号分隔部门');
assert.equal(canApprove({ ...record, usageType: 'LABOR_PROTECTION' }), false);
permissions.add('mtl:apply:approve');
assert.equal(canApprove({ ...record, usageType: 'LABOR_PROTECTION' }), true);
assert.equal(canApprove({ ...record, usageType: 'PROJECT', periodId: 'p' }), false);
assert.equal(canApprove({ ...record, applyType: 'IN' }), false);
assert.equal(canExecute({ ...record, status: '1', executeStatus: 'PENDING' }), false);
permissions.add('mtl:goods:io');
assert.equal(canApprove({ ...record, applyType: 'IN' }), true);
assert.equal(canExecute({ ...record, status: '1', executeStatus: 'PENDING' }), true);
console.log('PASS stock maintenance access: department head without menu grant; status, department, labor, project and execution gates preserved');
