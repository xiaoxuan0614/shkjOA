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
assert.match(pc, /isProjectMode && Number\(record.availableApplyQty\) <= 0/);
const pcScript = parse(pc).descriptor.scriptSetup.content;
const pcAst = ts.createSourceFile('pc.ts', pcScript, ts.ScriptTarget.Latest, true);
const idsNode = pcAst.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(d => d.name.getText(pcAst) === 'excludedMaterialIds'));
const { reactive, computed } = require('vue');
const idsContext = { exports: {}, computed, props: reactive({ existingMaterialIds: [12, 'saved', null, undefined, ''] }), callbackMaterialIds: { value: ['stale'] } };
vm.runInNewContext(ts.transpileModule(idsNode.getText(pcAst) + '\nexports.ids = excludedMaterialIds;', { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, idsContext);
assert.deepEqual(Array.from(idsContext.exports.ids.value), ['12', 'saved']);
idsContext.props.existingMaterialIds = ['new'];
assert.deepEqual(Array.from(idsContext.exports.ids.value), ['new'], '当前清单变化即同步，不依赖打开回调');
idsContext.props.existingMaterialIds = [];
assert.equal(idsContext.exports.ids.value.size, 0, '清空后不能复用旧回调的勾选');
idsContext.props.existingMaterialIds = undefined;
assert.deepEqual(Array.from(idsContext.exports.ids.value), ['stale'], '其他调用者保留原回调协议');
assert(pc.includes(':checked="isSelected(record)"'));
const planSource = fs.readFileSync('src/views/plan/components/MaterialPlanTable.vue', 'utf8');
assert(planSource.includes(':existing-material-ids="rows.map(item => item.materialId)"'));
assert(planSource.includes("y: 'clamp(240px, 50vh, 520px)'"));
assert(pc.includes("y: 'clamp(220px, 50vh, 520px)'"));
const visibleHandler = pcAst.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'handleVisibleChange');
const opening = { drawerVisible: { value: false }, loading: { value: false }, selectedList: { value: [] }, removedExistingIds: { value: new Set(['cancelled']) }, loadSequence: 0, calls: 0,
  resetQueryState() {}, initializeDrawer() { opening.calls++; } };
vm.runInNewContext(ts.transpileModule(visibleHandler.getText(pcAst) + '\nhandleVisibleChange(true);handleVisibleChange(true);handleVisibleChange(false);handleVisibleChange(true);', { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, opening);
assert.equal(opening.calls, 2, '每次打开加载一次，不依赖传入数据变化');
assert.equal(opening.removedExistingIds.value.size, 0, '重开清空未确认的取消勾选');
const pcNames = ['selectableMaterials', 'allPageMaterialsSelected', 'somePageMaterialsSelected', 'isSelected', 'handleSelect', 'handleUnselect', 'handleToggleSelectAll'];
const pcNodes = pcAst.statements.filter(node =>
  (ts.isFunctionDeclaration(node) && pcNames.includes(node.name?.text)) ||
  (ts.isVariableStatement(node) && node.declarationList.declarations.some(d => pcNames.includes(d.name.getText(pcAst)))));
const pcContext = { exports: {}, computed: fn => ({ get value() { return fn(); } }), props: { allowDeselectExisting: false }, removedExistingIds: { value: new Set() },
  loading: { value: false }, isProjectMode: { value: true }, excludedMaterialIds: { value: new Set(['added']) },
  tableData: { value: [{ id: 'a', availableApplyQty: 2 }, { id: 'b', availableApplyQty: 1 }, { id: 'zero', availableApplyQty: 0 }, { id: 'added', availableApplyQty: 3 }] },
  selectedList: { value: [{ id: 'other-page' }] } };
vm.runInNewContext(ts.transpileModule(pcNodes.map(n => n.getText(pcAst)).join('\n') + '\nexports.api={isSelected,handleSelect,handleUnselect,handleToggleSelectAll,allPageMaterialsSelected,somePageMaterialsSelected};', { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, pcContext);
const pcApi = pcContext.exports.api;
pcApi.handleSelect(pcContext.tableData.value[0]);
assert.equal(pcApi.somePageMaterialsSelected.value, true); assert.equal(pcApi.allPageMaterialsSelected.value, false);
pcApi.handleToggleSelectAll(); assert.equal(pcApi.allPageMaterialsSelected.value, true); assert.equal(pcContext.selectedList.value.length, 3);
pcApi.handleToggleSelectAll(); assert.equal(pcContext.selectedList.value.length, 1); assert.equal(pcContext.selectedList.value[0].id, 'other-page');
pcApi.handleSelect(pcContext.tableData.value[2]); pcApi.handleSelect(pcContext.tableData.value[3]); assert.equal(pcContext.selectedList.value.length, 1);
pcContext.loading.value = true; pcApi.handleToggleSelectAll(); assert.equal(pcContext.selectedList.value.length, 1);
pcContext.loading.value = false;
const existing = pcContext.tableData.value[3];
assert.equal(pcApi.isSelected(existing), true);
pcApi.handleUnselect(existing);
assert.equal(pcApi.isSelected(existing), true, '非报价入口不允许取消已有物料');
pcContext.props.allowDeselectExisting = true;
pcApi.handleUnselect(existing);
assert.equal(pcApi.isSelected(existing), false);
assert(pcContext.removedExistingIds.value.has('added'));
pcApi.handleSelect(existing);
assert.equal(pcApi.isSelected(existing), true);
assert.equal(pcContext.removedExistingIds.value.size, 0);
assert.equal(pcContext.selectedList.value.length, 1, '重新勾选已有物料不能成为新增行');
pcApi.handleToggleSelectAll();
assert.equal(pcApi.allPageMaterialsSelected.value, true);
pcApi.handleToggleSelectAll();
assert.equal(pcApi.isSelected(existing), false);
assert.equal(pcContext.selectedList.value[0].id, 'other-page');
const okNode = pcAst.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'handleOk');
let emitted;
Object.assign(pcContext, { unref: value => value.value, emit: (...args) => { emitted = args; }, closeDrawer() {} });
vm.runInNewContext(ts.transpileModule(okNode.getText(pcAst) + '\nhandleOk();', { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, pcContext);
assert.equal(emitted[0], 'success');
assert.deepEqual(Array.from(emitted[2]), ['added']);
const planAst = ts.createSourceFile('plan.ts', parse(planSource).descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true);
const applyNode = planAst.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'handleSelected');
const retained = { materialId: 'keep', plannedQty: 7, basePrice: 123, _unitValue: 'u', remark: '保留' };
const applyContext = { props: { mode: 'quotation', editable: true, structureEditable: true }, rows: { value: [retained, { materialId: 'added' }] } };
vm.runInNewContext(ts.transpileModule(applyNode.getText(planAst) + "\nhandleSelected([], ['added']);", { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, applyContext);
assert.equal(applyContext.rows.value.length, 1);
assert.equal(applyContext.rows.value[0], retained, '保留行对象和已填字段不重建');
assert.match(pc, /#headerCell/); assert.match(pc, /:indeterminate="somePageMaterialsSelected && !allPageMaterialsSelected"/);
console.log('PC checkbox partial/all/unselect, other-page preservation, excluded/zero/loading guards passed');
console.log('PC/mobile compilation, zero retained, selection blocked, mixed select-all and non-project selection passed');
