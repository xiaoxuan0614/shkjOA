const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const vue = require('vue');
const sfc = require('@vue/compiler-sfc');
const component = 'src/components/PaymentPlan/PaymentPlanEditor.vue';
let compiled;
for (const file of [component, 'src/views/project/contract/index.vue', 'src/views/operation/maintenance/MaintenanceContract.vue']) {
  const { descriptor, errors } = sfc.parse(fs.readFileSync(file, 'utf8'), { filename: file });
  assert.deepEqual(errors, []);
  const script = sfc.compileScript(descriptor, { id: file });
  const template = sfc.compileTemplate({ source: descriptor.template.content, filename: file, id: file, compilerOptions: { bindingMetadata: script.bindings } });
  assert.deepEqual(template.errors, []);
  if (file === component) compiled = script.content;
}
const box = { exports: {}, require: name => name === 'vue' ? vue : {} };
vm.runInNewContext(ts.transpileModule(compiled, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, box);
for (const mode of ['cycle', 'date']) {
  const props = vue.reactive({ mode, nodeField: mode === 'cycle' ? 'node' : 'paymentNode', amountField: mode === 'cycle' ? 'amount' : 'plannedAmount', nodeOptions: [{ value: '1', label: '预付款' }], readonly: false });
  const page = box.exports.default.setup(props, { expose() {}, emit() {} });
  assert.ok(page.columns.value.some(c => c.key === (mode === 'date' ? 'plannedDate' : 'rollbackTime')));
  assert.ok(!page.columns.value.some(c => c.key === (mode === 'date' ? 'rollbackTime' : 'plannedDate')));
  assert.ok(!page.columns.value.some(c => c.key === 'payMethod'));
  assert.equal(page.display({ [props.nodeField]: '1' }, 'node'), '预付款');
  assert.equal(page.display({ [props.nodeField]: '旧约定节点' }, 'node'), '旧约定节点');
  assert.equal(page.display({ [props.amountField]: 0 }, 'amount'), '0.00');
  assert.equal(page.display({}, 'amount'), '—');
  props.readonly = true;
  assert.ok(!page.columns.value.some(c => c.key === 'action'));
}
console.log('PASS shared payment editor: cycle/date fields, readonly, dictionary/history labels, zero/missing amounts and three SFCs');
