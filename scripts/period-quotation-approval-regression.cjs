const fs = require('node:fs'), assert = require('node:assert/strict'), ts = require('typescript');
const sfc = require('@vue/compiler-sfc');
function load(file, mocks = {}) {
  const exports = {};
  new Function('exports', 'require', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(exports, id => {
    if (id in mocks) return mocks[id];
    throw Error(id);
  });
  return exports;
}
const governance = load('src/views/plan/quotationGovernance.ts');
const rules = load('src/views/project/detail/quotationApproval.ts', { '/@/views/plan/quotationGovernance': governance });
const candidate = { id: 'q1', periodId: 'p', status: '2', version: 1, approvalRoute: 'TECHNICAL' };
const tech = code => code === 'plan:quotation:technicalApprove';
const price = code => code === 'plan:quotation:price';
const unpriced = { ...candidate, status: '1', priced: 0 };
assert(rules.canPricePeriodQuotation('NOT_STARTED', 'p', unpriced, { canManage: true }, price));
for (const patch of [{ status: '2' }, { status: '-1' }, { status: '0' }, { status: '4' }, { priced: 1 }, { priced: null }, { approvalRoute: 'MARKET' }, { version: null }, { periodId: 'other' }]) {
  assert(!rules.canPricePeriodQuotation('NOT_STARTED', 'p', { ...unpriced, ...patch }, { canManage: true }, price));
}
assert(!rules.canPricePeriodQuotation('IMPLEMENTING', 'p', unpriced, { canManage: true }, price));
assert(!rules.canPricePeriodQuotation('NOT_STARTED', 'p', unpriced, { canManage: false, canEditPrice: true }, price));
assert(!rules.canPricePeriodQuotation('NOT_STARTED', 'p', unpriced, { canManage: true }, tech));
assert(rules.canApprovePeriodQuotation('NOT_STARTED', 'p', candidate, { canApprove: true }, tech));
for (const status of ['-1', '0', '1', '4']) assert(!rules.canApprovePeriodQuotation('NOT_STARTED', 'p', { ...candidate, status }, { canApprove: true }, tech));
assert(!rules.canApprovePeriodQuotation('IMPLEMENTING', 'p', candidate, { canApprove: true }, tech));
assert(!rules.canApprovePeriodQuotation('NOT_STARTED', 'other', candidate, { canApprove: true }, tech));
assert(!rules.canApprovePeriodQuotation('NOT_STARTED', 'p', candidate, { canApprove: false }, tech));
assert(!rules.canApprovePeriodQuotation('NOT_STARTED', 'p', { ...candidate, approvalRoute: 'MARKET' }, { canApprove: true }, tech));
assert(rules.canApprovePeriodQuotation('NOT_STARTED', 'p', { ...candidate, approvalRoute: 'MARKET' }, { canApprove: true }, code => code === 'plan:quotation:lock'));
const ref = value => ({ value });
const computed = fn => ({ get value() { return fn(); } });
const nav = [], requests = [];
let pending = [candidate], liveStatus = '2', livePriced = 0, permission = tech, canManage = true;
const hook = load('src/views/project/detail/useQuotationApproval.ts', {
  vue: { ref, computed, watch() {}, onBeforeUnmount() {} },
  'vue-router': { useRouter: () => ({ push: async location => nav.push(location) }) },
  '/@/store/modules/user': { useUserStore: () => ({ getIdentity: { userId: 'u' }, getToken: 'test' }) },
  '/@/hooks/web/usePermission': { usePermission: () => ({ hasPermission: code => permission(code) }) },
  '/@/hooks/web/useMessage': { useMessage: () => ({ createMessage: { info() {}, warning() {}, error(message) { throw Error(message); } } }) },
  '/@/views/plan/Plan.api': {
    getMaterialCandidateList: async params => { requests.push(params); return { records: pending, pages: 1 }; },
    getQuotationAccess: async (periodId, candidateId) => { assert.equal(periodId, 'p'); assert(candidateId); return { canApprove: true, canManage }; },
    getCandidateRecord: async (_, id) => ({ ...candidate, id, status: liveStatus, priced: livePriced }),
  },
  './ProjectDetail.api': { getProjectBasic: async () => ({ periodId: 'p', status: 'NOT_STARTED' }) },
  './quotationApproval': rules,
});
(async () => {
  const state = hook.useQuotationApproval(ref('p'), ref({ status: 'NOT_STARTED' }), ref(true));
  await state.handleOpen();
  assert.equal(nav.length, 1); assert.equal(nav[0].query.audit, '1'); assert.equal(nav[0].query.from, 'project-detail');
  assert.equal(requests[0].periodId, 'p'); assert.equal(requests[0].status, '2');
  pending = [candidate, { ...candidate, id: 'q2' }];
  await state.handleOpen(); assert.equal(state.open.value, true); assert.equal(nav.length, 1);
  liveStatus = '1'; await state.enter(candidate); assert.equal(nav.length, 1, '已审批单不能进入');
  pending = []; await state.handleOpen(); assert.equal(state.visible.value, false);
  permission = price; pending = [unpriced];
  const pricing = hook.useQuotationApproval(ref('p'), ref({ status: 'NOT_STARTED' }), ref(true), 'price');
  await pricing.handleOpen(); assert.equal(nav.length, 2);
  assert.equal(nav[1].query.mode, 'price'); assert.equal(nav[1].query.audit, undefined);
  assert.equal(requests.at(-1).status, '1');
  pending = [unpriced, { ...unpriced, id: 'q2' }];
  await pricing.handleOpen(); assert.equal(pricing.open.value, true); assert.equal(nav.length, 2);
  livePriced = 1; await pricing.enter(unpriced); assert.equal(nav.length, 2, '已定价不能再次进入待定价入口');
  canManage = false; await pricing.handleOpen(); assert.equal(pricing.visible.value, false);
  canManage = true; permission = tech; await pricing.handleOpen(); assert.equal(pricing.visible.value, false);
  const file = 'src/views/project/detail/index.vue';
  const { descriptor } = sfc.parse(fs.readFileSync(file, 'utf8'));
  const script = sfc.compileScript(descriptor, { id: file });
  assert.deepEqual(sfc.compileTemplate({ source: descriptor.template.content, id: file, filename: file, compilerOptions: { bindingMetadata: script.bindings } }).errors, []);
  console.log('PASS period quotation approval: stage/route/permission, single/multiple, live recheck, pending-only requests and Vue compilation');
})().catch(error => { console.error(error); process.exitCode = 1; });
