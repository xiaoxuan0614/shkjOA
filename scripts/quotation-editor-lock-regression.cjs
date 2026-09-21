const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function evaluate(source, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText,
    { exports, defineOptions() {}, require: id => mocks[id] || {} });
  return exports;
}
const governance = evaluate(fs.readFileSync('src/views/plan/quotationGovernance.ts', 'utf8'));
const source = fs.readFileSync('src/views/plan/material-draft/editor.vue', 'utf8').match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1];
async function scenario(mode) {
  const route = { path: '/plan/material-draft/editor', query: { mode, periodId: 'p', ...(mode === 'create' ? {} : { candidateId: 'c', version: '0', status: '-1', adopted: '0', candidateName: '报价', createBy: 'owner' }) }, params: {} };
  let current = { id: 'c', version: 0, status: '-1', adopted: 0, candidateName: '报价', createBy: 'owner' };
  const calls = [];
  let failRead = false;
  const api = {
    getQuotationAccess: async () => governance.normalizeQuotationAccess({ canManage: true }),
    getCandidateRecord: async () => { if (failRead) throw Error('read failed'); return { ...current }; },
    addMaterialCandidate: async () => { calls.push('add'); return { ...current }; },
    editMaterialCandidateItems: async payload => { assert.equal(payload.version, current.version); calls.push('editBatch'); current.version++; },
    candidateAction: async (action, record) => { assert.equal(record.version, current.version); calls.push(action); current = { ...current, version: current.version + 1, status: '2' }; },
  };
  const app = evaluate(source + '\nexport {reload, save, submit, unlockEditing, editing, canUnlock, canModify, canSubmitSaved, tableRef, candidateName, loaded, record};', {
    vue: { ref: value => ({ value }), computed: getter => ({ get value() { return getter(); } }), onMounted() {} },
    'vue-router': { useRoute: () => route, useRouter: () => ({ replace: async target => { route.query = target.query; }, push: () => { throw Error('unexpected navigation away'); } }) },
    '/@/store/modules/user': { useUserStore: () => ({ getUserInfo: { username: 'owner' } }) },
    '/@/hooks/web/usePermission': { usePermission: () => ({ hasPermission: () => true }) },
    '/@/hooks/web/useMessage': { useMessage: () => ({ createMessage: { success() {}, error() {} } }) },
    '/@/views/project/Project.api': { projectDetail: async () => ({ projectName: '项目' }) },
    '../Plan.api': api, '../quotationGovernance': governance,
  });
  app.tableRef.value = { getData: () => [{ materialId: 'm', basePrice: 0 }], reload: async () => {} };
  await app.reload();
  app.candidateName.value = '报价';
  if (mode !== 'create') {
    assert.equal(app.canModify.value, false);
    assert.equal(app.canUnlock.value, true);
    app.unlockEditing();
  }
  assert.equal(app.canModify.value, true);
  assert.equal(app.canSubmitSaved.value, false);
  await app.submit();
  assert.equal(calls.length, 0, 'unsaved edits must not submit');
  await app.save();
  assert.equal(app.editing.value, false);
  assert.equal(app.canModify.value, false);
  assert.equal(app.canSubmitSaved.value, true);
  assert.equal(route.query.mode, 'view');
  assert.equal(route.query.version, 1);
  app.unlockEditing();
  failRead = true;
  await app.save();
  assert.equal(app.loaded.value, false, 'failed post-save refresh must block repeat writes');
  assert.equal(app.canSubmitSaved.value, false);
  failRead = false;
  await app.reload();
  assert.equal(app.record.value.version, 2);
  assert.equal(app.editing.value, false);
  await app.reload();
  assert.equal(app.record.value.version, 2, 'recovery must update the URL version');
  await app.submit();
  assert.equal(app.record.value.status, '2');
  assert.equal(app.canUnlock.value, false);
  assert.equal(app.canSubmitSaved.value, false);
  assert.equal(calls.filter(x => x === 'submit').length, 1);
  assert.equal(calls.filter(x => x === 'add').length, mode === 'create' ? 1 : 0);
}
(async () => {
  await scenario('create');
  await scenario('view');
  await scenario('edit');
  assert.doesNotMatch(fs.readFileSync('src/views/plan/material-draft/index.vue', 'utf8'), /label: '修改'/);
  console.log('Quotation save/read-only/unlock/submit/version-recovery checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
