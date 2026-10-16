const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { parse } = require('@vue/compiler-sfc');
const source = fs.readFileSync('src/views/plan/components/MaterialPlanTable.vue', 'utf8');
const ast = ts.createSourceFile('table.ts', parse(source).descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true);
const names = ['createUnitOptions', 'getDefaultUnit', 'hydrateRows'];
const code = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map(node => node.getText(ast)).join('\n');
const rows = { value: [] }, loaded = { value: false }, persistedSnapshot = { value: '' };
const hydrate = new Function('props', 'rows', 'loaded', 'persistedSnapshot', 'loadMaterialMap', 'quotationSnapshot', 'serializeRows', 'emit',
  ts.transpile(`let keySeed = 0, loadSequence = 1;\n${code}\nreturn hydrateRows;`, { target: ts.ScriptTarget.ES2020 }))(
  { mode: 'quotation', pricingEditable: false }, rows, loaded, persistedSnapshot,
  () => { throw Error('报价回显不得查询物料库'); }, row => ({ ...row }), JSON.stringify, () => {}
);
(async () => {
  const snapshot = { materialId: 'm', materialCode: 'M001', unitId: 'u', unit: '台', quantity: 2, basePrice: 5 };
  await hydrate([snapshot]);
  assert.equal(rows.value[0].materialCode, 'M001');
  assert.equal(rows.value[0]._unitValue, 'u');
  assert.deepEqual(rows.value[0]._unitOptions, [{ label: '台', value: 'u' }]);
  assert.equal(rows.value[0].plannedQty, 2);
  assert.equal(rows.value[0].basePrice, 5);
  await hydrate([]);
  assert.deepEqual(rows.value, []);
  assert(source.includes("if (props.snapshotOnly || props.mode === 'quotation')"));
  console.log('PASS quotation hydration: no material list request, snapshot code/unit/quantity/price preserved');
})().catch(error => { console.error(error); process.exitCode = 1; });
