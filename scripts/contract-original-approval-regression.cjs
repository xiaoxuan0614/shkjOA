const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const sfc = require('@vue/compiler-sfc');
const assert = require('node:assert/strict');
let response, request;
const ctx = { exports: {}, require: () => ({ defHttp: { get: async config => { request = config; return response; }, post: async config => { request = config; return response; } } }), Blob };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/views/project/contract/approval.api.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,ctx);
const api=ctx.exports;
const data={instanceId:'i',businessId:'c',businessType:'PROJECT_CONTRACT'};
const instance={id:'i',businessId:'c',businessType:'PROJECT_CONTRACT'};
api.assertContractApprovalIdentity(data,instance,'i','c');
assert.throws(()=>api.assertContractApprovalIdentity(data,instance,'i','other'));
assert.throws(()=>api.assertContractApprovalIdentity(data,{...instance,businessType:'WORKFLOW_FORM'},'i'));
assert.throws(()=>api.assertContractApprovalIdentity({...data,instanceId:'old'},instance,'i'));
const visible=api.visibleSubmitted({contractName:'n',projectContext:{customerName:'private'},quotation:{items:[{materialName:'m',basePrice:99}]},contractAttachments:[{id:'a'}]}, {'projectContext':'HIDDEN','quotation.items[].basePrice':'HIDDEN','contractAttachments':'HIDDEN'});
assert.equal('projectContext' in visible,false);assert.equal('contractAttachments' in visible,false);assert.equal('basePrice' in visible.quotation.items[0],false);assert.equal(visible.quotation.items[0].materialName,'m');
for(const file of ['src/views/project/contract/ContractApproval.vue','src/views/project/contract/SubmittedValue.vue','src/views/project/contract/index.vue','src/views/todo/components/TodoActionHost.vue']){
 const {descriptor,errors}=sfc.parse(fs.readFileSync(file,'utf8'));assert.deepEqual(errors,[]);const script=sfc.compileScript(descriptor,{id:file});
 assert.deepEqual(sfc.compileTemplate({source:descriptor.template.content,filename:file,id:file,compilerOptions:{bindingMetadata:script.bindings}}).errors,[]);
}
(async()=>{
 response={success:true,code:200,result:null};assert.equal(await api.currentContractApproval('c'),null);assert.equal(request.params.contractId,'c');
 response={success:false,code:200,message:'无权访问'};await assert.rejects(api.currentContractApproval('c'),/无权访问/);
 response={success:true,code:500,message:'失败'};await assert.rejects(api.contractApprovalDetail('i'),/失败/);
 response={success:true,code:200,result:null};assert.equal(await api.contractApprovalActions('c'),null);
 response={success:false,code:403,message:'无权访问'};await assert.rejects(api.contractApprovalActions('c'),/无权访问/);
 await assert.rejects(api.withdrawContractApproval({contractId:'c',requestId:'r',comment:' '}),/撤回原因/);
 response={success:true,code:200,result:{status:'WITHDRAWN'}};await api.withdrawContractApproval({contractId:'c',requestId:'r',comment:'reason',instanceId:'forbidden'});assert.equal(request.url,'/project/contract/approval/withdraw');assert.deepEqual(Object.keys(request.params).sort(),['comment','contractId','requestId']);
 response={success:true,code:200,result:{status:'RUNNING'}};await assert.rejects(api.withdrawContractApproval({contractId:'c',requestId:'r',comment:'reason'}),/撤回失败/);
 response=new Blob([JSON.stringify({message:'附件无权限'})],{type:'application/json'});await assert.rejects(api.contractApprovalAttachment('i','a'),/附件无权限/);
 response=new Blob(['file'],{type:'application/octet-stream'});assert.equal(await api.contractApprovalAttachment('i','a'),response);assert.equal(request.params.attachmentId,'a');
 console.log('PASS contract approval: instance identity, hidden snapshot fields, denied current lookup, authorized attachment envelopes and 4 Vue components');
})().catch(e=>{console.error(e);process.exitCode=1;});
async function verifyHandling() {
  const script = sfc.parse(fs.readFileSync('src/views/project/contract/ContractApproval.vue','utf8')).descriptor.scriptSetup.content;
  const sends=[];let fail=true,handled=false,todoRefresh=0,withdrawn=false; const withdrawals=[]; const emitted=[];
  const workflow={...instance,tasks:[{id:'task',canHandle:true,name:'审批'}],history:[]};
  const permitted={tasks:[{taskId:'task',actions:['APPROVE','REJECT']}]};
  const mocks={
    vue:{ref:value=>({value}),computed:fn=>({get value(){return fn();}}),watch(){},onBeforeUnmount(){}},
    '/@/views/workflow/Workflow.api':{instanceDetail:async()=>workflow,instanceActions:async()=>handled?{tasks:[]}:permitted,handleInstance:async payload=>{sends.push(payload);if(fail)throw Error('network');handled=true;}},
    '/@/views/workflow/workflow':{newId:()=> 'stable-request',statusLabels:{}},
    '/@/views/todo/useTodoCenter':{refreshTodos:async()=>{todoRefresh++;}},
    './approval.api':{...api,contractApprovalDetail:async()=>({...data,submitted:{periodId:'period'},fieldPermissions:{}}), contractApprovalActions:async()=>({instanceId:'i',canWithdraw:!withdrawn,canResubmit:withdrawn}), withdrawContractApproval:async payload=>{withdrawals.push(payload);if(fail)throw Error('network');withdrawn=true;}},
  };
  const context={exports:{},Error,crypto:{randomUUID:()=> 'withdraw-request'},defineEmits:()=> (...args)=>emitted.push(args),defineProps:()=>({instanceId:'i',contractId:'c'}),require:id=>mocks[id]||{}};
  vm.runInNewContext(ts.transpileModule(script+'\nexport {load,submit,retry,pending,comment,allowedTasks,withdraw,withdrawComment,withdrawal,resubmit,businessActions,business,capabilityError};',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);
  const page=context.exports;await page.load();
  await page.submit('wrong','APPROVE');assert.equal(sends.length,0);
  await page.submit('task','REJECT');assert.equal(sends.length,0,'reject requires comment');
  page.comment.value='不同意';await page.submit('task','REJECT');assert.equal(sends.length,1);assert.ok(page.pending.value);
  await page.submit('task','APPROVE');assert.equal(sends.length,1,'unresolved request blocks a new action');
  fail=false;await page.retry();assert.equal(sends.length,2);assert.equal(sends[0].requestId,sends[1].requestId);assert.equal(sends[1].action,'REJECT');assert.equal(page.pending.value,undefined);assert.equal(page.allowedTasks.value.length,0);assert.equal(todoRefresh,1);
  await page.withdraw(); assert.equal(withdrawals.length,0,'withdraw requires reason');
  page.withdrawComment.value='修改合同';fail=true;await page.withdraw();assert.equal(withdrawals.length,1);assert.ok(page.withdrawal.value);
  fail=false;await page.withdraw();assert.equal(withdrawals.length,2);assert.equal(withdrawals[0].requestId,withdrawals[1].requestId);assert.equal(withdrawals[1].contractId,'c');assert.equal('instanceId' in withdrawals[1],false);assert.equal(page.withdrawal.value,undefined);assert.equal(todoRefresh,2);
  await page.resubmit();assert.deepEqual(emitted[0],['resubmit','period','c']);
  page.businessActions.value={instanceId:'new',canResubmit:true};await page.resubmit();assert.equal(emitted.length,1,'historic round cannot resubmit');
  mocks['./approval.api'].contractApprovalActions=async()=>{throw Error('404');};await page.load();assert.ok(page.business.value,'authorized snapshot remains visible');assert.equal(page.businessActions.value,undefined);assert.match(page.capabilityError.value,/404/);
  console.log('PASS withdrawal: required reason, business endpoint, stable retry, refresh and latest-round resubmit');
  console.log('PASS original-page handling: task eligibility, reject comment, duplicate protection, stable retry and task refresh');
}
verifyHandling().catch(e=>{console.error(e);process.exitCode=1;});
