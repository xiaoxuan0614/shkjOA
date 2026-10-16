const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const sfc = require('@vue/compiler-sfc');
const source = fs.readFileSync('src/views/project/contract/index.vue', 'utf8');
const ast = ts.createSourceFile('contract.ts', sfc.parse(source).descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true);
const fn = name => ts.transpile(ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name).getText(ast));
const ref = value => ({ value });
function loadTs(file) {
  const module = { exports: {} };
  const path = require('node:path');
  new Function('module', 'exports', 'require', ts.transpile(fs.readFileSync(file, 'utf8'), { module: ts.ModuleKind.CommonJS }))(
    module, module.exports, name => name.startsWith('/@/') ? loadTs('src/' + name.slice(3) + '.ts')
      : name.startsWith('.') ? loadTs(path.resolve(path.dirname(file), name) + '.ts') : require(name));
  return module.exports;
}
const { contractServiceFeePayload, contractServiceFeeRows } = loadTs('src/views/project/contract/quotationServiceFees.ts');
const fees = [{ id: 'fee-row', serviceFeeId: 'fee-source', name: 'original-fee', unit: '项', quantity: 1, guidePrice: 5 },
  { serviceFeeId: 'new-source', name: '新增服务', unit: '次', quantity: 2, costPrice: 10, guidePrice: 12, markupRate: 20, remark: '' }];
assert.equal(contractServiceFeeRows(fees)[1].guidePrice, null);
const feePayload = contractServiceFeePayload(fees);
assert.equal(feePayload[1].serviceFeeId, 'new-source');
assert.equal(feePayload[1].id, undefined);
for (const row of feePayload) for (const key of ['costPrice', 'guidePrice', 'markupRate', 'guideAmount', '_key']) assert.equal(row[key], undefined);
assert.throws(() => contractServiceFeePayload([{ ...fees[1], quantity: 0 }]), /数量/);
assert.throws(() => contractServiceFeePayload([{ ...fees[1], unit: '' }]), /单位/);
assert.throws(() => contractServiceFeePayload([{ ...fees[1], serviceFeeId: undefined }]), /基础库/);
const state = { quotationDraft: ref(), quotationVersionChoice: ref('original'), materialCandidateId: ref('c'), selectedCandidate: ref({ version: 2 }),
  quotationEditing: ref(true), quotationSaving: ref(false), quotationOpen: ref(true), quotationSnapshot: ref({ candidateName: '原单', version: 2 }), candidatesFailed: ref(false), canAdjustQuotation: ref(true) };
let payload, result = { draftToken: 'token-1', draftExpiresIn: 1800, serviceFees: [{ name: 'must-not-use-response' }] };
const rows = [{ id: 'row', materialId: 'm', plannedQty: 3, finalPrice: 8, _unitValue: 'unit', _unitOptions: [{ value: 'unit', label: '个' }] }];
const errors = [];
const deps = { ...state, quotationLifecycle: 0,
  quotationServiceFees: ref(fees), quotationFeesReady: ref(true), contractServiceFeePayload,
  quotationTable: ref({ getData: () => [{ id: 'row', materialId: 'm', quantity: 3, unitId: 'unit' }], getRows: () => rows }),
  loadContractCandidates: async () => {}, refreshSelectedQuotationAccess: async () => {}, assertQuotationVersion: () => {},
  getAllMaterialCandidateItems: async (_id, callback) => { callback([{ name: 'original-fee', guidePrice: 5, quantity: 1 }]); return []; },
  reviseMaterialCandidate: async value => { payload = value; return result; }, closeQuotationPreview: () => {},
  createMessage: { success() {}, info() {}, error(message) { errors.push(message); } } };
