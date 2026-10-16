const fs = require('node:fs'), assert = require('node:assert/strict'), ts = require('typescript');
const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc');
function moduleFrom(path, dependencies = {}) {
  const exports = {};
  new Function('require', 'exports', ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(name => dependencies[name], exports);
  return exports;
}
const arrival = moduleFrom('src/views/project/arrivalPayment.ts');
const { resolvePeriodOperations: resolve, canApplySupplement } = moduleFrom('src/views/project/detail/periodOperations.ts', { '../arrivalPayment': arrival });
const project = { periodId: 'p', status: 'IMPLEMENTING', arrivalStatus: 0, projectType: 'HARDWARE' };
const access = (manager = false, codes = []) => ({ manager, typeNames: { HARDWARE: '硬件', SOFTWARE: '软件' }, hasPermission: code => codes.includes(code) });
const keys = (p, a) => resolve(p, a).map(x => x.key);
assert.deepEqual(keys(project, access()), []);
assert.equal(canApplySupplement('IMPLEMENTING', false), false, 'administrator/approver without membership cannot apply');
assert.equal(canApplySupplement('IMPLEMENTING', true), true);
for (const state of ['NOT_STARTED', 'PREPARING', 'PENDING_APPROVAL', 'WARRANTY', 'CLOSED', 'COMPLETED']) assert.equal(canApplySupplement(state, true), false);
assert.deepEqual(keys(project, access(true)), ['supplement']);
assert.equal(resolve(project, access(false, ['project:materialApply:approve']))[0].label, '补料审批记录');
assert.deepEqual(keys({ ...project, status: 'NOT_STARTED' }, access(false, ['project:materialApply:approve'])), []);
assert.ok(keys(project, access(true, ['project:arrival:confirm'])).includes('arrival'));
assert.ok(!keys({ ...project, arrivalStatus: 1 }, access(true, ['project:arrival:confirm'])).includes('arrival'));
assert.ok(!keys({ ...project, projectType: 'SOFTWARE' }, access(true, ['project:arrival:confirm'])).includes('arrival'));
assert.deepEqual(keys(project, access(false, ['project:implement'])), ['process']);
assert.deepEqual(keys({ ...project, status: 'REWORKING' }, access(false, ['project:implement'])), ['process']);
assert.ok(keys({ ...project, status: 'ACCEPTING' }, access(false, ['project:internalAccept'])).includes('acceptance'));
assert.deepEqual(keys({ ...project, status: 'WARRANTY' }, access(false, ['project:warranty', 'project:close'])), ['complete', 'close']);
for (const status of ['CLOSED', 'COMPLETED']) assert.deepEqual(keys({ ...project, status }, access(false, ['project:warranty', 'project:close'])), []);
for (const path of ['src/views/project/detail/components/PeriodOperations.vue', 'src/views/project/components/MaterialSupplementDrawer.vue', 'src/views/payment/FinanceDetail.vue']) {
  const { descriptor } = parse(fs.readFileSync(path, 'utf8'));
  const script = compileScript(descriptor, { id: 'ops' });
  assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename: path, id: 'ops', compilerOptions: { bindingMetadata: script.bindings } }).errors, []);
}
const drawer = fs.readFileSync('src/views/project/components/MaterialSupplementDrawer.vue', 'utf8');
assert.match(drawer, /async function startCreate\(\)[\s\S]*?await checkCreateAccess\(\)/);
assert.match(drawer, /submitting.value = true;[\s\S]*?await checkCreateAccess\(\)[\s\S]*?await addProjectMaterialApplies/);
assert.match(drawer, /readProjectMembership\(id, userId\)/);
const detail = fs.readFileSync('src/views/project/detail/index.vue', 'utf8');
assert.match(detail, /activeKey === 'payment'/);
assert.match(detail, /canRequestFinance\(userStore.getIdentity.roleCodes\)/);
assert.match(detail, /:period-id="projectId" :context="project" embedded/);
const ops = fs.readFileSync('src/views/project/detail/components/PeriodOperations.vue', 'utf8');
assert.match(ops, /await projectDetail/);
assert.match(ops, /key === 'close' \? 'CLOSED' : 'COMPLETED'/);
const list = fs.readFileSync('src/views/project/index.vue', 'utf8');
assert.ok(!list.includes('getCurrentParticipatedProjects'));
assert.ok(!list.includes('ProcessCompletionDrawer'));
assert.match(list, /function handleDetail\(record: Recordable\)/, 'list detail callback remains defined');
console.log('PASS period operations role/stage matrix, supplement guards, lazy finance and SFCs');
