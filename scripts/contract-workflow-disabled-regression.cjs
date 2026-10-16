const fs = require('node:fs'), ts = require('typescript'), assert = require('node:assert/strict');
const exportsObject = {}; let calls = 0;
new Function('exports', 'require', ts.transpileModule(fs.readFileSync('src/views/project/contract/approval.api.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText)(exportsObject, () => ({ defHttp: { get() { calls++; }, post() { calls++; } } }));
(async () => {
  assert.equal(exportsObject.CONTRACT_WORKFLOW_ENABLED, false);
  for (const invoke of [
    () => exportsObject.currentContractApproval('c'),
    () => exportsObject.contractApprovalActions('c'),
    () => exportsObject.contractApprovalDetail('i'),
    () => exportsObject.contractApprovalAttachment('i', 'a'),
    () => exportsObject.withdrawContractApproval({ contractId: 'c', requestId: 'r', comment: 'x' }),
  ]) await assert.rejects(invoke, /已停用/);
  assert.equal(calls, 0);
  const source = fs.readFileSync('src/views/project/contract/index.vue', 'utf8');
  for (const component of ['InstanceDrawer', 'InstanceRounds']) assert(source.includes(`<${component} v-if="CONTRACT_WORKFLOW_ENABLED"`));
  assert(source.includes('v-if="CONTRACT_WORKFLOW_ENABLED && approvalInstanceId"'));
  assert(source.includes('const hasWorkflowInstance = CONTRACT_WORKFLOW_ENABLED &&'));
  console.log('PASS disabled contract workflow: zero API calls and no workflow component mounts');
})().catch(error => { console.error(error); process.exitCode = 1; });
