const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, dependencies = {}) {
  const out = {};
  new Function('require', 'exports', ts.transpile(fs.readFileSync(file, 'utf8'), { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }))(
    (name) => dependencies[name], out
  );
  return out;
}
const departments = load('src/views/system/user/userDepartment.ts');
const { advancedUserFields, mergeUserFormValues } = load('src/views/system/user/userFormSections.ts');
const fields = ['id', 'email', 'mainDepPostId', 'otherDepPostId', 'sort'].map(field => ({ field }));
assert.deepEqual(mergeUserFormValues(fields,
  { id: 'u', email: 'old@example.com', mainDepPostId: 'p', otherDepPostId: ['q'], sort: 9, extra: 'omit' },
  { email: '', otherDepPostId: [], sort: 0 }, { id: 'u' }),
  { id: 'u', email: '', mainDepPostId: 'p', otherDepPostId: [], sort: 0 });
assert(advancedUserFields.has('mainDepPostId'));
assert(advancedUserFields.has('positionType'));
assert(!advancedUserFields.has('selecteddeparts'));
assert(!advancedUserFields.has('departIds'));
const { loadUserDrawerRecord } = load('src/views/system/user/userDrawerLoader.ts', { './userDepartment': departments });
(async () => {
  let calls = 0;
  const getDepartments = async () => { calls++; return [{ key: 'd1', title: '部门一' }]; };
  const getRoles = async () => ['r1', 'r2'];
  const source = { id: 'u1', belongDepIds: 'd1,d2', departIds: ['d1'], sort: 20 };
  const before = JSON.stringify(source);
  const loaded = await loadUserDrawerRecord(source, getRoles, getDepartments);
  assert.equal(calls, 0);
  assert.equal(loaded.record.selecteddeparts, 'd1,d2');
  assert.deepEqual(loaded.record.selectedroles, ['r1', 'r2']);
  assert.equal(JSON.stringify(source), before);
  assert.notEqual(loaded.record.departIds, source.departIds);
  for (const belongDepIds of ['', null]) {
    assert.equal((await loadUserDrawerRecord({ id: 'u1', belongDepIds }, getRoles, getDepartments)).record.selecteddeparts, '');
  }
  assert.equal(calls, 0);
  assert.equal((await loadUserDrawerRecord({ id: 'u1' }, getRoles, getDepartments)).options[0].label, '部门一');
  assert.equal(calls, 1);
  await assert.rejects(loadUserDrawerRecord(source, async () => { throw Error('failed'); }, getDepartments));
  const schema = fs.readFileSync('src/views/system/user/user.data.ts', 'utf8');
  assert(!schema.includes('getDepartPathNameByOrgCode'));
  assert.equal((schema.match(/isCustomRenderTag: false/g) || []).length, 3);
  const filename = 'src/views/system/user/UserDrawer.vue';
  const sourceVue = fs.readFileSync(filename, 'utf8');
  assert(sourceVue.includes('if (!ready.value || !showFooter.value) return;'));
  assert(sourceVue.includes('advancedOpen.value &&'));
  assert(sourceVue.includes('api: loadRoleOptions'));
  assert(sourceVue.includes('rolesRequest = undefined;'));
  assert(!schema.includes('// 查询失败时，清空所有岗位选择'));
  const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc');
  const { descriptor } = parse(sourceVue);
  compileScript(descriptor, { id: 'user-drawer' });
  assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename, id: 'user-drawer' }).errors, []);
  console.log('User drawer request, preservation, failure and SFC checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
