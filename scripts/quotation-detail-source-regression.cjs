const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const source = fs.readFileSync('src/views/plan/Plan.api.ts', 'utf8');
const calls = [];
let candidate = { id: 'q1', periodId: 'p1', version: 3, status: '-1', adopted: 0, priced: 0 };
const http = { get: async ({ url, params }) => {
  calls.push({ url, params });
  assert.equal(url, '/project/materialCandidateItem/list');
  return { candidate, records: [{ id: params.pageNo }], serviceFees: [], pages: 2, size: 1000 };
} };
const api = {};
new Function('exports', 'require', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(api, id => {
  if (id.endsWith('quotationGovernance')) return { quotationVersion: value => { assert(Number.isInteger(value)); return value; } };
  if (id.endsWith('http/axios')) return { defHttp: http };
  if (id.endsWith('httpEnum')) return { ContentTypeEnum: {} };
  if (id.endsWith('projectListFilters')) return {};
  throw Error(id);
});
(async () => {
  let first;
  assert.equal((await api.getCandidateRecord('p1', 'q1', page => { first = page; })).version, 3);
  let fees;
  assert.deepEqual(await api.getAllMaterialCandidateItems('q1', rows => { fees = rows; }, first), [{ id: 1 }, { id: 2 }]);
  assert.deepEqual(fees, []);
  assert.deepEqual(calls.map(call => call.params.pageNo), [1, 2], '主单与明细共用首页');
  await api.getCandidateRecord('p1', 'q1');
  assert.equal(calls.length, 3, '版本核对重新查询，不使用全局缓存');
  candidate = { ...candidate, periodId: 'wrong' };
  await assert.rejects(api.getCandidateRecord('p1', 'q1'), /不匹配/);
  candidate = undefined;
  await assert.rejects(api.getCandidateRecord('p1', 'q1'), /缺失/);
  const editor = fs.readFileSync('src/views/plan/material-draft/editor.vue', 'utf8');
  assert(!editor.includes('projectDetail'));
  assert(!editor.includes('getQuotationDepartments'));
  assert(editor.includes('userStore.getLoginInfo.departs'));
  assert(editor.includes(':initial-candidate-page="initialCandidatePage"'));
  console.log('PASS quotation detail source, first-page reuse, fresh version and missing/mismatched candidate guards');
})().catch(error => { console.error(error); process.exitCode = 1; });
