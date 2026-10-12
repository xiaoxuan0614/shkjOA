const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
function load(path, dependencies = {}) {
  const context = { exports: {}, require: (name) => dependencies[name] || {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
  return context.exports;
}
const logic = load('src/views/material/purchase/purchaseType.ts');
const schema = load('src/views/material/purchase/Purchase.data.ts', { './purchaseType': logic }).purchaseFormSchema;
const type = schema.find((item) => item.field === 'purchaseType');
const project = schema.find((item) => item.field === 'periodId');
assert.equal(type.componentProps.dictCode, 'purchase_order_type');
assert.equal(type.required, true);
for (const value of ['1', 1, '2', '3', '', undefined, null]) {
  const expected = value === '1' || value === 1;
  const values = { purchaseType: value, periodId: 'period', projectName: 'project' };
  assert.equal(project.ifShow({ model: values }), expected);
  assert.equal(project.dynamicRules({ model: values })[0].required, expected);
  for (const editing of [true, false]) {
    const payload = logic.purchaseProjectPayload(values, 'main', editing);
    assert.equal(JSON.stringify(payload), JSON.stringify(expected ? { projectId: 'main', periodId: 'period', projectName: 'project' } : editing ? { projectId: '', periodId: '' } : {}));
  }
}
const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc');
const filename = 'src/views/material/purchase/PurchaseModal.vue';
const source = fs.readFileSync(filename, 'utf8');
const { descriptor, errors } = parse(source);
assert.equal(errors.length, 0);
compileScript(descriptor, { id: 'purchase-type' });
assert.equal(compileTemplate({ source: descriptor.template.content, filename, id: 'purchase-type' }).errors.length, 0);
assert.match(source, /!isProjectPurchase\(getFieldsValue\(\).purchaseType\)/);
assert.match(source, /setFieldsValue\(\{ periodId: undefined, projectName: '' \}\)/);
console.log('Purchase type visibility, validation, payload and SFC checks passed');
