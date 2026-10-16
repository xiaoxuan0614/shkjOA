const fs = require('node:fs'), assert = require('node:assert/strict'), ts = require('typescript');
const ref = value => ({ value });
let manager = true, permission = true, rows = [{ id: 'q', periodId: 'p' }], requests = [], fail = false;
const exportsObject = {};
const mocks = {
  '/@/utils/approvalStatus': (() => { const result = {}; new Function('exports', ts.transpileModule(fs.readFileSync('src/utils/approvalStatus.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(result); return result; })(),
  vue: { ref, computed: fn => ({ get value() { return fn(); } }), watch() {}, onBeforeUnmount() {} },
  '/@/store/modules/user': { useUserStore: () => ({ getIdentity: { userId: 'u' }, getToken: 'test' }) },
  '/@/hooks/web/usePermission': { usePermission: () => ({ hasPermission: code => permission && code === 'plan:quotation:grant' }) },
  '/@/views/plan/Plan.api': {
    getQuotationAccess: async () => { if (fail) throw Error('offline'); return { canManage: manager }; },
    getMaterialCandidateList: async params => { requests.push(params); return { records: rows }; },
  },
};
new Function('exports', 'require', ts.transpileModule(fs.readFileSync('src/views/project/detail/useQuotationGrant.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(exportsObject, id => mocks[id]);
(async () => {
  const ready = ref(true), id = ref('p');
  const contractStatus = ref('2');
  const state = exportsObject.useQuotationGrant(id, ready, contractStatus);
  await state.handleOpen(); assert(state.visible.value); assert(state.open.value);
  assert.deepEqual(requests[0], { periodId: 'p', pageNo: 1, pageSize: 1 });
  for (const status of [1, '1']) {
    contractStatus.value = status; state.open.value = false;
    const previous = requests.length;
    await state.handleOpen(); assert(!state.visible.value); assert(!state.open.value);
    assert.equal(requests.length, previous);
  }
  contractStatus.value = '2';
  state.open.value = false; manager = false; await state.handleOpen(); assert(!state.visible.value); assert(!state.open.value);
  manager = true; rows = []; await state.handleOpen(); assert(!state.visible.value);
  rows = [{ id: 'q', periodId: 'other' }]; await state.handleOpen(); assert(!state.visible.value);
  permission = false; const count = requests.length; await state.handleOpen(); assert.equal(requests.length, count);
  permission = true; fail = true; await state.handleOpen(); assert(state.error.value); assert(state.visible.value); assert(!state.open.value);
  fail = false; rows = [{ id: 'q', periodId: 'p' }]; await state.handleOpen(); assert(state.open.value); assert.equal(state.error.value, '');
  ready.value = false; await state.handleOpen(); assert(!state.visible.value);
  const modal = fs.readFileSync('src/views/plan/material-draft/QuotationGrantModal.vue', 'utf8');
  assert(modal.includes('@confirm="removeGrant(record)"')); assert(!modal.includes('@close="event => removeSelectedGrant'));
  assert(modal.includes(':periodName') === false); assert(modal.includes('periodName ||'));
  console.log('PASS period grant: permissions, quotation existence, fixed scope, empty/error/retry and revoke confirmation');
})().catch(error => { console.error(error); process.exitCode = 1; });
