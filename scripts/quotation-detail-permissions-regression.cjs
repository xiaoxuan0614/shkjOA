const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const sfc = require('@vue/compiler-sfc');
const exportsObject = {};
new Function('exports', ts.transpileModule(fs.readFileSync('src/views/plan/quotationGovernance.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText)(exportsObject);
const g = exportsObject;
const record = { id: 'quote', createBy: 'owner', status: '1', adopted: 0, priced: 1 };
const grant = g.normalizeQuotationAccess({ canViewPrice: true, canEditPrice: true, canExport: true, canViewQuote: true });
const user = { username: 'grantee' };
for (const status of ['-1', '0', '1', '2', '4']) {
  const caps = g.quotationDetailCapabilities({ ...record, status }, grant, user, () => true);
  for (const key of ['edit', 'structure', 'editBase', 'submit', 'void']) assert.equal(caps[key], false, `${status}: grant must not confer ${key}`);
}
assert.equal(g.quotationCapabilities(record, grant, user, () => true).edit, true, 'contract capability remains unchanged');
assert.equal(g.quotationDetailCapabilities(record, grant, { username: 'owner' }, () => true).edit, true);
assert.equal(g.quotationDetailCapabilities({ ...record, status: '2' }, grant, { username: 'owner' }, () => true).edit, false);
assert.equal(g.quotationDetailCapabilities(record, grant, { username: 'owner' }, () => false).edit, false);
assert.deepEqual(g.quotationDetailFields(record, grant), { cost: false, rate: false, quote: true });
for (const role of ['technicalApplicant', 'technicalManager', 'marketApplicant']) {
  const access = g.normalizeQuotationAccess({ canViewCost: true, canViewRate: true, canViewQuote: true, canEditPrice: true });
  assert.deepEqual(g.quotationDetailFields(record, access), { cost: true, rate: false, quote: true }, role);
}
assert.deepEqual(g.quotationDetailFields(record, g.normalizeQuotationAccess({ canManage: true })), { cost: true, rate: true, quote: true });
assert.deepEqual(g.quotationDetailFields({}, g.noQuotationAccess, true, false), { cost: true, rate: false, quote: false });
assert.deepEqual(g.quotationDetailFields({}, g.noQuotationAccess, true, true), { cost: true, rate: false, quote: true });
const table = fs.readFileSync('src/views/plan/components/MaterialPlanTable.vue', 'utf8');
const ast = ts.createSourceFile('table.ts', sfc.parse(table).descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true);
const columns = ast.statements.find(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(ast) === 'columns'));
const readColumns = new Function('props', 'computed', 'unifyMaterialColumns', 'quantityText',
  ts.transpile(columns.getText(ast)) + '\nreturn columns.value.map(c=>c.key);');
for (const cost of [false, true]) for (const rate of [false, true]) for (const quote of [false, true]) {
  const keys = readColumns({ mode: 'quotation', quotePricing: true, costVisible: cost, rateVisible: rate, priceVisible: quote, directQuotation: true },
    fn => ({ value: fn() }), cols => cols, { value: '数量' });
  assert.equal(keys.includes('basePrice'), cost);
  assert.equal(keys.includes('costTotal'), cost);
  assert.equal(keys.includes('markupRate'), rate);
  assert.equal(keys.includes('finalPrice'), quote);
  assert.equal(keys.includes('quotationPercent'), quote && rate);
}
for (const file of ['src/views/plan/material-draft/editor.vue', 'src/views/plan/components/MaterialPlanTable.vue', 'src/views/plan/components/QuotationServiceFeeCell.vue']) {
  const source = fs.readFileSync(file, 'utf8');
  const { descriptor, errors } = sfc.parse(source);
  assert.deepEqual(errors, []);
  sfc.compileScript(descriptor, { id: file });
  assert.deepEqual(sfc.compileTemplate({ source: descriptor.template.content, filename: file, id: file }).errors, []);
}
const editor = fs.readFileSync('src/views/plan/material-draft/editor.vue', 'utf8');
assert(!editor.includes('access.value.canEditPrice'), 'quotation editor does not consume contract editing grant');
assert(editor.includes(':rate-visible="showGuidanceRate"'));
assert(editor.includes(':cost-visible="showCostTotal"'));
assert(editor.includes('const caps = computed(() => quotationDetailCapabilities'));
console.log('PASS quotation detail: independent contract grant, field matrix, columns and Vue compilation');
