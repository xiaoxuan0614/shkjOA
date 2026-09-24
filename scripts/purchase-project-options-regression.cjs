const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const result = {};
new Function('exports', ts.transpile(fs.readFileSync('src/views/material/purchase/purchaseProjectOptions.ts', 'utf8'), {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
}))(result);
const { purchaseProjectOption, filterPurchaseProject, loadPurchaseProjects } = result;
assert.equal(result.purchaseEditProjectOption({ periodId: 's' }, { periodId: 's', projectName: '园区', periodName: '一期' }).label, '园区-一期');
assert.equal(result.purchaseEditProjectOption({ periodId: 'other' }, { periodId: 's', projectName: '园区', periodName: '一期' }).label, 'other');
assert.equal(result.purchaseEditProjectOption({ periodId: 's', projectName: '新名称' }, { periodId: 's', projectName: '旧名称', periodName: '一期' }).label, '新名称-一期');
(async () => {
  const option = purchaseProjectOption({ projectId: 'p', periodId: 's', projectName: ' 园区 ', periodName: '一期' });
  assert.equal(option.label, '园区-一期');
  assert.equal(option.value, 's');
  for (const query of ['园区', '一期', '区-一', ' 园区 ']) assert(filterPurchaseProject(query, option));
  assert(filterPurchaseProject('abc', { label: 'ABC-一期' }));
  assert(!filterPurchaseProject('二期', option));
  const calls = [];
  const options = await loadPurchaseProjects(async params => {
    calls.push(params);
    return { total: 3, records: params.pageNo === 1
      ? [{ periodId: 'a', projectName: '主', periodName: '一' }, { periodId: 'b', periodName: '二' }]
      : [{ periodId: 'c', projectName: '末页', periodName: '三' }] };
  });
  assert.equal(options.length, 3);
  assert.equal(options[2].label, '末页-三');
  assert.deepEqual(calls, [{ pageNo: 1, pageSize: 100 }, { pageNo: 2, pageSize: 100 }]);
  assert.deepEqual(await loadPurchaseProjects(async () => ({ records: [], total: 0 })), []);
  assert.deepEqual(await loadPurchaseProjects(async () => ({ records: [option] }), () => false), []);
  await assert.rejects(loadPurchaseProjects(async () => { throw Error('network'); }));
  await assert.rejects(loadPurchaseProjects(async () => ({ records: [{ periodId: 'a' }], total: 100 })));
  const filename = 'src/views/material/purchase/PurchaseModal.vue';
  const source = fs.readFileSync(filename, 'utf8');
  assert(!source.includes('ensurePeriodOptions'));
  assert(source.includes('onDropdownVisibleChange: onProjectOpen'));
  assert(source.includes('onChange: onProjectSelect'));
  const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc');
  const { descriptor } = parse(source);
  compileScript(descriptor, { id: 'purchase' });
  assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename, id: 'purchase' }).errors, []);
  console.log('Purchase project pagination, search, cancellation, error and SFC checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
