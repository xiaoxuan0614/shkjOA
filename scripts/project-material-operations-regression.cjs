const fs = require('node:fs'), assert = require('node:assert/strict'), ts = require('typescript');
const sfc = require('@vue/compiler-sfc');
function load(file, imports = {}) {
  const result = {};
  const source = fs.readFileSync(file, 'utf8');
  new Function('exports', 'require', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(result, id => imports[id] || require(id));
  return result;
}
const approval = load('src/utils/approvalStatus.ts');
const { projectMaterialOperations: actions, hasApplicationMenu } = load('src/views/project/detail/materialOperations.ts', { '/@/utils/approvalStatus': approval });
const menus = [{ path: '/material', children: [{ path: 'pick' }, { path: 'return' }] }];
const p = { periodId: 'p', status: 'IMPLEMENTING', planStatus: '1', arrivalStatus: 0 };
assert.deepEqual(actions(p, true, menus).map(a => a.key), ['pick', 'return']);
assert.deepEqual(actions({ ...p, projectType: '软件', arrivalStatus: 1 }, true, menus).map(a => a.key), ['pick', 'return']);
assert.deepEqual(actions(p, false, menus), []);
assert.deepEqual(actions(p, true, []), []);
for (const status of ['-1', '0', '2', '3', undefined, null, '', 'unknown']) {
  for (const stage of ['PREPARING', 'IMPLEMENTING', 'REWORKING', 'WARRANTY', 'COMPLETED', 'CLOSED']) {
    assert.deepEqual(actions({ ...p, status: stage, planStatus: status, approvalStatus: '1' }, true, menus).map(a => a.key), []);
  }
}
assert.deepEqual(actions({ ...p, status: 'PREPARING' }, true, menus).map(a => a.key), ['pick', 'return']);
assert.deepEqual(actions({ ...p, status: 'PREPARING', planStatus: 1, approvalStatus: '0' }, true, menus).map(a => a.key), ['pick', 'return']);
assert.deepEqual(actions(p, true, [{ path: '/material/pick' }]).map(a => a.key), ['pick']);
assert.deepEqual(actions(p, true, [{ path: '/material/return' }]).map(a => a.key), ['return']);
assert.deepEqual(actions({ ...p, periodId: '' }, true, menus), []);
for (const status of ['CLOSED', 'COMPLETED', 'WARRANTY']) assert.deepEqual(actions({ ...p, status }, true, menus).map(a => a.key), ['return']);
for (const status of ['NOT_STARTED', 'PENDING_APPROVAL', 'unknown']) assert.deepEqual(actions({ ...p, status }, true, menus), []);
assert(hasApplicationMenu([{ path: '/material/pick' }], '/material/pick'));
assert(!hasApplicationMenu([{ path: '/material/pick-other' }], '/material/pick'));
const detail = fs.readFileSync('src/views/project/detail/index.vue', 'utf8');
assert(detail.includes('participant.value = membership.participant'));
assert(detail.includes(':participant="participant"'));
const operations = fs.readFileSync('src/views/project/detail/components/PeriodOperations.vue', 'utf8');
const sharedOperations = fs.readFileSync('src/views/project/detail/periodOperations.ts', 'utf8');
assert(sharedOperations.includes("String(project.arrivalStatus) === '0'"));
assert(!sharedOperations.includes('planStatus'));
assert(operations.includes('from: route.fullPath'));
assert(!operations.includes('填写日志') && !operations.includes('实施打卡'));
const pick = fs.readFileSync('src/views/material/pick/index.vue', 'utf8');
assert(pick.includes("String(saved?.periodId || '') !== requestedPeriodId"));
assert(pick.includes('该项目不在当前可领料范围'));
for (const file of ['src/views/project/detail/index.vue', 'src/views/project/detail/components/PeriodOperations.vue', 'src/views/project/detail/components/ProjectDelayApply.vue', 'src/views/material/pick/index.vue']) {
  const { descriptor, errors } = sfc.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(errors, []);
  const script = sfc.compileScript(descriptor, { id: file });
  assert.deepEqual(sfc.compileTemplate({ source: descriptor.template.content, filename: file, id: file, compilerOptions: { bindingMetadata: script.bindings } }).errors, []);
}
// Execute the real process-selection filter, including current rework and deleted rows.
const delaySource = sfc.parse(fs.readFileSync('src/views/project/detail/components/ProjectDelayApply.vue', 'utf8')).descriptor.scriptSetup.content;
const ast = ts.createSourceFile('delay.ts', delaySource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const filter = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'eligibleProcesses').getText(ast);
const code = ts.transpileModule(filter, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
const eligible = new Function(`${code}; return eligibleProcesses;`)();
const process = { id: '1', periodId: 'p', status: 'IN_PROGRESS', plannedEndTime: '2026-10-20', reworkId: 'r' };
assert.equal(eligible([process], { periodId: 'p', currentReworkId: 'r' }).length, 1);
for (const row of [{ ...process, periodId: 'other' }, { ...process, status: 'COMPLETED' }, { ...process, delFlag: 1 }, { ...process, reworkId: 'old' }, { ...process, plannedEndTime: null }]) assert.equal(eligible([row], { periodId: 'p', currentReworkId: 'r' }).length, 0);
console.log('PASS project material operation identity/menu/stage matrix, route context, delay round filter and SFC compilation');
