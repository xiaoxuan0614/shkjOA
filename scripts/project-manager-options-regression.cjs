const fs = require('node:fs'), assert = require('node:assert/strict'), ts = require('typescript');
const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc');
let calls = [], roles = [{ id: 'manager-role', roleCode: 'project_management' }], failed = false;
const api = { get: async req => {
  calls.push(req);
  if (failed) throw Error('offline');
  if (req.url === '/sys/role/list') return { records: roles };
  assert.equal(req.url, '/sys/user/userRoleList');
  assert.equal(req.params.roleId, 'manager-role');
  return { records: [{ id: String(req.params.pageNo), realname: 'manager' }], total: 101 };
} };
const exportsObject = {};
new Function('exports', 'require', ts.transpileModule(fs.readFileSync('src/views/resource/projectManagerOptions.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText)(exportsObject, () => ({ defHttp: api }));
(async () => {
  assert.equal((await exportsObject.loadProjectManagerOptions()).length, 2);
  assert.equal(calls.length, 3);
  assert.deepEqual(calls.slice(1).map(call => call.params.pageNo), [1, 2]);
  roles = []; calls = [];
  await assert.rejects(exportsObject.loadProjectManagerOptions(), /角色/);
  assert.equal(calls.length, 1);
  failed = true; await assert.rejects(exportsObject.loadProjectManagerOptions(), /offline/);
  for (const filename of ['src/views/project/contract/index.vue', '../SHKKJ-uniapp/src/pages/home/components/ContractManagerPicker.vue']) {
    const { descriptor, errors } = parse(fs.readFileSync(filename, 'utf8'), { filename });
    assert.deepEqual(errors, []);
    const script = compileScript(descriptor, { id: 'manager' });
    assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename, id: 'manager', compilerOptions: { bindingMetadata: script.bindings } }).errors, []);
  }
  const mobile = fs.readFileSync('../SHKKJ-uniapp/src/service/contractApproval.ts', 'utf8');
  assert(mobile.includes('/sys/user/userRoleList'));
  assert(!mobile.includes('/sys/user/list'));
  console.log('PASS manager role lookup, paginated users, errors and PC/mobile Vue compilation');
})().catch(error => { console.error(error); process.exitCode = 1; });
