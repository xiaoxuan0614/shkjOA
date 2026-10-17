const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc');
const filename = 'src/views/todo/components/TodoActionHost.vue';
const { descriptor } = parse(fs.readFileSync(filename, 'utf8'));
const ast = ts.createSourceFile('host.ts', descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true);
const names = ['resolvePeriodId', 'matchesTodo', 'openPlanApproval', 'openTodo'];
const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map(node => node.getText(ast)).join('\n');
const routes = [], errors = [];
const open = new Function('router', 'createMessage', 'parseTodoActionParams', ts.transpile(`${functions}\nreturn openTodo;`))(
  { push: route => routes.push(route) }, { error: message => errors.push(message) },
  value => typeof value === 'string' ? JSON.parse(value) : value || {}
);
(async () => {
  for (const todo of [
    { todoType: 'PROJECT_PERIOD_APPROVAL', actionParams: JSON.stringify({ periodId: 'p1', approvalId: 'a1' }) },
    { actionKey: 'PROJECT_PERIOD_APPROVAL', bizId: 'p1', actionParams: { approvalId: 'a1' } },
    { todoType: 'PROJECT_PERIOD_APPROVAL', bizSubId: 'p1', actionParams: { approvalId: 'a1' } },
    { todoType: 'PROJECT_PLAN_APPROVAL', periodId: 'p1', actionParams: { approvalId: 'a1' } },
  ]) {
    await open(todo);
    assert.deepEqual(routes.pop(), { path: '/project/plan', query: { periodId: 'p1', mode: 'view', audit: '1', approvalId: 'a1' } });
  }
  await open({ todoType: 'PROJECT_PERIOD_APPROVAL', bizId: 'p2' });
  assert.deepEqual(routes.pop(), { path: '/project/plan', query: { periodId: 'p2', mode: 'view', audit: '1' } });
  await open({ todoType: 'PROJECT_PERIOD_APPROVAL' });
  assert.equal(routes.length, 0);
  assert.equal(errors.length, 1);
  compileScript(descriptor, { id: 'plan-todo' });
  assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename, id: 'plan-todo' }).errors, []);
  console.log('Plan todo: direct audit navigation, approval round, ID fallback, missing ID and SFC passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
