const fs = require('node:fs'), assert = require('node:assert/strict'), ts = require('typescript');
const source = fs.readFileSync('src/views/project/contract/index.vue', 'utf8');
const section = source.slice(source.indexOf('  const managerOptions ='), source.indexOf('  const approvalResult ='));
let calls = 0, fail = false;
const user = { getToken: 'one' }, period = { value: 'p' };
const api = new Function('ref', 'onDeactivated', 'onBeforeUnmount', 'watch', 'userStore', 'periodId', 'loadProjectManagerOptions', 'createMessage',
  ts.transpileModule(section, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText + '\nreturn { loadManagers, resetManagers, managerOptions };'
)(value => ({ value }), () => {}, () => {}, () => {}, user, period, async () => { calls++; if (fail) throw Error('offline'); return [{ value: 'u' }]; }, { error() {} });
(async () => {
  await api.loadManagers(); await api.loadManagers(); assert.equal(calls, 1);
  api.resetManagers(); await api.loadManagers(); assert.equal(calls, 2);
  user.getToken = 'two'; await api.loadManagers(); assert.equal(calls, 3);
  period.value = 'other'; await api.loadManagers(); assert.equal(calls, 4);
  api.resetManagers(); fail = true; await api.loadManagers();
  fail = false; await api.loadManagers(); assert.equal(calls, 6);
  assert.equal(api.managerOptions.value.length, 1);
  console.log('PASS manager cache reuse, page/session/period invalidation and failure retry');
})().catch(error => { console.error(error); process.exitCode = 1; });
