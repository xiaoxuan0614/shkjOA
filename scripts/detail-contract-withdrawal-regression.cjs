const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc');
function load(path, deps = {}) {
  const exports = {};
  new Function('exports', 'require', ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText)(exports, name => {
    assert(name in deps, name);
    return deps[name];
  });
  return exports;
}
const approval = load('src/utils/approvalStatus.ts');
const { canWithdrawDetailContract: allowed, canEditDetailContract: editable } = load('src/views/project/detail/contractWithdrawal.ts', {
  '/@/utils/approvalStatus': approval,
});
const own = { id: 'c', status: '2', createBy: 'submitter', salesUserId: 'u' };
assert(allowed(own, { username: 'submitter' }));
assert(allowed({ ...own, status: 2 }, { username: 'submitter' }));
for (const status of [-1, 0, 1, 3, null, undefined, '']) {
  assert(!allowed({ ...own, status }, { username: 'submitter' }));
}
assert(!allowed(own, { username: 'admin', id: 'u' }));
assert(!allowed(own, { id: 'u' }));
assert(!allowed({ ...own, id: '' }, { username: 'submitter' }));
assert(allowed({ ...own, createBy: '' }, { id: 'u' }));
assert(!allowed({ ...own, createBy: '', salesUserId: '' }, {}));
for (const status of [3, '3', 0, '-1']) {
  assert(editable({ ...own, status }, { username: 'submitter' }));
  assert(!editable({ ...own, status }, { username: 'admin', id: 'u' }));
}
for (const status of [1, 2]) assert(!editable({ ...own, status }, { username: 'submitter' }));
assert(!editable({ ...own, id: '', status: 3 }, { username: 'submitter' }));
const file = 'src/views/project/detail/components/DetailContract.vue';
const source = fs.readFileSync(file, 'utf8');
for (const title of ['实际回款金额', '计划回款日期', '实际回款日期', '备注']) {
  assert(!source.includes(`title: '${title}'`));
}
assert(source.includes('props.allowWithdraw &&'));
assert(source.includes('@confirm="withdraw"'));
assert(source.includes('@click="editContract">修改重提'));
const parent = fs.readFileSync('src/views/project/detail/index.vue', 'utf8');
assert(parent.includes('@edit="handleContractEdit"'));
assert(parent.includes("mode: 'edit', from: 'periodDetail'"));
assert(source.includes("changeContractStatus({ periodId, status: '3', approvalReason: '' })"));
assert(source.includes('!canWithdrawDetailContract(latest, userStore.getUserInfo)'));
assert(source.includes('if (withdrawing.value || loading.value || !canWithdraw.value) return'));
for (const label of ['累计已回款', '项目经理', '质保结束日期']) assert(!source.includes(`label="${label}"`));
for (const filename of [file, 'src/views/project/detail/index.vue']) {
  const { descriptor, errors } = parse(fs.readFileSync(filename, 'utf8'), { filename });
  assert.equal(errors.length, 0);
  const script = compileScript(descriptor, { id: 'contract-test' });
  const result = compileTemplate({ source: descriptor.template.content, filename, id: 'contract-test', compilerOptions: { bindingMetadata: script.bindings } });
  assert.deepEqual(result.errors, []);
}
console.log('PASS contract withdrawal eligibility, UI placement safeguards, payload and Vue compilation');
