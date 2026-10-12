const fs = require('node:fs');
const ts = require('typescript');
const sfc = require('@vue/compiler-sfc');
const assert = require('node:assert/strict');
const moduleExports = {};
new Function('exports', 'require', ts.transpileModule(fs.readFileSync('src/views/project/contract/quotationSnapshotPreview.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText)(moduleExports, require);
const { quotationSnapshotPreview: preview, snapshotMoney, snapshotQuotationHeaders } = moduleExports;
const snapshot = { candidateName: '本轮送审报价', items: [{ materialName: '物料', brand: '品牌', specificationParams: '参数', quantity: 3, finalPrice: '1.01', basePrice: 999, markupRate: 888 }],
  serviceFees: [{ name: '服务费', description: '服务范围', quantity: 2, guidePrice: 10, guideAmount: 20, costPrice: 777 }] };
const original = JSON.stringify(snapshot);
const sheet = preview(snapshot);
assert.equal(sheet.total, '23.03');
assert.equal(sheet.rows.length, 2);
assert.equal(sheet.rows[1].name, '服务费');
assert.equal(sheet.rows[1].parameters, '服务范围');
assert(!JSON.stringify(sheet).includes('999'));
assert(!JSON.stringify(sheet).includes('888'));
assert(!JSON.stringify(sheet).includes('777'));
assert.equal(JSON.stringify(snapshot), original);
assert.equal(preview({ ...snapshot, serviceFees: [{ ...snapshot.serviceFees[0], guideAmount: 19 }] }).rows[1].amount, '19.00', 'explicit snapshot amount preserved');
assert.equal(preview({ ...snapshot, serviceFees: [{ ...snapshot.serviceFees[0], guideAmount: null }] }).total, null);
assert.equal(preview({ ...snapshot, items: [{ quantity: 1, finalPrice: null }] }).total, null);
assert.equal(preview({ items: snapshot.items }).total, null, 'absent fee snapshot not assumed empty');
assert.equal(preview({ items: [], serviceFees: [] }).total, null);
assert.equal(preview(null).rows.length, 0);
assert.equal(preview({ items: [null], serviceFees: [] }).complete, false);
assert.equal(preview({ items: [{ quantity: 1, finalPrice: 0 }], serviceFees: [] }).total, '0.00');
assert.equal(preview({ items: [{ quantity: 0.5, finalPrice: 1.01 }], serviceFees: [] }).total, '0.51');
assert.equal(snapshotMoney(null), '—');
assert.equal(snapshotMoney(0), '0.00');
const exporter = fs.readFileSync('src/views/plan/materialExcel.ts', 'utf8');
const exportHeaders = new Function(`return ${exporter.match(/getRow\(2\).values = (\[[^;]+\]);/)[1]}`)();
assert.deepEqual(snapshotQuotationHeaders, exportHeaders);
for (const file of ['src/views/project/contract/QuotationSnapshotPreview.vue', 'src/views/project/contract/ContractApproval.vue']) {
  const { descriptor, errors } = sfc.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(errors, []);
  sfc.compileScript(descriptor, { id: file });
  assert.deepEqual(sfc.compileTemplate({ source: descriptor.template.content, filename: file, id: file }).errors, []);
}
const component = fs.readFileSync('src/views/project/contract/QuotationSnapshotPreview.vue', 'utf8');
assert(!/exportData|exportCandidate|defHttp|fetch\(|v-html/.test(component));
const approval = fs.readFileSync('src/views/project/contract/ContractApproval.vue', 'utf8');
assert(approval.includes(':quotation="snapshot.quotation"'));
assert(!approval.includes('<SubmittedValue'));
const contract = fs.readFileSync('src/views/project/contract/index.vue', 'utf8');
assert(contract.indexOf('查看报价预览</a-button>') < contract.indexOf('修改调整</a-button>'));
assert(contract.includes('getAllMaterialCandidateItems(id, rows => { fees = rows; })'));
assert(contract.includes('sequence !== quotationPreviewSequence || materialCandidateId.value !== id'));
assert(contract.includes('finalPrice: access.canViewQuote ? row.finalPrice : null'));
assert(contract.includes(':quotation="quotationPreviewData" live'));
console.log('PASS contract snapshot preview: export headers, source isolation, masked totals, stored amounts and Vue compilation');
