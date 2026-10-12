const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const vue = require('@vue/compiler-sfc');
const source = fs.readFileSync('src/views/plan/Plan.api.ts', 'utf8');
const calls = [];
const context = { exports: {}, require: (id) => id.includes('axios') ? { defHttp: { get: async (request) => {
  calls.push(request);
  return { records: [{ projectId: 'p', periodId: `period-${request.params.pageNo}`, projectName: '主项目', periodName: '分期' }], pages: 2 };
} } } : {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context);
(async () => {
  const rows = await context.exports.getQuotationPeriods();
  assert.equal(rows.length, 2);
  assert.equal(rows[1].periodId, 'period-2');
  assert.equal(calls.length, 2);
  for (const request of calls) {
    assert.equal(request.url, '/project/period/searchByName');
    assert.equal(request.params.contractStatus, undefined);
    assert.equal(request.params.username, undefined);
  }
  const filename = 'src/views/plan/material-draft/index.vue';
  const { descriptor } = vue.parse(fs.readFileSync(filename, 'utf8'));
  vue.compileScript(descriptor, { id: 'quotation-project' });
  assert.deepEqual(vue.compileTemplate({ source: descriptor.template.content, filename, id: 'quotation-project' }).errors, []);
  assert.match(descriptor.scriptSetup.content, /value: String\(item.periodId\)/);
  assert.match(descriptor.scriptSetup.content, /periodId: selectedPeriodId.value/);
  assert.match(descriptor.scriptSetup.content, /assertPermission\(PERMISSIONS.add\)/);
  const ast = ts.createSourceFile('index.ts', descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true);
  const nameFunction = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'defaultCandidateName');
  const makeName = new Function('periodOptions', ts.transpile(nameFunction.getText(ast)) + '\nreturn defaultCandidateName;')({ value: [
    { value: 'one', projectName: '主项目', periodName: '一期' }, { value: 'two', projectName: '主项目', periodName: '二期' },
  ] });
  assert.equal(makeName('one'), '主项目一期报价单');
  assert.equal(makeName('two'), '主项目二期报价单');
  assert.equal(makeName(undefined), '');
  console.log('PASS quotation project selector: searchByName, pagination, period identity, unchanged permission and SFC');
})().catch(error => { console.error(error); process.exitCode = 1; });
