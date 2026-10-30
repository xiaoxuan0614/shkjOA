const fs = require('fs'), vm = require('vm'), ts = require('typescript'), sfc = require('@vue/compiler-sfc'), vue = require('vue'), assert = require('node:assert/strict');
const descriptor = sfc.parse(fs.readFileSync('src/views/workflow/components/InstanceDrawer.vue', 'utf8')).descriptor;
let requests = [], generic = [], failure;
const m = { exports: {} };
const deps = {
  vue: { ...vue, watch: () => {}, onBeforeUnmount: () => {} },
  '/@/views/todo/repairAssignment': { reviewCollaboration: async p => { requests.push(JSON.parse(JSON.stringify(p))); if (failure) throw failure; } },
  '../Workflow.api': { handleInstance: async p => generic.push(JSON.parse(JSON.stringify(p))) },
  '../workflow': { newId: () => `request-${requests.length}`, statusLabels: {} },
};
vm.runInNewContext(ts.transpileModule(sfc.compileScript(descriptor, { id: 'repair-routing' }).content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { module: m, exports: m.exports, require: n => deps[n] || {} });
function page(processKey, action, businessType = 'REPAIR_OPS_APPLICATION') {
  const p = m.exports.default.setup({ open: false, instanceId: 'instance' }, { expose() {}, emit() {} });
  p.detail.value = { id: 'instance', businessId: 'application', businessType, processKey, tasks: [{ id: 'task', canHandle: true }] };
  p.actions.value = { tasks: [{ taskId: 'task', actions: ['APPROVE', 'REJECT', 'WITHDRAW'] }] };
  p.pendingTask.value = 'task'; p.pendingAction.value = action; p.comment.value = '审批意见';
  return p;
}
(async () => {
  for (const scene of ['quotation', 'completion', 'close', 'external_collaboration', 'future_scene']) {
    for (const action of ['APPROVE', 'REJECT']) {
      const p = page(`repair_ops_${scene}`, action); await p.submitAction();
      const body = requests.at(-1);
      assert.equal(body.applicationId, 'application'); assert.equal(body.instanceId, 'instance'); assert.equal(body.taskId, 'task');
      assert.equal(body.approve, action === 'APPROVE'); assert.equal(body.comment, '审批意见');
      assert.ok(!('action' in body) && !('version' in body) && !('transferTargetUserId' in body));
    }
  }
  assert.equal(requests.length, 10); assert.equal(generic.length, 0);
  const retry = page('repair_ops_close', 'APPROVE'); failure = Error('network'); await retry.submitAction();
  const original = requests.at(-1); retry.comment.value = ' changed'; await retry.submitAction(); assert.deepEqual(requests.at(-1), original);
  failure = Object.assign(Error('validation'), { definite: true }); await retry.submitAction(); assert.equal(retry.pendingRequest.value, undefined); failure = undefined;
  const missing = page('repair_ops_close', 'APPROVE'); missing.detail.value.businessId = ''; const count = requests.length; await missing.submitAction(); assert.equal(requests.length, count);
  const rejected = page('repair_ops_close', 'REJECT'); rejected.comment.value = ''; await rejected.submitAction(); assert.equal(requests.length, count);
  await page('other', 'APPROVE', 'WORKFLOW_FORM').submitAction(); assert.equal(generic.at(-1).action, 'APPROVE');
  await page('repair_ops_close', 'WITHDRAW').submitAction(); assert.equal(generic.at(-1).action, 'WITHDRAW'); assert.equal(generic.length, 2);
  console.log('PASS repair review routing: all repair decisions, payload, retry, validation, other workflows and withdrawal');
})().catch(e => { console.error(e); process.exitCode = 1; });
