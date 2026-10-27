const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), ts = require('typescript');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/views/workflow/repairDetailLink.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: exportsObject });
const { repairApprovalOrderId: repairCloseOrderId } = exportsObject;
const instance = { businessType: 'REPAIR_OPS_APPLICATION', processKey: 'repair_ops_close', businessId: 'application-id', fieldPermissions: {} };
assert.equal(repairCloseOrderId(instance, { orderId: ' order-id ' }), 'order-id');
assert.equal(repairCloseOrderId(instance, {}), '', 'never use application ID as order ID');
assert.equal(repairCloseOrderId(instance, { orderId: {} }), '');
assert.equal(repairCloseOrderId(instance, { orderId: ' ' }), '');
assert.equal(repairCloseOrderId(undefined, { orderId: 'order-id' }), '');
for (const processKey of ['repair_ops_close', 'repair_ops_transfer', 'repair_ops_collaboration', 'repair_ops_external', 'repair_ops_completion', 'future_repair_scene']) {
  assert.equal(repairCloseOrderId({ ...instance, processKey }, { orderId: 'order-id' }), 'order-id');
}
assert.equal(repairCloseOrderId({ ...instance, businessType: 'WORKFLOW_FORM' }, { orderId: 'order-id' }), '');
assert.equal(repairCloseOrderId({ ...instance, fieldPermissions: { orderId: 'HIDDEN' } }, { orderId: 'order-id' }), '');
const source = fs.readFileSync('src/views/workflow/components/InstanceDrawer.vue', 'utf8');
assert.ok(source.includes('查看维修单详情'));
assert.ok(source.includes('repairApprovalOrderId(detail.value, visibleSnapshot.value)'));
assert.ok(source.includes('v-if="isRepairApproval"'));
assert.ok(source.includes('<RepairDetail v-if="repairDetailId" :id="repairDetailId" @close="repairDetailId = \'\'" />'));
assert.ok(source.includes('props.open, props.instanceId, linkedRepairId.value'));
console.log('PASS all repair approval detail links, identity, visibility and lifecycle');
