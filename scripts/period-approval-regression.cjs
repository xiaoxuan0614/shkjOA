const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const vue = require('vue');
const sfc = require('@vue/compiler-sfc');

function loadTs(path, imports = {}) {
  const ctx = { exports: {}, require: key => { if (!(key in imports)) throw Error(key); return imports[key]; } };
  vm.createContext(ctx);
  vm.runInContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, ctx);
  return ctx.exports;
}
const policy = loadTs('src/views/project/plan/periodApproval.ts');
const pending = { id: '900719925474099399', periodId: 'p', approvalStatus: '2', submitUserId: 'u', roundNo: 1 };
const period = { id: 'p', status: 'PENDING_APPROVAL', approvalStatus: '2', currentApprovalId: pending.id };
assert.equal(policy.resolvePeriodApproval(period, [pending]).waiting, true);
assert.equal(policy.resolvePeriodApproval(period, [pending]).canSubmit, false);
assert.equal(policy.resolvePeriodApproval({status:'PENDING_APPROVAL'}, []).legacy, true);
for (const status of ['-1', '0', '3']) assert.equal(policy.resolvePeriodApproval({status:'NOT_STARTED',approvalStatus:status}, []).canSubmit, true);
const approved = {...pending, approvalStatus:'1'};
assert.equal(policy.resolvePeriodApproval({status:'PREPARING',approvalStatus:'1'}, [approved]).canSubmit, false);
assert.equal(policy.resolvePeriodApproval({status:'NOT_STARTED',approvalStatus:'-1',currentApprovalId:approved.id}, [approved]).canSubmit, true);
assert.equal(policy.resolvePeriodApproval({...period,currentApprovalId:'old'}, [pending]).waiting, false);
assert.equal(policy.canEditPeriodPlan({status:'IMPLEMENTING'}), false);
assert.equal(policy.canEditPeriodPlan({status:'PENDING_APPROVAL'}), false);
assert.equal(policy.parseApprovalSnapshot('{bad'), null);
assert.equal(policy.parseApprovalSnapshot('{"period":{},"plans":[],"processes":[]}'), null);
assert.ok(policy.parseApprovalSnapshot('{"period":[],"plans":[],"processes":[]}'));

