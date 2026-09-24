const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const calls = [];
const user = { getUserInfo: { username: ' userA ' } };
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
  '/@/store/modules/user': { useUserStoreWithOut: () => user },
});
(async () => {
  await api.projectList({ username: 'anotherUser', pageNo: 2, status: ['NEW', 'IMPLEMENTING'], arrivalStatus: [0] });
  assert.equal(calls[0].url, '/project/project/projectPeriodList');
  assert.equal(calls[0].params.username, 'userA');
  assert.equal(calls[0].params.pageNo, 2);
  assert.equal(calls[0].params.status, 'NEW,IMPLEMENTING');
  assert.equal(calls[0].params.arrivalStatus, '0');
  user.getUserInfo.username = 'userB';
  await api.projectList({});
  assert.equal(calls[1].params.username, 'userB');
  user.getUserInfo.username = '';
  await assert.rejects(api.projectList({ username: 'admin' }), /登录用户名缺失/);
  assert.equal(calls.length, 2);
  console.log('Current username, caller override protection, account switch and missing identity request blocking passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
