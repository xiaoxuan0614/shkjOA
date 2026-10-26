const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const sfc = require('@vue/compiler-sfc');
const helper = {};
new Function('exports', ts.transpile(fs.readFileSync('src/views/material/pick/pickAllMaterials.ts', 'utf8'), { module: ts.ModuleKind.CommonJS }))(helper);
const source = fs.readFileSync('src/views/material/pick/index.vue', 'utf8');
const { descriptor, errors } = sfc.parse(source);
assert.deepEqual(errors, []);
sfc.compileScript(descriptor, { id: 'pick' });
assert.deepEqual(sfc.compileTemplate({ source: descriptor.template.content, filename: 'pick.vue', id: 'pick' }).errors, []);
const ast = ts.createSourceFile('pick.ts', descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true);
const fn = name => ts.transpile(ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === name).getText(ast));
const ref = value => ({ value });
const row = (id, qty = 5) => ({ materialId: String(id), periodId: 'p', materialName: `物料${id}`, availableApplyQty: qty, baseUnitName: '个' });
function harness(fetchPage) {
  const messages = [];
  const env = { bulkLoading: ref(false), submitLoading: ref(false), pickReady: ref(true), isProjectMode: ref(true), isReworkMode: ref(false),
    selectedPeriodId: ref('p'), participatedProjectPool: ref([{ periodId: 'p' }]), detailList: ref([]),
    draft: { isAlive: () => true }, createMessage: Object.fromEntries(['warning', 'error', 'info', 'success'].map(key => [key, value => messages.push([key, value])])),
    getProjectMaterialAccountPage: fetchPage, ...helper };
  const api = new Function(...Object.keys(env), `let bulkGeneration=0, detailKeySeed=0; ${fn('invalidateBulk')} ${fn('handleDrawerSuccess')} ${fn('handlePickAll')}; return {run:handlePickAll,cancel:invalidateBulk};`)(...Object.values(env));
  return { ...env, ...api, messages };
}
(async () => {
  const calls = [];
  const accounts = await helper.loadPickAllAccounts(async params => {
    calls.push(params);
    return { records: params.pageNo === 1 ? [row(1), row(2, 0)] : [row(3, 2.5)], total: 3 };
  }, 'p', () => true);
  assert.equal(calls.length, 2, '服务端短页但total未到时继续读取');
  assert.deepEqual(calls[0], { periodId: 'p', pageNo: 1, pageSize: 200 });
  const existing = [{ id: '1', unitQty: 1 }];
  assert.deepEqual(helper.missingPickMaterials(accounts, existing).map(item => item.id), ['3']);
  assert.equal(existing[0].unitQty, 1);
  await assert.rejects(helper.loadPickAllAccounts(async () => null, 'p', () => true), /格式/);
  await assert.rejects(helper.loadPickAllAccounts(async () => ({ records: [row(1)], total: 2 }), 'p', () => true), /重复/);
  await assert.rejects(helper.loadPickAllAccounts(async () => ({ records: [], total: 2 }), 'p', () => true), /不完整/);
  assert.throws(() => helper.missingPickMaterials([{ ...row(1), baseUnitName: '' }], []), /单位/);
  let resolve;
  let count = 0;
  const h = harness(() => { count++; return new Promise(done => { resolve = done; }); });
  h.detailList.value = [{ id: '1', unitQty: 1, unitName: '个' }];
  const pending = h.run();
  await h.run();
  assert.equal(count, 1, '重复点击只发一次请求');
  resolve({ records: [row(1), row(2, 0), row(3, 2.5)], total: 3 });
  await pending;
  assert.deepEqual(h.detailList.value.map(item => [item.id, item.unitQty]), [['1', 1], ['3', 2.5]]);
  assert.equal(h.detailList.value[1].unitName, '个');
  assert.equal(h.bulkLoading.value, false);
  const stale = h.run();
  h.selectedPeriodId.value = 'other'; h.cancel(); h.selectedPeriodId.value = 'p';
  resolve({ records: [row(4)], total: 1 }); await stale;
  assert.equal(h.detailList.value.length, 2, '项目切走再切回仍丢弃旧结果');
  const fail = harness(async params => { if (params.pageNo === 2) throw Error('network'); return { records: [row(1)], total: 2 }; });
  await fail.run(); assert.equal(fail.detailList.value.length, 0, '中途失败不追加半份清单');
  assert.equal(fail.bulkLoading.value, false);
  const empty = harness(async () => ({ records: [], total: 0 }));
  await empty.run(); assert.equal(empty.messages[0][0], 'info');
  empty.isProjectMode.value = false; empty.messages.length = 0;
  await empty.run(); assert.equal(empty.messages.length, 0);
  assert(source.includes("watch([selectedPeriodId, usageType, reworkId], invalidateBulk, { flush: 'sync' })"));
  assert(source.includes('onDeactivated(invalidateBulk)'));
  console.log('PASS 一键领料：完整分页、零量过滤、默认额度、已选数量保留、防重、切换失效、失败原子性及SFC编译');
})().catch(error => { console.error(error); process.exitCode = 1; });
