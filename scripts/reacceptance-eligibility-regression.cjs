const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), ts = require('typescript');
const pc = fs.readFileSync('src/views/project/detail/components/DetailAcceptance.vue', 'utf8');
assert.ok(!pc.includes('title="最近一次驳回"'));
assert.match(pc, /getAcceptanceMeta\(card.model\).text[\s\S]*?accept-card__rejection[\s\S]*?lastRejected\(card.type\).remark/);
const functions = pc.slice(pc.indexOf('  function applicationSummary('), pc.indexOf('  const normalApplicationLabel'));
const context = { internal: {}, customer: {}, latestStatus: { value: {} }, loading: { value: false }, recordsReady: { value: true }, applicationReady: { value: true }, acceptedManager: { value: true }, canStartAcceptance: () => true, props: { project: { status: 'FAILED', currentReworkId: 'r' } } };
vm.createContext(context);
vm.runInContext(ts.transpileModule(functions, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, context);
for (const status of ['FAILED', 'PENDING_REACCEPTANCE', 'PASSED', 'REWORKING', 'REWORK_PENDING_APPROVAL', 'REACCEPTING']) {
  for (const flag of [true, false, undefined, 'true']) {
    context.latestStatus.value = { canSubmitReacceptance: flag, internal: { status } };
    assert.equal(context.canRequestRecheck(context.internal), flag === true && status === 'FAILED');
    assert.equal(context.canRequestNormal(context.internal), flag === true && status === 'PENDING_REACCEPTANCE');
  }
}
context.latestStatus.value = { canSubmitReacceptance: true, internal: { status: 'FAILED' } };
context.loading.value = true;
assert.equal(context.canRequestRecheck(context.internal), false);
context.loading.value = false;
context.latestStatus.value = { internal: { status: 'FAILED', canSubmitReacceptance: true } };
assert.equal(context.canRequestRecheck(context.internal), false, '旧内层资格不得放行');
context.latestStatus.value = { canSubmitReacceptance: true, internal: { status: 'PASSED' }, customer: { status: 'FAILED' } };
assert.equal(context.canRequestRecheck(context.internal), false);
assert.equal(context.canRequestRecheck(context.customer), true);
context.latestStatus.value.internal.lastRejectedAcceptance = { remark: '旧驳回' };
context.latestStatus.value.customer.lastRejectedAcceptance = { remark: '待整改' };
assert.equal(context.lastRejected('INTERNAL'), null);
assert.equal(context.lastRejected('CUSTOMER').remark, '待整改');
const mobileRoot = '/Users/xuan/AI/ClaudeAllData/SHKKJ-uniapp/';
const mobile = fs.readFileSync(mobileRoot + 'src/pages/ops/components/ProjectAcceptancePopup.vue', 'utf8');
assert.ok(mobile.includes('acceptanceApi.latestStatus(periodId.value)'));
assert.ok(!mobile.includes('readAcceptanceRecords('));
assert.ok(mobile.includes("canSubmitReacceptance === true && summaryFor(type)?.status === 'FAILED'"));
assert.ok(mobile.includes("canSubmitReacceptance === true && summaryFor(type)?.status === 'PENDING_REACCEPTANCE'"));
assert.ok(!mobile.includes("project.value = {...project.value, status: 'ACCEPTING'"));
const sfc = require('@vue/compiler-sfc');
for (const file of ['src/views/project/detail/components/DetailAcceptance.vue', 'src/views/project/index.vue', mobileRoot + 'src/pages/ops/components/ProjectAcceptancePopup.vue', mobileRoot + 'src/pages/ops/projectDetail.vue']) {
  const { descriptor, errors } = sfc.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(errors.length, 0);
  sfc.compileScript(descriptor, { id: file });
  assert.deepEqual(sfc.compileTemplate({ source: descriptor.template.content, filename: file, id: file }).errors, []);
}
console.log('复审资格/模式/已通过与返工中排除、移动端最新状态接入及四个SFC检查通过');
