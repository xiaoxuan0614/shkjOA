const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file) {
  const mod = {};
  new Function('exports', 'require', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText)(mod, require);
  return mod;
}
const { buildQuotationPreview } = load('src/views/plan/quotationPreview.ts');
const { quotationSnapshotPreview } = load('src/views/project/contract/quotationSnapshotPreview.ts');
const rows = [{ materialName: '测试物料', quantity: 1, plannedQty: 3, unit: '台', finalPrice: '1.01', basePrice: 999, markupRate: 333 }];
const fees = [{ name: '服务费', quantity: 2, guidePrice: '2.01', guideAmount: 99, costPrice: 888, markupRate: 222 }];
const before = JSON.stringify({ rows, fees });
const preview = buildQuotationPreview('预览单', rows, fees, true);
const sheet = quotationSnapshotPreview(preview);
assert.equal(sheet.total, '7.05');
assert.equal(sheet.rows.length, 2);
assert.equal(sheet.title, '预览单');
assert.equal(sheet.rows[0].quantity, 3);
assert.equal(quotationSnapshotPreview(buildQuotationPreview('', rows, fees, false)).total, null);
assert(!/basePrice|costPrice|markupRate|guideAmount/.test(JSON.stringify(preview)));
assert.equal(JSON.stringify({ rows, fees }), before);
assert.equal(quotationSnapshotPreview(buildQuotationPreview('', [], [], true)).rows.length, 0);
const source = fs.readFileSync('src/views/plan/material-draft/editor.vue', 'utf8');
const handler = source.match(/function openDocumentPreview\(\) \{([\s\S]*?)\n  \}/)[1];
assert(!/await|exportData|getQuotationAccess|fetch/.test(handler));
assert(source.includes('!loaded || !materialsReady || !feesReady || saving'));
console.log('PASS quotation preview: current quantities, fees, masked amounts, no costs/rates or extra requests');
