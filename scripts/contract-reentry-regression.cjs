const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const source = fs.readFileSync('src/views/project/contract/index.vue', 'utf8');
const start = source.indexOf('let activatedOnce = false;');
const end = source.indexOf('/** 加载全量用户', start);
const callbackSource = ts.transpile(source.slice(start, end));
function scenario(routeMode, mode, query = {}) {
  const state = { pageMode: { value: mode }, readonly: { value: false }, editing: { value: true },
    approvalInstanceId: { value: 'old-round' }, approvalContractId: { value: '' },
    contractId: { value: 'contract' }, approvalResolveError: { value: 'old-error' }, approvalResolving: { value: false } };
  let activate, reads = 0;
  new Function(...Object.keys(state), 'routeMode', 'route', 'onActivated', 'initializeContract', callbackSource)(
    ...Object.values(state), routeMode, { query }, fn => { activate = fn; }, async () => { reads++; });
  activate(); assert.equal(reads, 0, 'mount must not issue duplicate initialization');
  activate();
  return { ...state, reads };
}
let result = scenario('view', 'edit');
assert.equal(result.reads, 1);
assert.equal(result.pageMode.value, 'view');
assert.equal(result.editing.value, false);
assert.equal(result.readonly.value, true);
assert.equal(result.approvalInstanceId.value, '');
assert.equal(result.approvalContractId.value, 'contract');
assert.equal(result.approvalResolveError.value, '');
for (const mode of ['create', 'edit']) {
  result = scenario(mode, mode);
  assert.equal(result.reads, 0, 'unsaved input survives tab switching');
  assert.equal(result.editing.value, true);
  result = scenario(mode, 'view');
  assert.equal(result.reads, 1, 'successfully submitted form refreshes as view');
}
result = scenario('view', 'view', { instanceId: 'historical-round' });
assert.equal(result.approvalInstanceId.value, 'historical-round');
const success = source.slice(source.indexOf('createMessage.success(wasNewContract'), source.indexOf('function goBack()'));
assert(success.includes("pageMode.value = 'view'"));
assert(success.includes("approvalInstanceId.value = ''"));
assert(success.indexOf("pageMode.value = 'view'") < success.indexOf("await router.push('/project/list')"));
console.log('PASS contract re-entry: cached view reset, latest round resolution, unsaved edit preservation, historical round and submit cleanup');
