const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const ts = require('typescript'), sfc = require('@vue/compiler-sfc');
const root = 'src/layouts/default/header/components/notify/';
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(root + 'notificationTodo.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
const parse = context.exports.notificationTodo;
assert.equal(parse({ msgAbstract: '普通通知' }), null);
assert.equal(parse({ msgAbstract: '{}' }), null);
const todo = parse({ titile: '待验收', msgAbstract: JSON.stringify({ businessType: 'TODO', todoId: 't', todoType: 'PROJECT_ACCEPTANCE_PENDING', bizId: 'a', bizSubId: 'p', actionKey: 'PROJECT_ACCEPTANCE_HANDLE', actionParams: JSON.stringify({ periodId: 'p', acceptType: 'INTERNAL', url: '//evil.example', path: '/other' }) }) });
assert.equal(todo.bizId, 'a');
assert.equal(todo.actionParams.periodId, 'p');
assert.equal(todo.actionParams.acceptType, 'INTERNAL');
assert.equal(todo.actionParams.url, undefined);
assert.equal(todo.actionParams.path, undefined);
for (const name of ['index.vue', 'NotificationCenter.vue']) {
  const file = root + name;
  const { descriptor, errors } = sfc.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(errors, []);
  sfc.compileScript(descriptor, { id: file });
  assert.deepEqual(sfc.compileTemplate({ source: descriptor.template.content, filename: file, id: file }).errors, []);
}
assert.ok(fs.readFileSync(root + 'index.vue', 'utf8').includes('const notificationsEnabled = true'));
console.log('通知启用、待办参数白名单、普通/异常通知、组件编译通过');
