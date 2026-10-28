const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file) {
  const mod = {};
  new Function('exports', 'require', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText)(mod, require);
  return mod;
}
const { buildQuotationPreview, quotationPreviewBasis } = load('src/views/plan/quotationPreview.ts');
const { quotationDetailFields, normalizeQuotationAccess } = load('src/views/plan/quotationGovernance.ts');
const { quotationSnapshotPreview } = load('src/views/project/contract/quotationSnapshotPreview.ts');
const rows = [{ materialName: '测试物料', quantity: 1, plannedQty: 3, unit: '台', finalPrice: '1.01', basePrice: 999, markupRate: 333 }];
const fees = [{ name: '服务费', quantity: 2, guidePrice: '2.01', guideAmount: 99, costPrice: 888, markupRate: 222 }];
const before = JSON.stringify({ rows, fees });
const quoteAccess = { cost: false, quote: true };
const costAccess = { cost: true, quote: false };
const preview = buildQuotationPreview('预览单', rows, fees, quoteAccess);
const sheet = quotationSnapshotPreview(preview);
assert.equal(sheet.total, '7.05');
assert.equal(sheet.rows.length, 2);
assert.equal(sheet.title, '预览单');
assert.equal(sheet.rows[0].quantity, 3);
assert.equal(quotationSnapshotPreview(buildQuotationPreview('', rows, fees, { cost: false, quote: false })).total, null);
assert(!/basePrice|costPrice|markupRate|guideAmount/.test(JSON.stringify(preview)));
assert.equal(JSON.stringify({ rows, fees }), before);
assert.equal(quotationSnapshotPreview(buildQuotationPreview('', [], [], quoteAccess)).rows.length, 0);
const cost = buildQuotationPreview('技术报价', rows, fees, costAccess);
assert.equal(quotationSnapshotPreview(cost).total, '4773.00');
assert.deepEqual(quotationSnapshotPreview(cost).rows.map(row => row.amount), ['2997.00', '1776.00']);
assert(!JSON.stringify(cost).includes('1.01'));
assert(!JSON.stringify(cost).includes('2.01'));
assert.equal(quotationPreviewBasis(costAccess, 'quote'), 'cost');
assert.equal(quotationPreviewBasis(quoteAccess, 'cost'), 'quote');
assert.equal(quotationPreviewBasis({ cost: false, quote: false }, 'cost'), null);
const both = { cost: true, quote: true };
assert.equal(quotationSnapshotPreview(buildQuotationPreview('', rows, fees, both, 'quote')).total, '7.05');
assert.equal(quotationSnapshotPreview(buildQuotationPreview('', rows, fees, both, 'cost')).total, '4773.00');
assert.equal(quotationSnapshotPreview(buildQuotationPreview('', [{ ...rows[0], basePrice: null }], fees, costAccess)).total, null);
assert.equal(quotationSnapshotPreview(buildQuotationPreview('', rows, [{ ...fees[0], costPrice: null }], costAccess)).total, null);
assert.equal(quotationSnapshotPreview(buildQuotationPreview('', [{ plannedQty: 2, basePrice: 0 }], [], costAccess)).total, '0.00');
// 身份由后端判断，前端消费具体报价字段权限，不凭部门字符串开放价格。
for (const role of ['技术部创建人', '技术部主管']) {
  const fields = quotationDetailFields({ approvalRoute: 'TECHNICAL', id: 'q' }, normalizeQuotationAccess({ canViewCost: true, canViewQuote: false }));
  assert.equal(quotationSnapshotPreview(buildQuotationPreview(role, rows, fees, fields)).total, '4773.00');
}
assert.equal(JSON.stringify({ rows, fees }), before);
const source = fs.readFileSync('src/views/plan/material-draft/editor.vue', 'utf8');
const handler = source.match(/function openDocumentPreview\(\) \{([\s\S]*?)\n  \}/)[1];
assert(!/await|exportData|getQuotationAccess|fetch/.test(handler));
assert(source.includes('!loaded || !materialsReady || !feesReady || saving'));
assert(source.includes('v-if="showCostTotal && showMarketPricing"'));
assert(source.includes('documentPreviewAccess.value, documentPreviewBasis.value'));
console.log('PASS quotation preview: cost/quote permissions, both-mode switch, technical cost totals, null/zero, no mutation or extra requests');
