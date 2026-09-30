const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const ts = require('typescript'), sfc = require('@vue/compiler-sfc');
const mobile = '/Users/xuan/AI/ClaudeAllData/SHKKJ-uniapp/';
function load(file) {
  const ctx = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, ctx);
  return ctx.exports;
}
(async () => {
  for (const file of ['src/views/project/processCompletion.ts', mobile + 'src/service/processCompletion.ts']) {
    const { completionOutcome, forceCompletionPayload, loadCompletionMaterials } = load(file);
    assert.equal(completionOutcome({ submitted: false, materialReturnCompleted: false }), 'return-required');
    assert.equal(completionOutcome({ submitted: true, materialReturnCompleted: false }), 'submitted');
    assert.equal(completionOutcome({ submitted: true, materialReturnCompleted: null }), 'submitted');
    for (const response of [null, {}, { submitted: false }, { submitted: 'true' }]) assert.throws(() => completionOutcome(response));
    for (const reason of ['', '  ', 'a'.repeat(201)]) assert.throws(() => forceCompletionPayload('process-1', reason));
    const payload = forceCompletionPayload('process-1', '  暂存明日归还  ');
    assert.equal(payload.processId, 'process-1'); assert.equal(payload.forceSubmit, true);
    assert.equal(payload.forceSubmitReason, '暂存明日归还'); assert.equal(payload.status, 'COMPLETED');
    assert.equal(forceCompletionPayload('p', 'a'.repeat(200)).forceSubmitReason.length, 200);
    const requests = [];
    const rows = await loadCompletionMaterials(async (pageNo, pageSize) => {
      requests.push([pageNo, pageSize]);
      return { total: 201, records: pageNo === 1 ? Array.from({ length: 200 }, (_, i) => ({ materialId: String(i), shouldReturnQty: 0 })) : [{ materialId: 'last', shouldReturnQty: '2', remainingReturnQty: 0 }] };
    });
    assert.equal(requests.length, 2); assert.equal(requests[1][0], 2); assert.equal(rows.length, 1);
    assert.equal(rows[0].materialId, 'last', 'filter uses shouldReturnQty, not remainingReturnQty');
    await assert.rejects(loadCompletionMaterials(async () => ({ records: [], total: 1 })));
    await assert.rejects(loadCompletionMaterials(async () => ({ records: [] })));
    await assert.rejects(loadCompletionMaterials(async () => { throw new Error('network'); }));
  }
  for (const file of ['src/views/project/components/ProcessCompletionDrawer.vue', 'src/views/material/return/index.vue', mobile + 'src/pages/ops/components/ProcessCompletePopup.vue', mobile + 'src/pages/ops/materialReturn.vue']) {
    const { descriptor, errors } = sfc.parse(fs.readFileSync(file, 'utf8'));
    assert.deepEqual(errors, []);
    sfc.compileScript(descriptor, { id: file });
    assert.deepEqual(sfc.compileTemplate({ source: descriptor.template.content, filename: file, id: file }).errors, []);
    for (const style of descriptor.styles) {
      const result = await sfc.compileStyleAsync({ source: style.content, filename: file, id: file, scoped: true, preprocessLang: style.lang,
        preprocessCustomRequire: (name) => name === 'sass' ? require(mobile + 'node_modules/sass') : require(name) });
      assert.deepEqual(result.errors, []);
    }
  }
  const componentFile = mobile + 'src/pages/ops/components/ProcessCompletePopup.vue';
  const component = sfc.compileScript(sfc.parse(fs.readFileSync(componentFile, 'utf8')).descriptor, { id: componentFile });
  const events = [], posts = [];
  let response = { submitted: false, materialReturnCompleted: false }, rejectPost = false;
  const row = { id: 'p1', status: 'IN_PROGRESS', processName: '工序' };
  const api = {
    processes: async () => ({ result: { records: [row] } }),
    detail: async () => ({ result: { status: 'IMPLEMENTING' } }),
    processStatus: async () => ({ result: { status: 'IN_PROGRESS' } }),
    materialAccounts: async () => ({ result: { records: [{ materialId: 'm1', shouldReturnQty: 2 }], total: 1 } }),
  };
  const context = { exports: {}, Error, uni: { showToast: () => {}, navigateTo: () => {} }, require: (name) => {
    if (name === 'vue') return { defineComponent: (x) => x, ref: (value) => ({ value }), computed: (fn) => ({ get value() { return fn(); } }) };
    if (name.endsWith('/shkj')) return { projectApi: api, unwrapRecords: (x) => x.result.records };
    if (name.endsWith('/http')) return { http: { post: async (url, payload) => { posts.push(payload); if (rejectPost) throw new Error('签退校验失败'); return { result: response }; } } };
    if (name.endsWith('/permission')) return { usePermissionStore: () => ({ hasPermission: () => true }) };
    if (name.endsWith('/user')) return { useUserStore: () => ({ userInfo: { userid: 'u1' } }) };
    if (name.endsWith('/projectMembership')) return { readProjectMembership: async () => ({ manager: true }) };
    if (name.endsWith('/processCompletion')) return load(mobile + 'src/service/processCompletion.ts');
    throw new Error(name);
  }};
  vm.runInNewContext(ts.transpileModule(component.content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context);
  const state = context.exports.default.setup({}, { emit: (event) => events.push(event), expose: () => {} });
  state.periodId.value = 'period1'; state.selected.value = 'p1'; state.rows.value = [row]; state.isManager.value = true; state.confirming.value = true; state.visible.value = true;
  await state.complete(); await new Promise((r) => setImmediate(r));
  assert.equal(state.returnRequired.value, true); assert.equal(state.visible.value, true); assert.equal(events.length, 0);
  assert.equal(posts[0].forceSubmit, undefined); assert.equal(state.returnRows.value.length, 1);
  state.forceReason.value = '   '; await state.forceComplete(); assert.equal(posts.length, 1);
  state.forceReason.value = '明日归还'; rejectPost = true; await state.forceComplete();
  assert.equal(state.forceReason.value, '明日归还'); assert.equal(events.length, 0); assert.match(state.reasonError.value, /签退/);
  rejectPost = false; response = { submitted: true, materialReturnCompleted: false }; await state.forceComplete();
  assert.equal(posts.at(-1).forceSubmitReason, '明日归还'); assert.equal(posts.at(-1).forceSubmit, true);
  assert.equal(events.length, 1); assert.equal(state.visible.value, false);
  console.log('PASS both clients: submitted gate, force reason, pagination, four SFC/styles; mobile actual handlers block, retry, retain reason and force success');
})().catch((error) => { console.error(error); process.exitCode = 1; });
