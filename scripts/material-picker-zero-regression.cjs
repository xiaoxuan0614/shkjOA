const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const vm = require('node:vm');
const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc');
const mobileFile = '../SHKKJ-uniapp/src/pages/ops/materialApply.vue';
const pcFile = 'src/views/material/apply/components/MaterialSelectDrawer.vue';
for (const file of [pcFile, mobileFile]) {
  const source = fs.readFileSync(file, 'utf8');
  const { descriptor, errors } = parse(source, { filename: file });
  assert.equal(errors.length, 0);
  const script = compileScript(descriptor, { id: file });
  assert.equal(compileTemplate({ source: descriptor.template.content, filename: file, id: file, compilerOptions: { bindingMetadata: script.bindings } }).errors.length, 0);
}
const source = fs.readFileSync(mobileFile, 'utf8');
const script = parse(source).descriptor.scriptSetup.content;
const ast = ts.createSourceFile('mobile.ts', script, ts.ScriptTarget.Latest, true);
const names = ['getAvailableApplyQty', 'isMaterialDisabled', 'selectableMaterials', 'allLoadedMaterialsSelected', 'isSelected', 'toggleMaterial', 'toggleSelectAllMaterials'];
const statements = ast.statements.filter(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(d => names.includes(d.name.getText(ast))));
const context = {
  isProjectUsage: { value: true }, filteredMaterialList: { value: [{ id: 'zero', availableApplyQty: 0 }, { id: 'positive', availableApplyQty: 2 }] },
  pickerSelectedMaterials: { value: [] }, toast: { info() {} }, computed: fn => ({ get value() { return fn(); } }), exports: {},
};
vm.runInNewContext(ts.transpileModule(statements.map(n => n.getText(ast)).join('\n') + '\nexports.api = {isMaterialDisabled, toggleMaterial, toggleSelectAllMaterials, allLoadedMaterialsSelected};', {
  compilerOptions: { target: ts.ScriptTarget.ES2020 },
}).outputText, context);
const api = context.exports.api;
assert.equal(api.isMaterialDisabled(context.filteredMaterialList.value[0]), true);
api.toggleMaterial(context.filteredMaterialList.value[0]);
assert.equal(context.pickerSelectedMaterials.value.length, 0);
api.toggleSelectAllMaterials();
assert.equal(context.pickerSelectedMaterials.value.length, 1);
assert.equal(context.pickerSelectedMaterials.value[0].id, 'positive');
assert.equal(api.allLoadedMaterialsSelected.value, true);
api.toggleSelectAllMaterials();
assert.equal(context.pickerSelectedMaterials.value.length, 0);
context.isProjectUsage.value = false;
assert.equal(api.isMaterialDisabled(context.filteredMaterialList.value[0]), false);
assert.doesNotMatch(source.slice(source.indexOf('const availableMaterials ='), source.indexOf('const merged =')), /\.filter\([^\n]*getAvailableApplyQty/);
const pc = fs.readFileSync(pcFile, 'utf8');
assert.match(pc, /tableData.value = records.filter\(\(item: any\) => item.materialId\).map\(normalizeProjectMaterialAccount\);/);
assert.match(pc, /:disabled="isProjectMode && !record.availableApplyQty"/);
console.log('PC/mobile compilation, zero retained, selection blocked, mixed select-all and non-project selection passed');
