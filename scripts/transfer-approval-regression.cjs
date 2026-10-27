const fs=require('fs'),vm=require('vm'),ts=require('typescript'),sfc=require('@vue/compiler-sfc'),vue=require('vue'),assert=require('node:assert/strict');
function load(source,deps={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:m,exports:m.exports,require:n=>deps[n]||{}});return m.exports}
const people=[{value:'original',label:'原接收人'},{value:'replacement',label:'新接收人'}];
let reads=0,fail=false,requests=[],generic=0;
const helper=load(fs.readFileSync('src/views/todo/transferApproval.ts','utf8'),{'/@/utils/http/axios':{defHttp:{get:async request=>{reads++;assert.equal(request.url,'/repair/options');assert.equal(request.params.type,'internal');return people}}}});
assert.throws(()=>helper.transferReviewFields(true,'','original',people));
assert.throws(()=>helper.transferReviewFields(true,'unknown','original',people));
assert.equal(Object.keys(helper.transferReviewFields(false,'replacement','original',people)).length,0);
const instance={id:'i',businessId:'application',businessType:'REPAIR_OPS_APPLICATION',processKey:'repair_ops_transfer',snapshot:{form:{targetUserId:'original'}},tasks:[{id:'t',canHandle:true}]};
const actions={tasks:[{taskId:'t',actions:['APPROVE','REJECT']}]},fields=[{key:'form.targetUserId',type:'text'}];
const descriptor=sfc.parse(fs.readFileSync('src/views/workflow/components/InstanceDrawer.vue','utf8')).descriptor;
const component=load(sfc.compileScript(descriptor,{id:'transfer-test'}).content,{
 vue:{...vue,watch:()=>{},onBeforeUnmount:()=>{}},
 '/@/views/todo/transferApproval':helper,
 '/@/views/todo/repairAssignment':{reviewCollaboration:async p=>{requests.push(JSON.parse(JSON.stringify(p)));if(fail)throw Error('network')}},
 '../instanceInitialDetail':{readInitialDetail:async()=>instance},
 '../Workflow.api':{handleInstance:async()=>generic++,instanceActions:async()=>actions,instanceForm:async()=>({fields,instanceId:'i',processKey:'repair_ops_transfer'})},
 '../workflow':{newId:()=>`request-${requests.length}`,statusLabels:{}},
}).default;
const page=component.setup({open:true,instanceId:'i'},{expose:()=>{},emit:()=>{}});
(async()=>{
 page.detail.value=instance;page.actions.value=actions;page.fields.value=fields;
 const opening=page.chooseAction('t','APPROVE');assert.equal(page.actionPreparing.value,true);assert.equal(page.confirmOpen.value,false);
 await Promise.all([opening,page.chooseAction('t','APPROVE')]);assert.equal(reads,1);assert.equal(page.transferTarget.value,'original');
 page.transferTarget.value='';await page.submitAction();assert.equal(requests.length,0);
 page.transferTarget.value='replacement';fail=true;await page.submitAction();assert.equal(requests[0].transferTargetUserId,'replacement');assert.equal(requests[0].applicationId,'application');
 fail=false;await page.submitAction();assert.deepEqual(requests[0],requests[1]);assert.equal(page.pendingRequest.value,undefined);assert.equal(page.confirmOpen.value,false);
 await page.chooseAction('t','APPROVE');await page.submitAction();assert.equal('transferTargetUserId' in requests[2],false);
 const before=reads;await page.chooseAction('t','REJECT');assert.equal(reads,before);await page.submitAction();assert.equal(requests.length,3);
 page.comment.value='驳回原因';await page.submitAction();assert.equal(requests[3].approve,false);assert.equal('transferTargetUserId' in requests[3],false);
 assert.equal(generic,0);assert.ok(requests.every(p=>!('assignedUserIds' in p)&&!('departmentAssignments' in p)));
 console.log('PASS transfer approval: required recipient, preloading, override, unchanged default, rejection, retry and success cleanup');
})().catch(e=>{console.error(e);process.exitCode=1});