const api = new Function(...Object.keys(deps), fn('requireQuotationDraft') + fn('saveQuotation') + '\nreturn { requireQuotationDraft, saveQuotation };')(...Object.values(deps));
(async () => {
  await api.saveQuotation();
  assert.equal(state.quotationVersionChoice.value, 'draft');
  assert.equal(state.quotationDraft.value.token, 'token-1');
  assert.equal(state.quotationDraft.value.items[0].quantity, 3);
  assert.equal(state.quotationDraft.value.items[0].unit, '个');
  assert.equal(state.quotationDraft.value.serviceFees[0].name, 'original-fee');
  assert.equal(payload.draftToken, undefined);
  assert.deepEqual(payload.serviceFees, feePayload);
  assert.equal(state.quotationDraft.value.serviceFees.length, 2);
  state.quotationVersionChoice.value = 'original';
  assert.equal(state.quotationDraft.value.token, 'token-1', 'switching to original preserves draft');
  result = { draftToken: 'token-2', draftExpiresIn: 900 };
  await api.saveQuotation();
  assert.equal(payload.draftToken, 'token-1');
  assert.equal(state.quotationDraft.value.token, 'token-2');
  // Reopening restores adjusted service snapshots rather than the original API list.
  const reopened = ref([]), ready = ref(false);
  new Function('quotationServiceFees', 'quotationFeesReady', 'quotationDraft', 'contractServiceFeeRows', fn('receiveQuotationServiceFees') + ';receiveQuotationServiceFees([]);')(
    reopened, ready, state.quotationDraft, contractServiceFeeRows);
  assert.equal(reopened.value[1].serviceFeeId, 'new-source');
  assert.equal(ready.value, true);
  deps.quotationServiceFees.value = [];
  await api.saveQuotation();
  assert.deepEqual(payload.serviceFees, [], 'removing all fees sends explicit empty list');
  deps.quotationServiceFees.value = fees;
  state.selectedCandidate.value.version = 3;
  assert.throws(api.requireQuotationDraft, /版本已变化/);
  state.selectedCandidate.value.version = 2;
  state.quotationDraft.value.expiresAt = 0;
  assert.throws(api.requireQuotationDraft, /已失效/);
  await api.saveQuotation();
  assert.equal(state.quotationDraft.value.token, 'token-2', 'failure must not replace draft or fall back');
  assert.equal(state.quotationVersionChoice.value, 'draft');
  assert.equal(state.quotationSaving.value, false);
  assert.equal(errors.length, 1);
  const submit = fn('handleSubmit');
  assert(submit.includes("quotationVersionChoice.value === 'draft' ? requireQuotationDraft() : undefined"));
  assert(submit.includes('materialCandidateDraftToken: selectedDraft.token'));
  assert(!submit.includes('合同修改接口暂不支持调整稿'));
  // Execute the actual edit request expression to check outer-body token placement and omission.
  let editCall;
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'editContractWithPaymentRecords'
      && node.arguments[0]?.getText(ast).includes('requestedCandidateId')) editCall = node;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert(editCall);
  const makeEditPayload = new Function('selectedDraft', 'requestedCandidateId', 'values', 'contractAttachments', 'buildChangedContract', 'buildPaybackRecords',
    ts.transpile('const payload = ' + editCall.arguments[0].getText(ast) + ';') + '\nreturn payload;');
  const args = [{ contractAmount: 10 }, ref([{ fileId: 'path' }]), () => ({ periodId: 'period' }), () => []];
  const adjusted = makeEditPayload({ token: 'edit-token' }, 'candidate', ...args);
  assert.equal(adjusted.materialCandidateDraftToken, 'edit-token');
  assert.equal(adjusted.materialCandidateId, 'candidate');
  assert.equal(adjusted.contract.materialCandidateDraftToken, undefined);
  assert(!('materialCandidateDraftToken' in makeEditPayload(undefined, 'candidate', ...args)));
  assert(!('materialCandidateId' in makeEditPayload(undefined, undefined, ...args)));
  const session = source.slice(source.indexOf('const contractDraft = useSessionDraft'), source.indexOf('async function restoreContractDraft'));
  assert(!session.includes('quotationDraft'));
  assert(!session.includes('draftToken'));
  assert(source.includes('onDeactivated(() => { quotationLifecycle++'));
  assert(source.includes('onBeforeUnmount(() => { quotationLifecycle++'));
  assert(source.includes('createConfirm({ title: \'更换原报价单\''));
  assert(!source.includes('解锁报价</a-button>'));
  console.log('PASS contract quotation drafts: original/draft, continued tokens, preview snapshot, expiry/version guard and no persistence');
})().catch(error => { console.error(error); process.exitCode = 1; });
