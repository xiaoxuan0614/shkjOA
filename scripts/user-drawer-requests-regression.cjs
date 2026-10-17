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
const cyclicLabel = { props: { title: '市场部' } };
cyclicLabel.component = cyclicLabel;
assert.deepEqual(departments.userDepartmentOptions([{ value: 'd', label: cyclicLabel }]), [{ value: 'd', label: '市场部' }]);
assert.deepEqual(departments.userDepartmentOptions([{ value: 'd', label: { children: ['市', { children: '场部' }] } }]), [{ value: 'd', label: '市场部' }]);
assert.deepEqual(departments.userDepartmentOptions([]), []);
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
  assert.match(schema, /field: 'selectedroles',\s+required: true,/, '新增和编辑用户必须选择角色');
  // 执行公共表单实际使用的必填校验，覆盖首次未选及清空多选。
  const formItem = fs.readFileSync('src/components/Form/src/components/FormItem.vue', 'utf8');
  const validatorSource = formItem.match(/function validator\(rule: any, value: any\) \{[\s\S]*?\n        \}/)[0];
  const validateRequired = new Function('isNull', 'defaultMsg', ts.transpile(`${validatorSource}\nreturn validator;`))(
    value => value === null, '请选择角色'
  );
  for (const value of [undefined, null, '', [], ' ']) {
    await assert.rejects(validateRequired({}, value), error => error === '请选择角色');
  }
  await validateRequired({}, ['role-1']);
  await validateRequired({}, ['role-1', 'role-2']);
  assert(!schema.includes('getDepartPathNameByOrgCode'));
  assert.equal((schema.match(/isCustomRenderTag: false/g) || []).length, 3);
  const filename = 'src/views/system/user/UserDrawer.vue';
  const sourceVue = fs.readFileSync(filename, 'utf8');
  assert(!sourceVue.includes('options: departOptions }'), '表单配置不能持有部门Ref');
  assert(sourceVue.includes('options: departOptions.value.map(({ label, value }) => ({ label, value }))'));
  assert(sourceVue.includes('if (!ready.value || !showFooter.value) return;'));
  assert(sourceVue.indexOf('await validate()') < sourceVue.indexOf('await saveOrUpdateUser('), '校验通过后才保存');
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
