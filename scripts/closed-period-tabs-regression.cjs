const assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
const output = ts.transpileModule(fs.readFileSync('src/views/project/detail/closedPeriodTabs.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
let active = 0, peak = 0, fail = false;
const calls = [];
const read = (name, records) => async params => {
  calls.push({ name, params }); active++; peak = Math.max(peak, active);
  await Promise.resolve(); active--;
  if (fail && name === 'file') throw Error('network');
  return { records };
};
const api = { getPlan: read('plan', []), getMembers: read('member', [{ periodId: 'p' }]), getPositions: read('position', []),
  getFiles: read('file', []), getAcceptance: read('acceptance', []), getMaterialAccounts: read('material', []),
  getPlanProcessDetail: read('process', [{ periodId: 'p', status: 'IN_PROGRESS' }]) };
const mod = { exports: {} };
new Function('require', 'exports', output)(() => api, mod.exports);
(async () => {
  const result = await mod.exports.readClosedPeriodTabs('p');
  assert.deepEqual(result.tabs.sort(), ['implement', 'member', 'plan']);
  assert.equal(result.failed, false); assert.ok(peak <= 3);
  assert.ok(calls.every(call => call.params.periodId === 'p'));
  fail = true;
  const partial = await mod.exports.readClosedPeriodTabs('p');
  assert.equal(partial.failed, true); assert.ok(partial.tabs.includes('member'));
  const wrong = await mod.exports.readClosedPeriodTabs('other');
  assert.equal(wrong.failed, true); assert.deepEqual(wrong.tabs, []);
  console.log('PASS closed period evidence, partial failures, period isolation and concurrency');
})();
