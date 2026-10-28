const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const sfc = require('@vue/compiler-sfc');
const mobile = path.resolve(__dirname, '../../SHKKJ-uniapp');
function load(file, deps = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  new Function('exports', 'require', code)(exports, name => deps[name] || require(name));
  return exports;
}
async function main() {
  const p = load('src/views/plan/quotationPricing.ts');
  const fees = load('src/views/plan/serviceFee.ts', { './quotationPricing': p });
  const approval = load(path.join(mobile, 'src/service/quotationApproval.ts'), { '@/utils/http': { http: {} } });
  const editor = load(path.join(mobile, 'src/service/quotationEditor.ts'), { '@/utils/http': { http: {} }, './quotationApproval': approval });
  const table = load(path.join(mobile, 'src/utils/quotationTable.ts'), { '@/service/quotationApproval': approval });
  for (const [cost, price, rate] of [[100, 120, '20.00'], [100, 80, '-20.00'], [100, 0, '-100.00'], [0, 99, '0.00'], [3, 4, '33.33']]) {
    assert.equal(p.guidanceRate(cost, price), rate);
    assert.equal(table.quotationPercent(cost, price), `${rate}%`);
  }
  for (const [cost, rate, price] of [[100, '', '100.00'], [100, -20, '80.00'], [0, 50, '0.00'], [1.01, 50, '1.52']]) {
    assert.equal(p.guidancePrice(cost, rate), price);
    assert.equal(editor.guidancePrice(cost, rate), price);
  }
  const source = { id: 'source', name: '安装', unit: '次', costPrice: 100, guidePrice: 80, guideMarkupRate: 90, markupRate: 13 };
  const fee = fees.serviceFeeCopy(source);
  assert.equal(fee.guidePrice, '80.00'); assert.equal(fee.markupRate, '-20.00'); assert.equal(fee.taxRate, 13);
  assert.equal(fees.serviceFeeCopy({ ...source, guidePrice: null }).guidePrice, '0.00');
  assert.equal(fees.serviceFeeCopy(source, true).guidePrice, '80.00');
  const saved = { ...fee, id: 'saved', guidePrice: 77.77 };
  assert.equal(fees.serviceFeePayload(saved).guidePrice, 77.77);
  assert.equal(fees.serviceFeePayload(saved, { structure: true, cost: false, price: false }).guidePrice, undefined);
  assert.equal(fees.serviceFeePayload({ ...fee, guidePrice: '' }).guidePrice, 0);
  assert.throws(() => fees.serviceFeePayload({ ...fee, guidePrice: null, _error: '比例无效' }), /比例无效/);
  const material = { materialId: 'm', unitId: 'u', quantity: 1, basePrice: 100, finalPrice: 80, _sourceGuidePrice: 80, markupRate: -20 };
  assert.equal(editor.materialPayload(material, { cost: true, price: false }).finalPrice, 80);
  assert.equal(editor.materialPayload({ ...material, id: 'saved' }, { cost: true, price: false }).finalPrice, undefined);
  assert.deepEqual(editor.pricingPayload([{ ...material, id: 'm', finalPrice: '' }], [{ ...saved, id: 'f', guidePrice: '' }]), { records: [{ id: 'm', finalPrice: 0 }], serviceFees: [{ id: 'f', guidePrice: 0 }] });
  const requests = [];
  const api = load('src/views/material/goods/Goods.api.ts', {
    '/@/utils/http/axios': { defHttp: { post: async request => { requests.push(request); return { success: true }; } } },
    '/@/hooks/web/usePermission': { usePermission: () => ({ hasPermission: () => true }) },
    '/@/hooks/web/useMessage': { useMessage: () => ({ createConfirm() {} }) },
  });
  await api.saveMaterialPrices({ id: 'm', costPrice: '100.00', guidePrice: '80.00', guideMarkupRate: 90, _guideRate: -20 });
  assert.deepEqual(requests.pop().params, { id: 'm', costPrice: '100.00', guidePrice: '80.00' });
  await api.saveOrUpdate({ id: 'm', materialName: '设备', guidePrice: 99, guideMarkupRate: 90 }, true);
  assert.deepEqual(requests.pop().params, { id: 'm', materialName: '设备' });
  for (const file of ['src/views/material/goods/components/GoodsPriceModal.vue', 'src/views/plan/service-fee/index.vue', 'src/views/plan/components/ServiceFeeTable.vue', 'src/views/plan/components/MaterialPlanTable.vue', 'src/views/plan/components/QuotationServiceFeeCell.vue', 'src/views/plan/material-draft/editor.vue', path.join(mobile, 'src/pages/home/quotationEdit.vue')]) {
    const { descriptor, errors } = sfc.parse(fs.readFileSync(file, 'utf8'));
    assert.deepEqual(errors, []); sfc.compileScript(descriptor, { id: file });
    assert.deepEqual(sfc.compileTemplate({ source: descriptor.template.content, filename: file, id: file }).errors, []);
  }
  console.log('PASS 双端指导价：基础价带入、零/负比例、空值、价格字段白名单、权限隔离、7个SFC编译');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