const actionSource = fs.readFileSync('src/views/project/plan/PeriodApprovalActions.vue','utf8');
const descriptor = sfc.parse(actionSource).descriptor;
const program = ts.createSourceFile('actions.ts', descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true);
const stripped = program.statements.filter(n => !ts.isImportDeclaration(n)).map(n => n.getText(program)).join('\n');
function actionHarness(overrides = {}) {
  const requests = [], messages = [], emitted = [];
  let livePeriod = {...period}, liveHistory = [{...pending}];
  const ctx = { ...vue, ...policy, console,
    defineProps: () => ({periodId:'p', approvalId:'', allowApprove:true, allowSubmit:true, disabled:false, ...overrides}),
    withDefaults: p => p, defineEmits: () => (...a) => emitted.push(a), defineExpose: () => {},
    watch: () => {}, onBeforeUnmount: () => {},
    useUserStore: () => ({getUserInfo:{id:'u'}, getIdentity:{roleCodes:[]}, getToken:'session'}),
    usePermission: () => ({hasPermission: code => code === policy.PERIOD_APPROVE_PERMISSION}),
    useMessage: () => ({createMessage:{warning: m => messages.push(m),error:m=>messages.push(m),success:m=>messages.push(m)}}),
    getPeriodApprovalState: async () => livePeriod,
    getPeriodApprovalHistory: async () => liveHistory,
    readProjectMembership: async () => ({manager:true}), refreshTodos: async () => {},
    submitPeriodApproval: async (...a) => requests.push(['submit', ...a]),
    approvePeriodPlan: async (...a) => requests.push(['approve', ...a]),
    withdrawPeriodApproval: async (...a) => requests.push(['withdraw', ...a]),
  };
  vm.createContext(ctx);
  vm.runInContext(ts.transpileModule(stripped, {compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText +
    '\nthis.test = { refresh, openAction, execute, reason, canSubmit, canApprove, canWithdraw, confirmOpen };',ctx);
  return { ctx, requests, messages, emitted, api:ctx.test, setLive: (p,h)=>{livePeriod=p;liveHistory=h;} };
}

(async () => {
  let h = actionHarness(); await h.api.refresh();
  assert.equal(h.api.canApprove.value, true); assert.equal(h.api.canWithdraw.value, true);
  await h.api.openAction('reject'); await h.api.execute(); assert.equal(h.requests.length,0);
  h.api.reason.value='  请补充工序  '; await h.api.execute();
  assert.equal(h.requests[0][1].approvalReason,'请补充工序'); assert.equal(h.requests[0][1].approvalStatus,'0');
  assert.equal(h.requests[0][1].approvalId, pending.id);
  h = actionHarness({approvalId:'old'}); await h.api.refresh(); assert.equal(h.api.canApprove.value,false); assert.equal(h.api.canWithdraw.value,false);
  h = actionHarness(); await h.api.refresh(); await h.api.openAction('approve');
  h.setLive({...period,currentApprovalId:'new'},[{...pending,id:'new'}]); await h.api.execute(); assert.equal(h.requests.length,0);
  h = actionHarness(); await h.api.refresh(); await h.api.openAction('withdraw'); h.api.reason.value='调整'; await h.api.execute();
  assert.equal(h.requests[0][0],'withdraw'); assert.equal(h.requests[0][1].approvalReason,'调整');
  h = actionHarness({beforeSubmit:async()=> '请先保存'}); h.setLive({id:'p',status:'NOT_STARTED',approvalStatus:'-1'},[]);
  await h.api.refresh(); await h.api.openAction('submit'); assert.equal(h.api.confirmOpen.value,false); assert.equal(h.requests.length,0);
  h = actionHarness(); h.setLive({id:'p',status:'NOT_STARTED',approvalStatus:'-1'},[]); await h.api.refresh();
  await h.api.openAction('submit'); await Promise.all([h.api.execute(),h.api.execute()]); assert.equal(h.requests.length,1);
  h = actionHarness(); await h.api.refresh(); await h.api.openAction('approve'); h.ctx.approvePeriodPlan = async () => { h.requests.push('failed'); throw Error('业务拒绝'); };
  await h.api.execute(); assert.equal(h.requests.length,1); assert.ok(h.messages.includes('业务拒绝')); assert.equal(h.emitted.filter(x=>x[0]==='changed').at(-1)[1].succeeded,false);

  const calls=[]; let response={success:true,code:200,result:pending};
  const api=loadTs('src/views/project/plan/PeriodApproval.api.ts', {'/@/utils/http/axios':{defHttp:{post:async(config)=>{calls.push(config);return response;},get:async()=>response}}});
  await api.approvePeriodPlan({periodId:'p',approvalId:pending.id,approvalStatus:'1'});
  assert.equal(calls[0].url,'/project/period/approval/approve'); assert.equal(calls[0].data.approvalId,pending.id); assert.equal(calls[0].params,undefined);
  response={success:false,code:200,message:'拒绝'}; await assert.rejects(()=>api.submitPeriodApproval('p'),/拒绝/);
  response={success:true,code:200,result:{records:[{id:'wrong'}],total:1}}; await assert.rejects(()=>api.getPeriodApprovalState('p'),/不匹配/);
  for(const path of ['src/views/project/plan/PeriodApprovalActions.vue','src/views/project/plan/ProjectPlan.vue','src/views/project/components/PlanAuditModal.vue','src/views/todo/components/TodoActionHost.vue']) {
    const source=fs.readFileSync(path,'utf8'), d=sfc.parse(source).descriptor;
    sfc.compileScript(d,{id:path}); assert.deepEqual(sfc.compileTemplate({source:d.template.content,filename:path,id:path}).errors,[]);
  }
  for(const path of ['src/views/project/plan/ProjectPlan.vue','src/views/project/components/PlanAuditModal.vue']) assert.ok(!fs.readFileSync(path,'utf8').includes('changePeriodStatus'));
  console.log('分期审批：状态/历史失效/经理门禁/旧轮次/原因/撤回/重复点击/业务拒绝/JSON/ID/组件编译回归通过');
})().catch(error=>{console.error(error);process.exitCode=1;});
