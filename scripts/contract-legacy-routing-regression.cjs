const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { parse } = require('@vue/compiler-sfc');
const text = fs.readFileSync('src/views/project/contract/index.vue', 'utf8');
const ast = ts.createSourceFile('contract.ts', parse(text).descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true);
const body = name => ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name).getText(ast);
assert(!body('initializeContract').includes('await resolveApproval()'));
assert(body('handleApprove').includes('projectManagerUserId: projectManagerUserId.value'));
assert(body('handleApprove').includes("status: '1'"));
assert(body('handleReject').includes("status: '0'"));
assert(body('handleWithdraw').includes("status: '3'"));
async function load(mode, workflowInstanceId, fail = false) {
  const ref = value => ({ value });
  const state = Object.fromEntries(['businessActions', 'workflowIdentityError', 'contractId', 'approvalInstanceId', 'approvalResolveError', 'contractLoadFailed', 'paybackLoadFailed', 'info', 'materialCandidateId', 'originalContract', 'approvalResult', 'approvalReason', 'projectManagerUserId', 'projectRecord', 'readonly', 'editing', 'userOptions'].map(key => [key, ref('')]));
  Object.assign(state, { pageMode: ref(mode), periodId: ref('period'), projectId: ref('project'), approvalContractId: ref(''), approvalResolving: ref(true) });
  const calls = [];
  const contract = { id: 'contract', periodId: 'period', status: '2', workflowInstanceId, records: [] };
  const deps = { ...state, contractDetailByPeriodId: async () => { if (fail) throw Error('详情失败'); return contract; },
    currentContractApproval: async () => { calls.push('current'); return 'instance'; },
    contractApprovalActions: async () => { calls.push('actions'); return { instanceId: 'instance', canResubmit: true }; },
    resolveApproval: async () => { calls.push('resolve'); state.approvalInstanceId.value = 'instance'; },
    loadContractCandidates: async () => {}, usersLoaded: false, userMap: {},
    readContractProjectContext: () => ({}), window: { history: { state: {} } }, userStore: { getUserInfo: {} },
    loadContractAttachments: async () => {}, setPaybackRows: () => {}, createMessage: { error() {} } };
  await new Function(...Object.keys(deps), ts.transpile(body('loadExistingContract')) + '\nreturn loadExistingContract();')(...Object.values(deps));
  return { state, calls };
}
(async () => {
  for (const mode of ['view', 'edit']) {
    for (const id of [undefined, null, '']) {
      const { state, calls } = await load(mode, id);
      assert.deepEqual(calls, [], 'ordinary contract must not depend on workflow endpoints');
      assert.equal(state.info.value.status, '2');
      assert.equal(state.businessActions.value, null);
      assert.equal(state.approvalResolving.value, false);
    }
  }
  assert.deepEqual((await load('view', 'instance')).calls, ['resolve']);
  assert.deepEqual((await load('edit', 'instance')).calls, ['current', 'actions']);
  const failed = await load('view', undefined, true);
  assert.equal(failed.state.contractLoadFailed.value, true);
  assert.equal(failed.state.editing.value, false);
  assert.equal(failed.state.approvalResolving.value, false);
  console.log('PASS original contract routing: no workflow dependency, historical protection, status actions, manager and read failures');
})().catch(error => { console.error(error); process.exitCode = 1; });
