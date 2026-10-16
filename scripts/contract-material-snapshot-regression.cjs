const fs = require('node:fs');
const assert = require('node:assert/strict');
const sfc = require('@vue/compiler-sfc');
const ts = require('typescript');
const moduleState = { exports: {} };
new Function('module', 'exports', 'require', ts.transpile(fs.readFileSync('src/views/project/contract/quotationSnapshotPreview.ts', 'utf8'), { module: ts.ModuleKind.CommonJS }))(moduleState, moduleState.exports, require);
const { contractSnapshotRows } = moduleState.exports;
const service = { name: '安装服务', description: '现场安装调试', unit: '次', quantity: 3, remark: '快照备注', guidePrice: 99, costPrice: 88, taxRate: 13 };
const mixed = contractSnapshotRows({ records: [{ materialName: '合同物料', quantity: 7 }], serviceFees: [service] });
assert.equal(mixed.length, 2);
assert.equal(mixed[1].materialName, '安装服务');
assert.equal(mixed[1].materialCategory, '服务费');
assert.equal(mixed[1].quantity, 3);
assert.equal(mixed[1].unit, '次');
assert.equal(mixed[1].description, '现场安装调试');
assert.equal(mixed[1].remark, '快照备注');
for (const key of ['guidePrice', 'costPrice', 'taxRate', 'guideAmount', 'markupRate']) assert(!(key in mixed[1]));
assert.equal(contractSnapshotRows({ records: [], serviceFees: [service] }).length, 1);
assert.equal(contractSnapshotRows({ serviceFees: [service] }).length, 1);
assert.equal(contractSnapshotRows({ records: [{ materialName: '旧物料' }] }).length, 1);
assert.deepEqual(contractSnapshotRows(null), []);
assert.deepEqual(contractSnapshotRows({ records: [], serviceFees: [] }), []);
assert.deepEqual(contractSnapshotRows({ records: [null], serviceFees: 'invalid' }), []);
const source = fs.readFileSync('src/views/project/contract/index.vue', 'utf8');
const branch = source.match(/async function openQuotationPreview\(\) \{\s*if \(readonly.value && !editing.value\) \{([\s\S]*?)\n    \}/)[1];
const run = new Function('info', 'quotationPreviewData', 'quotationPreviewOpen', 'quotationPreviewError', 'closeQuotationPreview', branch);
for (const snapshot of [null, { records: [] }, { records: [{ materialName: '合同物料', quantity: 7 }] }]) {
  const data = { value: null }, open = { value: false }, error = { value: 'old error' };
  run({ value: { materialSnapshot: snapshot } }, data, open, error, () => {});
  assert.equal(data.value, snapshot);
  assert.equal(open.value, true);
  assert.equal(error.value, '');
}
assert(!/await|loadContractCandidates|getAllMaterialCandidateItems|getQuotationAccess/.test(branch));
assert(fs.readFileSync('src/views/payment/Payment.api.ts', 'utf8').includes('materialSnapshot: result.materialSnapshot'));
const component = fs.readFileSync('src/views/project/contract/QuotationSnapshotPreview.vue', 'utf8');
const materialTemplate = component.slice(component.indexOf('<div v-if="materialOnly"'), component.indexOf('<a-alert'));
assert(!/snapshotMoney|合计|row.price|row.amount/.test(materialTemplate));
assert(materialTemplate.includes('暂无物料及服务费快照') && materialTemplate.includes('本轮未提交物料或服务费'));
assert(component.includes('contractSnapshotRows(props.quotation)'));
assert(!materialTemplate.includes('row.description'), 'service name must not display description below it');
const detailContract = fs.readFileSync('src/views/project/detail/components/DetailContract.vue', 'utf8');
assert(detailContract.includes('label="关联报价单"'));
assert(detailContract.includes("contract.materialSnapshot?.candidateName || '查看关联报价单'"));
assert(detailContract.includes(':quotation="contract.materialSnapshot ?? null" material-only hide-amounts'));
const openDetailPreview = detailContract.match(/function openQuotationPreview\(\) \{[\s\S]*?\n  \}/)[0];
assert(!/await|getQuotationAccess|getContractDetail/.test(openDetailPreview));
for (const [loading, failed, hasContract, expected] of [[false, false, true, true], [true, false, true, false], [false, true, true, false], [false, false, false, false]]) {
  const open = { value: false };
  new Function('loading', 'loadFailed', 'hasContract', 'quotationPreviewOpen', openDetailPreview + ';openQuotationPreview();')({ value: loading }, { value: failed }, { value: hasContract }, open);
  assert.equal(open.value, expected);
}
assert(detailContract.includes('quotationPreviewOpen.value = false;\n    const currentSequence = ++loadSequence;'));
for (const file of ['src/views/project/contract/index.vue', 'src/views/project/contract/QuotationSnapshotPreview.vue', 'src/views/project/detail/components/DetailContract.vue']) {
  const { descriptor, errors } = sfc.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(errors, []);
  sfc.compileScript(descriptor, { id: file });
  assert.deepEqual(sfc.compileTemplate({ source: descriptor.template.content, filename: file, id: file }).errors, []);
}
console.log('PASS contract snapshot: mixed/service-only/legacy/empty lists, no prices or extra requests, content fields and SFC compilation');
