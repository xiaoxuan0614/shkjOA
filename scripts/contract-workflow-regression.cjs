const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const sfc = require('@vue/compiler-sfc');
const transpile = (source) => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
function load(file, mocks = {}) {
  const ctx = { exports: {}, require: (id) => { if (id in mocks) return mocks[id]; throw Error('Unexpected dependency: ' + id); } };
  vm.runInNewContext(transpile(fs.readFileSync(file, 'utf8')), ctx);
  return ctx.exports;
}
const metadata = load('src/views/workflow/businessMetadata.ts');
const fields = [{ key: 'contractAmount', name: '项目金额', type: 'number' }, { key: 'paymentPlan', name: '回款计划', type: 'string' }];
const catalog = { businessType: 'PROJECT_CONTRACT', fields, conditionFields: ['contractAmount'] };
const definition = { businessType: 'PROJECT_CONTRACT', nodes: [{ fieldPermissions: { paymentPlan: 'READ_ONLY' } }], policy: { starters: null } };
assert.equal(metadata.validateBusinessDefinition(definition, catalog).length, 0);
assert.equal(metadata.validateBusinessDefinition(definition).length, 1);
assert.ok(metadata.validateBusinessDefinition({ ...definition, policy: { fields: { contractAmount: 'EDITABLE' } } }, catalog).length);
assert.ok(metadata.validateBusinessDefinition({ ...definition, stages: [{ condition: { children: [{ conditions: [{ field: 'paymentPlan' }] }] } }] }, catalog).length);
assert.ok(metadata.validateBusinessDefinition({ ...definition, nodes: [{ options: { predicate: { conditions: [{ field: 'unknown' }] } } }] }, catalog).length);
const route = load('src/router/helper/quotationDetailRoute.ts');
assert.equal(route.needsWorkflowApplicationsRoute([]), true);
assert.equal(route.needsWorkflowApplicationsRoute([{ path: '/workflow', children: [{ path: 'applications' }] }]), false);
assert.equal(route.needsWorkflowApplicationsRoute([{ path: '/workflow/applications' }]), false);

const page = fs.readFileSync('src/views/project/contract/index.vue', 'utf8');
const script = sfc.parse(page).descriptor.scriptSetup.content;
const ast = ts.createSourceFile('contract.ts', script, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const declarations = new Map();
for (const st of ast.statements) if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) declarations.set(d.name.getText(ast), d.initializer?.getText(ast));
function policy(info, userId = 'owner', initiator = 'owner') {
  const ctx = { info: { value: info }, defaultUser: { value: { id: userId } }, businessActions: { value: info.workflowInstanceId ? { canResubmit: userId === 'owner' && !!initiator && ['REJECTED', 'WITHDRAWN'].includes(info.workflowStatus) } : null },
    isCurrentContractSubmitter: { value: userId === 'owner' }, isContractRevisable: { value: [0, 3, -1].includes(info.status) },
    isApprovalPending: (v) => v === 2, hasPermission: () => true, computed: (fn) => ({ get value() { return fn(); } }) };
  vm.createContext(ctx);
  for (const name of ['workflowInstanceId', 'isWorkflowContract', 'canEditContract', 'canWithdrawContract', 'canAuditContract']) {
    vm.runInContext(transpile(`var ${name} = ${declarations.get(name)};`), ctx);
  }
  return ctx;
}
for (const status of ['RUNNING', 'APPROVED', 'UNKNOWN', undefined]) {
  const p = policy({ workflowInstanceId: 'instance', workflowStatus: status, status: 0 });
  assert.equal(p.canEditContract.value, false);
  assert.equal(p.canWithdrawContract.value, false);
  assert.equal(p.canAuditContract.value, false);
}
for (const status of ['REJECTED', 'WITHDRAWN']) {
  assert.equal(policy({ workflowInstanceId: 'i', workflowStatus: status }).canEditContract.value, true);
  assert.equal(policy({ workflowInstanceId: 'i', workflowStatus: status }, 'other').canEditContract.value, false);
  assert.equal(policy({ workflowInstanceId: 'i', workflowStatus: status }, 'owner', '').canEditContract.value, false);
}
assert.equal(policy({ status: 2 }).canAuditContract.value, true);
assert.equal(policy({ status: 2 }).canWithdrawContract.value, true);
assert.equal(policy({ status: 0 }).canEditContract.value, true);

(async () => {
  let response;
  const calls = [];
  const api = load('src/views/payment/Payment.api.ts', {
    '/@/utils/http/axios': { defHttp: { get: async (...args) => { calls.push(args); return response; }, post: async (...args) => { calls.push(args); return response; } } },
    '/@/enums/httpEnum': { ContentTypeEnum: { JSON: 'application/json' } },
  });
  for (const success of [false, undefined]) {
    response = { success, code: 200, result: { contract: { id: 'c' } } };
    await assert.rejects(api.addContractWithPaymentRecords({}));
    await assert.rejects(api.contractDetailByPeriodId('p'));
  }
  response = { success: true, code: 500, result: { contract: { id: 'c' } } };
  await assert.rejects(api.editContractWithPaymentRecords({}));
  for (const code of [0, 200]) {
    response = { success: true, code, result: { contract: { id: 'c', status: 2 }, workflowInstanceId: 'new-round', workflowStatus: 'RUNNING', records: [] } };
    assert.equal((await api.contractDetailByPeriodId('p')).workflowInstanceId, 'new-round');
    assert.equal((await api.editContractWithPaymentRecords({ contract: { periodId: 'p' }, records: [] })).workflowInstanceId, 'new-round');
  }
  response = { success: true, code: 200, result: {} };
  await assert.rejects(api.editContractWithPaymentRecords({}));
  assert.ok(calls.every(([, opts]) => opts.isTransformResponse === false));
  const starter = load('src/views/workflow/starterScope.ts');
  const wf = load('src/views/workflow/Workflow.api.ts', { './starterScope': starter, '/@/utils/http/axios': {} });
  const normalized = wf.normalizeDefinition({ ...definition, formFields: fields });
  assert.equal(normalized.formFields, undefined);
  assert.equal(normalized.policy.starters, null);
  for (const file of [
    'src/views/project/contract/index.vue', 'src/views/workflow/components/WorkflowEditor.vue',
    'src/views/workflow/components/InstanceDrawer.vue', 'src/views/workflow/components/BusinessSnapshotValue.vue',
    'src/views/workflow/designer/FieldPermissions.vue', 'src/views/workflow/designer/FlowSettings.vue',
    'src/views/workflow/index.vue', 'src/views/workflow/applications.vue',
  ]) {
    const { descriptor, errors } = sfc.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(errors.length, 0, file);
    const script = sfc.compileScript(descriptor, { id: file });
    const template = sfc.compileTemplate({ id: file, source: descriptor.template.content, filename: file, compilerOptions: { bindingMetadata: script.bindings } });
    assert.equal(template.errors.length, 0, file);
  }
  console.log('PASS contract workflow: legacy/bound guards, initiator isolation, metadata conditions/permissions, no custom snapshot, response envelopes, route fallback and 8 SFCs');
})().catch((e) => { console.error(e); process.exitCode = 1; });
