const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { randomUUID } = require('node:crypto');
const code = ts.transpileModule(fs.readFileSync('src/views/operation/inspection/inspection.mock.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const context = { exports: {}, crypto: { randomUUID } };
vm.runInNewContext(code, context);
const m = context.exports;
const state = m.seedState();
assert.equal(state.runs[0].sheets.length, 3);
assert.equal(m.runSummary(state.runs[0]).done, 2);
assert.equal(m.runSummary(state.runs[0]).closure, '待处理');
assert.equal(m.generateRuns(state, state.tasks[0]), 0);
const snapshot = JSON.stringify(state.runs);
const object = m.clone(state.objects[0]);
object.items[0].text = '新版检查内容';
m.saveObject(state, object);
assert.equal(JSON.stringify(state.runs), snapshot, 'templates must not mutate history');
assert.throws(() => m.removeConfig(state, 'objects', 'camera'));
assert.throws(() => m.removeConfig(state, 'points', 'gate'));
assert.throws(() => m.removeConfig(state, 'tasks', 'demo-task'));
const sheet = state.runs[0].sheets[2];
assert.throws(() => m.submitSheet(sheet));
sheet.answers.forEach((a) => (a.result = '正常'));
sheet.conclusion = '正常';
m.submitSheet(sheet);
assert.equal(m.runSummary(state.runs[0]).status, '已完成');
assert.equal(m.runSummary(state.runs[0]).result, '异常');
assert.throws(() => m.submitSheet(sheet));
assert.throws(() => m.closeSheet(sheet, 'admin'));
const abnormal = state.runs[0].sheets[1];
assert.throws(() => m.closeSheet(abnormal, 'admin'));
abnormal.closure = '紧固完成';
m.closeSheet(abnormal, 'admin');
assert.equal(m.runSummary(state.runs[0]).closure, '已办结');
assert.equal(m.runSummary(state.runs[0]).result, '异常');
assert.throws(() => m.closeSheet(abnormal, 'admin'));
const task = m.clone(state.tasks[0]);
task.id = 'new';
task.code = 'RW-NEW';
task.start = '2026-12-20';
task.end = '2027-02-03';
task.times = 2;
m.saveTask(state, task);
assert.equal(m.generateRuns(state, task), 6);
const runs = state.runs.filter((r) => r.taskId === 'new');
assert.equal(runs[0].start, task.start);
assert.equal(runs[5].end, task.end);
assert.throws(() => m.saveTask(state, { ...task, times: 1.5 }));
assert.throws(() => m.saveTask(state, { ...task, end: '2025-01-01' }));
assert.throws(() => m.saveTask(state, { ...task, points: [{ pointId: 'room', quantity: 1 }] }));
assert.throws(() => m.saveObject(state, { ...object, id: 'duplicate' }));
const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc');
const filename = 'src/views/operation/inspection/index.vue';
const source = fs.readFileSync(filename, 'utf8');
const { descriptor, errors } = parse(source);
assert.equal(errors.length, 0);
const script = compileScript(descriptor, { id: 'inspection-test' });
const template = compileTemplate({
  source: descriptor.template.content,
  filename,
  id: 'inspection-test',
  compilerOptions: { bindingMetadata: script.bindings },
});
assert.deepEqual(template.errors, []);
assert.match(source, /username === 'admin'/);
assert.doesNotMatch(source, /defHttp|axios|fetch\(/);
console.log(
  'PASS inspection: generation, duplicate prevention, snapshots, reference protection, date boundaries, validation, submission, closure, admin gate and SFC compile'
);
