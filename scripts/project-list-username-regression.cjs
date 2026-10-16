const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const calls = [];
function load(file, dependencies) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, require: (id) => {
    if (!(id in dependencies)) throw new Error(`Unexpected import: ${id}`);
    return dependencies[id];
  } });
  return exports;
}
const filters = load('src/views/project/projectListFilters.ts', {});
const api = load('src/views/project/Project.api.ts', {
  '/@/utils/documentUpload': {},
  '/@/utils/http/axios': { defHttp: { get: (request) => { calls.push(request); return Promise.resolve({ records: [] }); } } },
  '/@/enums/httpEnum': { ContentTypeEnum: {} },
  './projectListFilters': filters,
});
(async () => {
  await api.projectList({ username: 'anotherUser', pageNo: 2, status: ['NEW', 'IMPLEMENTING'], arrivalStatus: [0] });
  assert.equal(calls[0].url, '/project/project/projectPeriodList');
  assert.equal(Object.hasOwn(calls[0].params, 'username'), false);
  assert.equal(calls[0].params.pageNo, 2);
  assert.equal(calls[0].params.status, 'NEW,IMPLEMENTING');
  assert.equal(calls[0].params.arrivalStatus, '0');
  await api.projectList({});
  assert.equal(Object.hasOwn(calls[1].params, 'username'), false);
  const input = { username: 'admin', pageSize: 20 };
  await api.projectList(input);
  assert.equal(Object.hasOwn(calls[2].params, 'username'), false);
  assert.equal(calls[2].params.pageSize, 20);
  assert.equal(input.username, 'admin');
  assert.equal(calls.length, 3);
  console.log('PASS project list omits username, preserves paging/filters and does not mutate callers');
})().catch((error) => { console.error(error); process.exitCode = 1; });
