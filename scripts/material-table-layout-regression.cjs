const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const vue = require('vue');
const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc');
const files = [
  'material/components/MaterialIdentityCell.vue', 'material/apply/components/MaterialSelectDrawer.vue',
  'material/pick/index.vue', 'material/return/index.vue', 'material/apply/MaterialApply.vue',
  'material/purchase/PurchaseModal.vue', 'material/purchase/components/PurchaseDetailDrawer.vue', 'material/purchase/components/StockInModal.vue',
  'material/record/components/ApproveModal.vue', 'material/components/ApplyDetailDrawer.vue', 'material/record/components/StockExecuteModal.vue',
  'project/detail/components/DetailMaterial.vue', 'project/detail/components/DetailMaterialAccount.vue',
  'project/detail/components/ReworkDrawer.vue', 'project/components/MaterialSupplementDrawer.vue',
  'implement/components/ImplementLogDetailContent.vue', 'plan/components/PlanMaterial.vue', 'plan/components/MaterialPlanTable.vue',
];
for (const file of files) {
  const path = `src/views/${file}`;
  const { descriptor, errors } = parse(fs.readFileSync(path, 'utf8'), { filename: path });
  assert.deepEqual(errors, [], path);
  const script = compileScript(descriptor, { id: path });
  const template = compileTemplate({ source: descriptor.template.content, filename: path, id: path, compilerOptions: { bindingMetadata: script.bindings } });
  assert.deepEqual(template.errors, [], path);
}
function load(path, dependencies) {
  const context = { exports: {}, require: name => {
    if (!(name in dependencies)) throw Error(name);
    return dependencies[name];
  } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, context);
  return context.exports;
}
let dictionaryCalls = 0;
const identity = load('src/views/material/materialIdentity.ts', { './material.util': {
  loadDictMap: async () => { dictionaryCalls++; return { b: { text: '品牌甲' } }; },
} });
assert.equal(identity.materialIdentity({ id: 'order-row' }).materialId, '');
assert.equal(identity.materialIdentity({ id: 'master' }, 'master').materialId, 'master');
assert.equal(identity.materialIdentity({ id: 'order-row', materialId: 'material' }).materialId, 'material');
assert.equal(identity.materialIdentity({ name: '旧物料' }, 'detail', 'name').name, '旧物料');
assert.equal(identity.materialIdentity({ brand: 'b' }, 'detail', 'materialName', { b: { text: '品牌甲' } }).brand, '品牌甲');
assert.equal(identity.materialIdentity({ brand: 'b', brand_dictText: '快照品牌' }).brand, '快照品牌');
assert.equal(identity.materialIdentity({}).brand, '');
assert.equal(identity.materialIdentity({ materialName: '摄像头（品牌甲）', brand: '品牌甲' }).brand, '');
assert.equal(identity.loadMaterialBrandNames(), identity.loadMaterialBrandNames());
assert.equal(dictionaryCalls, 1);
const Cell = { props: ['record', 'source'], render() { return vue.h('span', { class: 'identity-test' }, this.record.materialName); } };
const { unifyMaterialColumns } = load('src/views/material/materialTableColumns.ts', {
  vue, './components/MaterialIdentityCell.vue': { default: Cell },
});
const quantityRenderer = () => 'quantity';
const columns = [
  { title: '类别', dataIndex: 'category' }, { title: '名称', dataIndex: 'materialName' },
  { title: '编码', dataIndex: 'materialCode' }, { title: '品牌', key: 'brand' },
  { title: '数量', key: 'quantity', customRender: quantityRenderer }, { title: '操作', key: 'action', width: 90 },
];
const before = JSON.stringify(columns);
const result = unifyMaterialColumns(columns);
assert.equal(JSON.stringify(columns), before, '不修改原列或业务定义');
assert.equal(result.length, 4);
assert.equal(result[0].key, 'unifiedMaterial');
assert.equal(result[0].fixed, 'left');
assert.equal(result[0].width, 220);
assert.equal(result[2].customRender, quantityRenderer);
assert.equal(result[3].fixed, 'right');
assert.equal(unifyMaterialColumns(columns.slice(0, -1)).some(c => c.key === 'action'), false);
assert.equal(unifyMaterialColumns([{ dataIndex: 'name' }, { key: 'brand' }], { nameField: 'name' }).length, 1);
assert.equal(unifyMaterialColumns([{ key: 'materialIdentity' }, { key: 'materialCode' }, { key: 'brand' }]).length, 1);
const picker = fs.readFileSync('src/views/material/apply/components/MaterialSelectDrawer.vue', 'utf8');
assert.match(picker, /width="min\(900px, 100vw\)"/);
assert.match(picker, /fixed: 'left'/);
assert.match(picker, /fixed: 'right'/);
assert.match(picker, /MaterialIdentityCell :record="record" source="master"/);
// 真正的 Ant Table bodyCell 空分支仍应回退到公共列 customRender。
(async () => {
  const { Table } = require('ant-design-vue');
  const { renderToString } = require('vue/server-renderer');
  const html = await renderToString(vue.createSSRApp({ render: () => vue.h(Table, {
    columns: result, dataSource: [{ key: '1', materialName: '回显验证物料' }], pagination: false, scroll: { x: 900 },
  }, { bodyCell: () => vue.createCommentVNode('empty') }) }));
  assert.match(html, /identity-test/);
  assert.match(html, /回显验证物料/);
  console.log('物料展示：18个组件编译、列合并/固定/只读、物料ID隔离、品牌字典并发复用、Ant Table真实SSR回显通过');
})().catch(error => { console.error(error); process.exitCode = 1; });
