const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc');
const modal = 'src/views/project/components/AcceptanceModal.vue';
const detail = 'src/views/project/detail/components/DetailAcceptance.vue';
const todo = 'src/views/todo/components/TodoActionHost.vue';
function fn(file, name, ctx) {
  const source = parse(fs.readFileSync(file, 'utf8')).descriptor.scriptSetup.content;
  const ast = ts.createSourceFile('test.ts', source, ts.ScriptTarget.Latest, true);
  const node = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === name);
  assert.ok(node, name);
  vm.runInNewContext(ts.transpileModule(node.getText(ast) + ';this.run=' + name, {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText, ctx);
  return ctx.run;
}
async function main() {
  const state = { identityReady: { value: true }, loading: { value: false }, operationsMember: { value: true },
    acceptedManager: { value: false }, props: { project: { status: 'ACCEPTING' } },
    activeRecord: () => ({ acceptStatus: 'IN_PROGRESS' }), resolveStatus: r => r.acceptStatus, hasPermission: () => true };
  const can = fn(detail, 'canOperate', state);
  assert.equal(can('INTERNAL'), true);
  assert.equal(can('CUSTOMER'), false);
  state.identityReady.value = false; assert.equal(can('INTERNAL'), false);
  state.identityReady.value = true;
  state.operationsMember.value = false; assert.equal(can('INTERNAL'), false);
  state.operationsMember.value = true;
  state.hasPermission = () => false; assert.equal(can('INTERNAL'), false);
  state.hasPermission = () => true;
  for (const status of ['CLOSED', 'WARRANTY', 'PENDING_ACCEPT', 'REWORKING', '']) {
    state.props.project.status = status; assert.equal(can('INTERNAL'), false, status);
  }
  state.props.project.status = 'REACCEPTING'; assert.equal(can('INTERNAL'), true);
  state.activeRecord = () => ({ acceptStatus: 'COMPLETED' }); assert.equal(can('INTERNAL'), false);

  const failed = { id: 'a', result: 'FAILED', acceptStatus: 'COMPLETED' };
  const recheckState = { props: { project: { status: 'REACCEPTING' } }, applicationReady: { value: true },
    blockingRework: { value: false }, acceptedManager: { value: true }, hasPermission: () => true,
    internal: failed, customer: {}, resolveStatus: r => r.acceptStatus, normalizeResult: r => r,
    loading: { value: false }, recordsReady: { value: true }, latestStatus: { value: { internal: { canApplyRework: true } } } };
  const recheck = fn(detail, 'canRequestRecheck', recheckState);
  const rework = fn(detail, 'canApplyRework', recheckState);
  assert.equal(recheck(failed), true); assert.equal(rework(failed), true);
  recheckState.blockingRework.value = true;
  assert.equal(recheck(failed), true, '验收申请返工互斥由后端校验'); assert.equal(rework(failed), true, '允许打开已有返工单查看或重提，提交仍校验');
  const normalState = { ...recheckState, recordsReady: { value: true }, canStartAcceptance: () => true };
  assert.equal(fn(detail, 'canRequestNormal', normalState)({}), true, '普通验收也不因返工记录前端拦截');
  recheckState.blockingRework.value = false;
  recheckState.customer = { id: 'active', sourceAcceptanceId: 'old', acceptStatus: 'IN_PROGRESS' };
  assert.equal(rework(failed), true, '另一类型复验不隐藏申请入口，提交交后端校验');
  recheckState.props.project.status = 'WARRANTY'; assert.equal(recheck(failed), false);
  assert.equal(rework(failed), true, '不再以项目状态隐藏失败验收返工入口');
  assert.equal(rework({ ...failed, result: 'PASSED' }), false);
  recheckState.hasPermission = () => false; assert.equal(rework(failed), true, '服务端已判断当前用户权限');
  recheckState.latestStatus.value.internal.canApplyRework = false; assert.equal(rework(failed), false);
  delete recheckState.latestStatus.value.internal.canApplyRework; assert.equal(rework(failed), false);
  recheckState.latestStatus.value.internal.canApplyRework = true;
  recheckState.loading.value = true; assert.equal(rework(failed), false);

  const latestContext = { loadSequence: 0, props: { projectId: 'p' }, latestStatus: { value: {} },
    recordsReady: { value: false }, loading: { value: false }, internalRecords: {}, customerRecords: {},
    fillInternal: row => { latestContext.internal = row; }, fillCustomer: row => { latestContext.customer = row; },
    createMessage: { error: () => {} }, getAcceptanceLatestStatus: async periodId => {
      assert.equal(periodId, 'p');
      return { internal: { acceptance: { id: 'i' }, status: 'REWORKING', statusText: '返工中', canApplyRework: false },
        customer: { acceptance: null, status: 'NOT_APPLIED', canApplyRework: false } };
    } };
  const loadLatest = fn(detail, 'load', latestContext);
  await loadLatest(); assert.equal(latestContext.internal.id, 'i');
  assert.equal(latestContext.customer.id, undefined); assert.equal(latestContext.recordsReady.value, true);
  const meta = fn(detail, 'getAcceptanceMeta', { ...latestContext, resolveStatus: () => 'COMPLETED', normalizeResult: () => 'FAILED' });
  assert.equal(meta(latestContext.internal).text, '返工中', '来源失败记录不覆盖外层状态');
  latestContext.getAcceptanceLatestStatus = async () => { throw Error('network'); };
  await loadLatest(); assert.equal(latestContext.recordsReady.value, false);
  assert.equal(latestContext.latestStatus.value.internal, undefined);
  let finishLatest;
  latestContext.getAcceptanceLatestStatus = () => new Promise(resolve => { finishLatest = resolve; });
  const pendingLatest = loadLatest(); latestContext.loadSequence++;
  finishLatest({ internal: { acceptance: { id: 'stale' } }, customer: {} }); await pendingLatest;
  assert.notEqual(latestContext.internal.id, 'stale', '切换上下文后旧响应不得回填');

  const context = { requestId: 0, periodId: { value: 'p' }, error: {}, loading: {}, project: {},
    canOpen: () => true, projectDetail: async ({ periodId }) => ({ periodId, status: 'REACCEPTING' }) };
  const load = fn(modal, 'loadProject', context);
  await load(); assert.equal(context.project.value.status, 'REACCEPTING');
  context.projectDetail = async () => ({ periodId: 'wrong', status: 'ACCEPTING' });
  await load(); assert.ok(context.error.value);
  context.projectDetail = async () => { throw Error('network'); };
  await load(); assert.equal(context.error.value, 'network'); assert.equal(context.loading.value, false);
  let resolve;
  context.projectDetail = () => new Promise(r => resolve = r);
  const pending = load(); context.requestId++; context.project.value = undefined;
  resolve({ periodId: 'p', status: 'ACCEPTING' }); await pending;
  assert.equal(context.project.value, undefined, '关闭后旧请求不能回填');
  context.refreshError = {}; context.project.value = { periodId: 'p', status: 'PENDING_ACCEPT' };
  const refresh = fn(modal, 'refreshProjectContext', context);
  context.projectDetail = async () => { throw Error('network'); };
  await refresh(); assert.equal(context.project.value.status, ''); assert.ok(context.refreshError.value);
  context.projectDetail = async () => ({ periodId: 'p', status: 'REACCEPTING' });
  await refresh(); assert.equal(context.project.value.status, 'REACCEPTING');
  const events = [];
  const success = fn(modal, 'handleSuccess', { closeModal: () => events.push('close'),
    refreshProjectContext: () => events.push('refresh'), emit: () => events.push('success') });
  success('completed'); assert.deepEqual(events, ['close', 'success']);
  events.length = 0; success(); assert.deepEqual(events, ['refresh', 'success'], '申请成功留在表单，不关闭');

  const calls = [];
  const stock = { parseTodoActionParams: p => p || {}, resolvePeriodId: () => '',
    queryById: async () => ({ id: 'a', applyType: 'IN', status: '1', executeStatus: 'PENDING' }),
    prepareApprovalAccess: async () => calls.push('prepare'), canApprove: () => true, canExecute: () => true,
    openStockApproveModal: () => calls.push('approve'), openStockExecuteModal: () => calls.push('execute'),
    createMessage: { error: () => calls.push('error'), warning: () => calls.push('warning') } };
  const open = fn(todo, 'openTodo', stock);
  await open({ todoType: 'STOCK_IN_EXECUTE', actionParams: { applyId: 'a' } });
  assert.deepEqual(calls.splice(0), ['execute']);
  stock.canExecute = () => false;
  await open({ actionKey: 'STOCK_IN_EXECUTE', actionParams: { applyId: 'a' } });
  assert.deepEqual(calls.splice(0), ['warning']);
  await open({ todoType: 'STOCK_IN_APPROVAL', actionParams: { applyId: 'a' } });
  assert.deepEqual(calls.splice(0), ['prepare', 'approve']);
  await open({ todoType: 'STOCK_OUT_EXECUTE', actionParams: { applyId: 'a' } });
  assert.deepEqual(calls.splice(0), ['error'], '不允许出库待办打开入库单');
  await open({ todoType: 'STOCK_IN_EXECUTE' }); assert.deepEqual(calls.splice(0), ['error']);

  const payloads = [], completed = [];
  const record = { id: 'accept', acceptDate: '2026-09-21', result: 'PASSED', acceptUnitLeader: '客户', acceptUnitPhone: 'phone', acceptanceFormFileId: 'file' };
  const completeContext = { activeLoading: () => ({ value: false }), internalLoading: {}, customerLoading: {}, uploadBusy: {},
    canComplete: () => true, activeRecord: () => record, assignResponsible: () => {}, validateAcceptance: () => {},
    normalizeResult: r => r, props: { projectId: 'p', footerActions: true }, currentUserName: { value: 'operator' },
    dayjs: () => ({ format: () => '2026-09-21' }), completeProjectAcceptance: async p => payloads.push(p),
    createMessage: { success: () => {}, warning: () => {}, error: () => {} }, historyCache: new Map(),
    load: () => { throw Error('弹窗提交成功无需重新加载即将卸载的表单'); }, refreshTodos: async () => {}, emit: (...e) => completed.push(e) };
  const complete = fn(detail, 'handleComplete', completeContext);
  await complete('INTERNAL'); assert.equal('acceptUnitPhone' in payloads[0], false);
  assert.equal(payloads[0].acceptUnitLeader, 'operator'); assert.deepEqual(completed[0], ['changed', 'completed']);
  await complete('CUSTOMER'); assert.equal(payloads[1].acceptUnitPhone, 'phone');
  completed.length = 0; completeContext.completeProjectAcceptance = async () => { throw Error('rejected'); };
  await complete('INTERNAL'); assert.equal(completed.length, 0, '失败不能关闭弹窗');
  assert.equal(record.acceptanceFormFileId, 'file', '失败保留输入');

  for (const file of [modal, detail, todo, 'src/views/project/index.vue']) {
    const { descriptor, errors } = parse(fs.readFileSync(file, 'utf8'));
    assert.deepEqual(errors, []); compileScript(descriptor, { id: 'pc-fixes' });
    assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename: file, id: 'pc-fixes' }).errors, []);
  }
  console.log('PC todo/acceptance: permission matrix, real project state, stale response, stock dispatch, completion payload and SFC checks passed');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
