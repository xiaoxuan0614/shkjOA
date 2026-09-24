const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const ts = require('typescript');
const { parse } = require('@vue/compiler-sfc');
function read(file) { return parse(fs.readFileSync(file, 'utf8')).descriptor.scriptSetup.content; }
function runFunction(source, name, context, ...args) {
  const ast = ts.createSourceFile('test.ts', source, ts.ScriptTarget.Latest, true);
  const fn = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === name);
  assert.ok(fn, name);
  vm.runInNewContext(ts.transpileModule(fn.getText(ast) + ';this.run=' + name, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, context);
  return context.run(...args);
}
async function main() {
  const pc = read('src/views/project/detail/components/DetailAcceptance.vue');
  const requests = [];
  const context = {
    props: { projectId: 'period-test', project: {} }, loading: { value: false }, recordsReady: {value:false},
    getAcceptance: async p => { requests.push(p); return { records: [], total: 0 }; },
    readAllAcceptancePages: async fetch => (await fetch(1)).records,
    internalRecords: {}, customerRecords: {}, normalizeRecords: x => x,
    chooseCurrent: () => ({}), fillInternal: () => {}, fillCustomer: () => {},
    createMessage: { error: e => { throw Error(e); } },
  };
  await runFunction(pc, 'load', context);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].periodId, 'period-test');
  assert.equal(requests[0].acceptType, 'INTERNAL');
  assert.equal(requests[1].acceptType, 'CUSTOMER');
  assert.ok(!pc.includes('void loadManager()'));
  assert.ok(!pc.includes('loadHistoryCount'));
  assert.ok(read('src/views/project/components/AcceptanceModal.vue').includes('await projectDetail'), '弹窗不能使用待办或列表的旧状态');
  const mobile = read('/Users/xuan/AI/ClaudeAllData/SHKKJ-uniapp/src/pages/ops/components/ProjectAcceptancePopup.vue');
  const calls = [];
  await runFunction(mobile, 'load', {
    version: 0, loading: {}, error: {}, periodId: { value: 'period-test' },
    project: { value: { currentReworkId: '' } }, records: {}, forms: { value: {} },
    readAcceptanceRecords: async (id, type) => { calls.push([id, type]); return []; },
    types: ['INTERNAL', 'CUSTOMER'], currentAcceptance: () => ({}), round: () => '',
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], 'period-test');
  assert.ok(!mobile.includes('readAcceptanceContext'));
  assert.ok(mobile.includes('void loadIdentity()'));
  assert.ok(pc.includes('void loadIdentity()'));
  let historyCalls = 0;
  const historyContext = {
    props: { projectId: 'period-test' }, historySequence: 0, historyLoading: {}, historyError: {},
    historyPage: {}, historyRows: {}, historyTotal: {}, historyCache: new Map(),
    getAcceptance: async p => { historyCalls++; return { records: [{ id: String(p.pageNo) }], total: 20 }; },
    normalizeRecords: r => r.records, isAcceptanceHistory: () => true,
  };
  assert.equal(historyCalls, 0, '打开验收不加载历史页');
  await runFunction(pc, 'loadHistoryPage', historyContext, 1);
  await runFunction(pc, 'loadHistoryPage', historyContext, 1);
  assert.equal(historyCalls, 1, '历史第一页重复访问不请求');
  await runFunction(pc, 'loadHistoryPage', historyContext, 2);
  assert.equal(historyCalls, 2, '翻页才加载第二页');
  const rework = fs.readFileSync('src/views/project/detail/components/ReworkDrawer.vue', 'utf8');
  assert.ok(rework.includes('v-if="materialsVisited" v-show="needsMaterials"'), '未开启补料不挂载组件；关闭后保留草稿');
  assert.ok(rework.includes('outsourcePage === 0 && loadOutsources()'), '重复开关不继续请求外协下一页');
  requests.length = 0;
  await runFunction(pc, 'load', context, 'INTERNAL');
  assert.equal(requests.length, 1, '完成内验只刷新内验');
  console.log('验收记录加载仍各2次；首开另查当前身份，不预查历史/返工/物料');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
