const fs = require('node:fs'), assert = require('node:assert/strict'), ts = require('typescript');
const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc');
const source = fs.readFileSync('src/views/project/periodDetailActions.ts', 'utf8');
const mod = { exports: {} };
new Function('require', 'exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(
  () => ({ isApprovalPending: value => String(value) === '2' }), mod.exports);
const resolve = mod.exports.resolvePeriodDetailActions;
const tabModule = { exports: {} };
new Function('require', 'exports', ts.transpileModule(fs.readFileSync('src/views/project/detail/detailTabs.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText)(() => ({ isApprovalApproved: value => String(value) === '1', isApprovalPendingSubmit: value => !['0','1','2','3'].includes(String(value ?? '')) }), tabModule.exports);
const tabs = tabModule.exports.resolveDetailTabs;
for (const contractStatus of [null, undefined, '', '-1', 'unknown']) {
  assert.deepEqual(tabs({ status: 'NOT_STARTED', contractStatus }), ['basic', 'quotation']);
}
for (const contractStatus of ['0', '1', '2', '3']) {
  assert.deepEqual(tabs({ status: 'NOT_STARTED', contractStatus }), ['basic', 'quotation', 'contract', ...(contractStatus === '1' ? ['payment'] : [])]);
}
assert.deepEqual(tabs({ status: 'PREPARING' }), ['basic', 'quotation', 'contract', 'plan', 'member', 'position', 'file']);
assert.deepEqual(tabs({ status: 'PENDING_APPROVAL' }), tabs({ status: 'PREPARING' }));
for (const status of ['IMPLEMENTING', 'DEBUGGING', 'DEBUG_COMPLETED']) {
  assert.deepEqual(tabs({ status }), ['basic', 'quotation', 'contract', 'plan', 'member', 'position', 'implement', 'file', 'material']);
}
for (const status of ['IMPLEMENT_COMPLETED', 'PENDING_ACCEPT', 'ACCEPTING', 'REWORKING', 'REACCEPTING', 'FAILED', 'WARRANTY', 'COMPLETED']) {
  assert.deepEqual(tabs({ status }), tabModule.exports.DETAIL_TAB_KEYS.filter(key => key !== 'payment'));
}
assert.deepEqual(tabs({ status: 'CLOSED' }), ['basic', 'quotation']);
assert.deepEqual(tabs({ status: 'CLOSED', contractStatus: '1' }, ['plan', 'member']), ['basic', 'quotation', 'contract', 'plan', 'member', 'payment']);
assert.deepEqual(tabs({ status: 'NOT_STARTED' }, ['plan', 'acceptance']), ['basic', 'quotation'], 'history cannot elevate normal stage');
assert.deepEqual(tabs({ status: 'unknown' }), ['basic', 'quotation']);
for (const contractStatus of [undefined, '0', '1', '2', '3']) {
  assert.ok(!tabModule.exports.resolveDetailTabs({ status: 'NOT_STARTED', contractStatus }).includes('plan'));
}
for (const status of ['PREPARING', 'PENDING_APPROVAL', 'IMPLEMENTING', 'COMPLETED']) {
  assert.ok(tabModule.exports.resolveDetailTabs({ status }).includes('plan'));
}
const access = (codes = [], extra = {}) => ({ userId: 'u', admin: false, manager: false, hasPermission: code => codes.includes(code), ...extra });
const project = { periodId: 'p', status: 'NOT_STARTED' };
assert.deepEqual(resolve({}, access()), []);
assert.deepEqual(resolve(project, access([], { userId: '' })), []);
assert.ok(!resolve(project, access()).some(a => a.tab === 'plan'));
assert.ok(!resolve({ ...project, contractStatus: '1' }, access(['project:contract:view'])).some(a => a.key === 'contractView'));
assert.equal(resolve(project, access([], { manager: true })).find(a => a.tab === 'plan').mode, 'edit');
assert.equal(resolve(project, access([], { admin: true })).find(a => a.tab === 'plan').mode, 'edit');
assert.ok(resolve(project, access(['project:contract'])).some(a => a.key === 'contractSign'));
for (const status of ['0', '1', '2', '3', '-1']) {
  assert.ok(!resolve({ ...project, contractStatus: status }, access(['project:contract'])).some(a => a.key === 'contractSign'));
}
assert.ok(resolve({ ...project, contractStatus: '2' }, access(['project:contract:approve'])).some(a => a.key === 'contractAudit'));
assert.ok(!resolve({ ...project, contractStatus: '2' }, access(['project:contract:view'])).some(a => a.key === 'contractAudit'));
assert.ok(!resolve({ ...project, contractStatus: '1' }, access(['project:contract:approve'])).some(a => a.key === 'contractAudit'));
const pending = { ...project, status: 'PENDING_APPROVAL' };
assert.equal(resolve(pending, access(['project:period:approve'])).find(a => a.tab === 'plan').mode, 'audit');
assert.ok(!resolve(pending, access([], { manager: true })).some(a => a.tab === 'plan'));
for (const status of ['IMPLEMENTING', 'CLOSED', 'COMPLETED']) {
  assert.ok(!resolve({ ...project, status }, access([], { admin: true })).some(a => a.tab === 'plan'));
}
for (const file of ['src/views/project/detail/index.vue', 'src/views/project/index.vue', 'src/views/project/plan/ProjectPlan.vue', 'src/views/project/contract/index.vue', 'src/views/todo/components/TodoActionHost.vue']) {
  const { descriptor } = parse(fs.readFileSync(file, 'utf8'));
  const script = compileScript(descriptor, { id: 'regression' });
  const result = compileTemplate({ source: descriptor.template.content, filename: file, id: 'regression', compilerOptions: { bindingMetadata: script.bindings } });
  assert.deepEqual(result.errors, [], file);
}
const list = fs.readFileSync('src/views/project/index.vue', 'utf8');
assert.ok(!list.includes('statusFlow'), 'list no longer owns business operations');
assert.ok(!list.includes('openPlanAuditModal'));
const detail = fs.readFileSync('src/views/project/detail/index.vue', 'utf8');
assert.ok(detail.includes(`v-if="visibleTabs.includes('plan')" key="plan"`));
assert.ok(detail.includes("key !== 'plan' || project.value.status !== 'NOT_STARTED'"), 'cached tabs cannot restore hidden plan');
assert.ok(!detail.includes('changePeriodStatus'), 'detail never sends approvals to generic status API');
assert.ok(detail.includes('sequence !== membershipSequence'));
assert.ok(detail.includes('onActivated'));
assert.ok(detail.includes("from: 'periodDetail'"));
console.log('PASS period detail permission matrix, navigation guards and five Vue SFCs');
