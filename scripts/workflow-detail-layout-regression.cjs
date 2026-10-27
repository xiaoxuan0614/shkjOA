const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const ts = require('typescript'), vue = require('@vue/compiler-sfc');
function load(file) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports });
  return exports;
}
const display = load('src/views/workflow/snapshotPresentation.ts');
assert.equal(display.snapshotText(0), '0');
assert.equal(display.snapshotText(false), '否');
assert.equal(display.snapshotText(null), '—');
assert.equal(display.snapshotText('OTHER', 'form.closeType'), '其他');
assert.equal(display.snapshotValue('{"reason":"现场支持"}').reason, '现场支持');
assert.equal(display.snapshotValue('[1,2]').length, 2);
assert.equal(display.snapshotValue('{普通文本'), '{普通文本');
assert.equal(display.snapshotText('第一行\n第二行'), '第一行\n第二行');
const entries = display.snapshotEntries({ reason: '协助', unitName: '外协公司', personCount: 3, estimatedTotalHours: 24 }, 'form', [], {});
assert.equal(entries.map(item => item.label).join(','), '申请原因,外协单位,申请人数,预计总工时（小时）');
assert.equal(display.snapshotEntries({ reason: '转交' }, 'form', [{ key: 'form.reason', name: '转单原因' }], {})[0].label, '转单原因');
assert.equal(display.snapshotEntries({ costPrice: 100 }, 'items[]', [], { 'items.costPrice': 'HIDDEN' }).length, 0);
assert.equal(display.snapshotEntries({ reason: 'private' }, 'form', [], { form: 'HIDDEN' }).length, 0);
assert.equal(display.snapshotEntries({ userId: 'id', userName: '王先生' }, 'form', [], {}).length, 1);
assert.equal(display.snapshotEntries({ userId: 'id', userName: '' }, 'form', [], {}).length, 2);
const external = { orderId: 'repair-1', form: { requestId: 'transport', roleId: null, unitName: '外协公司', personCount: 3, estimatedTotalHours: 24, reason: '现场排障' }, 'form.unitName': '外协公司' };
const externalRows = display.applicationRows(external, [], {}, 'repair_ops_external');
assert.equal(externalRows.length, 5);
assert.equal(externalRows.map(row => row.field.name).join(','), '维修单编号,外协单位,申请人数,预计总工时（小时）,需要协助原因：');
const approvalSource = fs.readFileSync('src/views/workflow/components/InstanceDrawer.vue', 'utf8');
assert.equal((approvalSource.match(/需要协助原因：/g) || []).length, 2, 'application and approval selection show reason labels');
assert.ok(fs.readFileSync('src/views/todo/components/RepairAssignmentModal.vue', 'utf8').includes('label="需要协助原因："'));
assert.ok(!JSON.stringify(externalRows).includes('transport'));
assert.equal(display.applicationRows(external, [], { 'form.reason': 'HIDDEN' }, 'repair_ops_external').length, 4);
assert.equal(display.applicationRows(external, [], { form: 'HIDDEN' }, 'repair_ops_external').length, 1);
assert.equal(display.applicationRows({ 'form.reason': '重新接单', 'form.targetUserId': 'user-1' }, [], {}, 'repair_ops_transfer').length, 2);
assert.equal(display.applicationRows({ custom: 0 }, [{ key: 'custom', name: '自定义金额', type: 'number' }], {}, 'custom')[0].value, 0);

const { visibleTaskButtons } = load('src/views/workflow/taskPresentation.ts');
const buttons = ['APPROVE','REJECT','COMPLETE','TRANSFER','RESOLVE','REASSIGN','EDIT_DATA'].map(value => ({ value, label: value }));
const allowed = { actions: buttons.map(item => item.value) };
const task = { id: 'a', kind: 'APPROVAL', canHandle: true };
assert.equal(visibleTaskButtons(buttons, task, allowed, 'REPAIR_OPS_APPLICATION').length, buttons.length);
assert.equal(visibleTaskButtons(buttons, task, undefined).length, 0);
assert.equal(visibleTaskButtons(buttons, { ...task, canHandle: false }, { actions: ['APPROVE','REJECT','COMPLETE'] }).length, 0);
assert.equal(visibleTaskButtons(buttons, { ...task, canHandle: false }, { actions: ['REASSIGN'] })[0].value, 'REASSIGN');
assert.equal(visibleTaskButtons(buttons, { ...task, kind: 'WORK' }, { actions: ['APPROVE','REJECT','COMPLETE'] })[0].value, 'COMPLETE');
assert.equal(visibleTaskButtons(buttons, task, { actions: ['RESOLVE'] })[0].value, 'RESOLVE');
assert.equal(visibleTaskButtons(buttons, task, { actions: ['EDIT_DATA'] }, 'PROJECT_CONTRACT').length, 0);

for (const name of ['InstanceDrawer','BusinessSnapshotValue','SnapshotContent']) {
  const filename = `src/views/workflow/components/${name}.vue`;
  const source = fs.readFileSync(filename, 'utf8');
  const { descriptor, errors } = vue.parse(source, { filename });
  assert.equal(errors.length, 0);
  const script = vue.compileScript(descriptor, { id: name });
  const compiled = vue.compileTemplate({ source: descriptor.template.content, filename, id: name, compilerOptions: { bindingMetadata: script.bindings } });
  assert.equal(compiled.errors.length, 0);
  assert.doesNotMatch(descriptor.template.content, /JSON\.stringify|<pre\b/);
  if (name === 'InstanceDrawer') {
    assert.match(source, /<a-tabs v-model:active-key="detailTab"/);
    assert.match(source, /<ApprovalProgress :instance="detail" compact \/>/);
    assert.doesNotMatch(source, /#task=/);
    assert.match(source, /v-if="approvalTasks.length"/);
    assert.match(source, /tasks.length === 1 \? tasks\[0\].id : undefined/);
  }
}
console.log('PASS workflow detail tabs, readable snapshots, hidden fields and footer action permissions');
