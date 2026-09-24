const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const ExcelJS = require('exceljs');
function load(file, overrides = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports, require: (id) => overrides[id] || require(id) });
  return exports;
}
const pricing = load('src/views/plan/quotationPricing.ts');
assert.doesNotThrow(() => pricing.validateDirectQuotation(0, '0.00'));
assert.doesNotThrow(() => pricing.validateDirectQuotation('12.34', '12.34'));
assert.doesNotThrow(() => pricing.validateDirectQuotation('12.34', '12.35'));
assert.doesNotThrow(() => pricing.validateDirectQuotation('12.34', '12.33'));
assert.doesNotThrow(() => pricing.validateDirectQuotation('12.34', '0.00'));
assert.throws(() => pricing.validateDirectQuotation(1, null));
assert.throws(() => pricing.validateDirectQuotation(1, '1.001'));
assert.equal(pricing.guidancePrice(100,20),'120.00');
assert.equal(pricing.guidancePrice('1.01',50),'1.52');
assert.equal(pricing.guidancePrice(0,20),'0.00');
assert.equal(pricing.guidancePrice(100,0),'100.00');
assert.throws(()=>pricing.guidancePrice(100,null));
assert.throws(()=>pricing.guidancePrice(null,20));
assert.equal(pricing.finalFromRate(100, 0.2), '120.00');
assert.equal(pricing.rateFromFinal(100, 120), '0.2000');
assert.equal(pricing.finalFromRate('0.1', '0.2'), '0.12');
assert.equal(pricing.rateFromFinal(0, 0), '0.0000');
assert.throws(() => pricing.rateFromFinal(0, 1));
assert.throws(() => pricing.rateFromFinal(100, 99));
for (const value of [-1, 'NaN', Infinity, '1.001']) assert.throws(() => pricing.decimalPrice(value, '底价'));
assert.equal(pricing.quotationPricePayload({ basePrice: 0 }).basePrice, 0);
assert.equal(pricing.quotationPricePayload({ basePrice: 100, markupRate: 0.2, finalPrice: 121 }, true).finalPrice, 121);
assert.throws(() => pricing.quotationPricePayload({}, true));
assert.equal(pricing.quotationSnapshot({ id: 1, basePrice: '1.00' }), pricing.quotationSnapshot({ id: '1', basePrice: 1 }));
assert.equal('costPrice' in pricing.quotationPricePayload({ basePrice: 100, costPrice: 50 }), false);
let buffer;
const excel = load('src/views/plan/materialExcel.ts', { './quotationPricing': pricing, '/@/utils/file/download': { downloadByData: (data) => { buffer = data; } } });
(async () => {
  const rows = [{ quantity: 2, materialName: '测试物料', costPrice: 61, basePrice: 100, markupRate: 0.2, finalPrice: 120 }];
  await assert.rejects(() => excel.exportCandidateMaterials({}));
  await excel.exportCandidateMaterials({ candidateId: 'test', candidateName: '测试报价', records: rows });
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  assert.equal(sheet.getCell('H1').value, '指导价格');
  assert.equal(sheet.getCell('H2').value, 120);
  assert(!JSON.stringify(sheet.getRow(1).values).match(/成本|底价|比例|备注/));
  assert.equal(sheet.columnCount, 8);
  const vue = require('@vue/compiler-sfc');
  for (const path of ['src/views/plan/components/MaterialPlanTable.vue', 'src/views/plan/material-draft/editor.vue', 'src/views/plan/material-draft/index.vue', 'src/views/plan/material-draft/QuotationGrantModal.vue', 'src/views/plan/material-draft/QuotationHistoryModal.vue']) {
    const { descriptor, errors } = vue.parse(fs.readFileSync(path, 'utf8')); assert.equal(errors.length, 0);
    vue.compileScript(descriptor, { id: path });
    assert.equal(vue.compileTemplate({ source: descriptor.template.content, filename: path, id: path }).errors.length, 0);
  }
  console.log('Quotation arithmetic, precision, validation, cost omission, XLSX and Vue compilation checks passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
