const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc');
const read = path => fs.readFileSync(path, 'utf8');
const drawer = read('src/views/material/apply/components/MaterialSelectDrawer.vue');
const goods = read('src/views/material/goods/components/GoodsModal.vue');
const schema = read('src/views/material/goods/Goods.data.ts').split('export const formSchema: FormSchema[] = ')[1];
assert.match(drawer, /import GoodsModal from .*goods\/components\/GoodsModal.vue/);
assert.match(drawer, /<GoodsModal @register="registerAddModal" @success="handleAddMaterialSuccess"/);
assert.match(read('src/views/material/goods/index.vue'), /<GoodsModal/);
assert.match(drawer, /openAddModal\(true, \{ isUpdate: false, showFooter: true \}\)/);
assert.doesNotMatch(drawer, /\baddMaterial\b|MaterialAddModal/);
assert.doesNotMatch(read('src/views/material/apply/MaterialApply.api.ts'), /\baddMaterial\b|materialAdd/);
assert.equal(fs.existsSync('src/views/material/components/MaterialAddModal.vue'), false);
assert.match(schema, /field: 'brand',[\s\S]*?dynamicRules: \(\) => \[\{ required: true, message: '请选择品牌!'/);
assert.match(goods, /show-search/);
assert.match(goods, /@click="openBrandCreate"/);
for (const field of ['specificationParams', 'remark']) assert.match(schema, new RegExp(`field: '${field}'`));
for (const field of ['unitPrice', 'stockQty']) assert.doesNotMatch(schema, new RegExp(`field: '${field}'`));
for (const field of ['stockQty', 'stockAmount']) assert.match(goods, new RegExp(`delete rest\\.${field}`));
for (const path of ['src/views/material/apply/components/MaterialSelectDrawer.vue', 'src/views/material/goods/components/GoodsModal.vue']) {
  const { descriptor, errors } = parse(read(path), { filename: path });
  assert.deepEqual(errors, []);
  const script = compileScript(descriptor, { id: path });
  const template = compileTemplate({ source: descriptor.template.content, filename: path, id: path, compilerOptions: { bindingMetadata: script.bindings } });
  assert.deepEqual(template.errors, []);
}
const callback = drawer.match(/async function handleAddMaterialSuccess\(\)[\s\S]*?\n  \}/)[0];
async function main() {
  for (const visible of [true, false]) {
    const calls = [];
    const run = new Function('invalidateMaterialMap', 'drawerVisible', 'loadTree', 'loadData',
      ts.transpile(callback) + '; return handleAddMaterialSuccess;')(
      () => calls.push('invalidate'), { value: visible },
      async () => calls.push('tree'), async () => calls.push('list')
    );
    await run();
    assert.deepEqual(calls, visible ? ['invalidate', 'tree', 'list'] : ['invalidate']);
  }
  console.log('PASS shared goods modal, required brand, fields, no duplicate save, refresh callback and SFC compilation');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
