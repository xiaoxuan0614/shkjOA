const fs = require('node:fs'), assert = require('node:assert/strict'), ts = require('typescript');
const { parse } = require('@vue/compiler-sfc');
const source = fs.readFileSync('src/views/project/contract/index.vue', 'utf8');
const ast = ts.createSourceFile('contract.ts', parse(source).descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true);
const fn = name => ts.transpile(ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name).getText(ast));
const ref = value => ({ value });
const state = { readonly: ref(true), editing: ref(true), info: ref({ materialSnapshot: { records: [{ materialName: '旧合同' }] } }),
  quotationPreviewData: ref(null), quotationPreviewError: ref(''), quotationPreviewOpen: ref(false), quotationPreviewLoading: ref(false),
  materialCandidateId: ref('quote'), quotationVersionChoice: ref('draft'), submitting: ref(false), quotationSaving: ref(false),
  candidatesFailed: ref(false), selectedCandidate: ref({ id: 'quote', candidateName: '原报价', version: 1 }),
  selectedQuotationAccess: ref({ canViewQuote: true }) };
let draft = { items: [{ materialName: '最新物料', quantity: 9, remark: '最新备注' }], serviceFees: [{ name: '新增服务', quantity: 3 }] };
let originalReads = 0, candidateReads = 0;
const deps = { ...state, loadContractCandidates: async () => { candidateReads++; }, requireQuotationDraft: () => draft,
  getAllMaterialCandidateItems: async (_id, callback) => { originalReads++; callback([{ name: '原服务' }]); return [{ materialName: '原物料' }]; } };
const api = new Function(...Object.keys(deps), 'let quotationPreviewSequence = 0;\n' + fn('closeQuotationPreview') + fn('openQuotationPreview') + ';return { openQuotationPreview };')(...Object.values(deps));
(async () => {
  await api.openQuotationPreview();
  assert.equal(state.quotationPreviewData.value.items[0].quantity, 9);
  assert.equal(state.quotationPreviewData.value.serviceFees[0].name, '新增服务');
  assert.equal(originalReads, 0, 'draft must not reload original details');
  draft = { items: [{ materialName: '第二次调整', quantity: 12 }], serviceFees: [] };
  await api.openQuotationPreview();
  assert.equal(state.quotationPreviewData.value.items[0].quantity, 12);
  assert.deepEqual(state.quotationPreviewData.value.serviceFees, []);
  state.quotationVersionChoice.value = 'original';
  await api.openQuotationPreview();
  assert.equal(state.quotationPreviewData.value.items[0].materialName, '原物料');
  assert.equal(originalReads, 1);
  state.editing.value = false;
  const before = candidateReads;
  await api.openQuotationPreview();
  assert.equal(state.quotationPreviewData.value, state.info.value.materialSnapshot);
  assert.equal(candidateReads, before, 'view mode only uses frozen contract snapshot');
  assert(source.includes('v-else-if="readonly && !editing"'));
  assert(source.includes('watch([materialCandidateId, quotationVersionChoice, editing], closeQuotationPreview)'));
  console.log('PASS contract preview selection: edit draft/latest re-save/service deletion/original/frozen view');
})().catch(error => { console.error(error); process.exitCode = 1; });
