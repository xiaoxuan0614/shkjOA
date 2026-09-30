const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const sfc = require('@vue/compiler-sfc');
const vm = require('node:vm');
const file = 'src/views/plan/material-draft/editor.vue';
const source = fs.readFileSync(file, 'utf8');
const descriptor = sfc.parse(source).descriptor;
const compiled = sfc.compileScript(descriptor, { id: file });
assert.deepEqual(sfc.compileTemplate({ source: descriptor.template.content, filename: file, id: file, compilerOptions: { bindingMetadata: compiled.bindings } }).errors, []);
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/views/plan/quotationGovernance.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
const api = context.exports;
const canUnlock = source.match(/const canUnlock = computed\(\(\) => ([\s\S]*?)\);/)[1];
for (const status of ['1','2','3']) for (const allowed of [true,false]) {
  const record = { value: { id:'q', status, adopted:1, approvalRoute:'MARKET', priced:1 } };
  const access = { value: api.normalizeQuotationAccess({canViewPrice:allowed,canEditPrice:allowed}) };
  const caps = { value: api.quotationCapabilities(record.value,access.value,{},()=>true) };
  assert.equal(caps.value.structure,false);
  assert.equal(caps.value.editBase,false);
  const env = { record,access,caps, loaded:{value:true},canPrice:{value:false},editing:{value:false},reviewMode:{value:false},pricingMode:{value:false},marketQuotation:{value:true} };
  assert.equal(vm.runInNewContext(canUnlock,env),status==='1' && allowed);
}
console.log('PASS authorized adopted MARKET edit button, pending/void restrictions, structure/base locked and Vue compilation');
