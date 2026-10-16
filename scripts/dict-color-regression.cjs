const fs = require('node:fs');
const assert = require('node:assert/strict');
const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc');
const files = [
  'src/components/DictValue.vue',
  'src/components/Form/src/jeecg/components/JDictSelectTag.vue',
  'src/components/Form/src/components/ApiSelect.vue',
  'src/views/payment/FinanceWorkspace.vue', 'src/views/payment/FinanceDetail.vue',
  'src/views/plan/material-draft/QuotationHistoryModal.vue', 'src/views/plan/material-draft/index.vue',
  'src/views/project/detail/index.vue', 'src/views/project/contract/index.vue',
  'src/views/project/contract/ContractApproval.vue',
  'src/views/project/components/ProjectBasicDrawer.vue', 'src/views/project/plan/PlanPayment.vue',
  ...['DetailBasic', 'DetailContract', 'DetailMember', 'DetailPlan', 'DetailMaterial'].map(name => `src/views/project/detail/components/${name}.vue`),
];
for (const filename of files) {
  const source = fs.readFileSync(filename, 'utf8');
  const { descriptor, errors } = parse(source);
  assert.deepEqual(errors, [], filename);
  const script = compileScript(descriptor, { id: filename });
  const result = compileTemplate({ source: descriptor.template.content, filename, id: filename, compilerOptions: { bindingMetadata: script.bindings } });
  assert.deepEqual(result.errors, [], filename);
}
const display = fs.readFileSync(files[0], 'utf8');
assert.match(display, /v-if="item.color" :color="item.color"/);
assert.match(display, /props.options \|\| loaded.value/);
assert.match(display, /String\(item.value\) === String\(value\)/);
assert.match(display, /seq === sequence/);
assert.doesNotMatch(display, /v-html/);
const workspace = fs.readFileSync('src/views/payment/FinanceWorkspace.vue', 'utf8');
assert.match(workspace, /receiptStatusOptions.value = receipt/);
assert.match(workspace, /invoiceStatusOptions.value = invoice/);
assert.match(fs.readFileSync(files[1], 'utf8'), /useDicColor: propTypes.bool.def\(true\)/);
console.log(`Dictionary color and ${files.length} SFC compile checks passed.`);
