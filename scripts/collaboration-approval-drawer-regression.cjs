const fs=require('fs'),vm=require('vm'),ts=require('typescript'),sfc=require('@vue/compiler-sfc'),vue=require('vue'),assert=require('node:assert/strict');
function load(source,deps={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:m,exports:m.exports,require:n=>deps[n]||{}});return m.exports}
const helper=load(fs.readFileSync('src/views/todo/collaborationApproval.ts','utf8'));
const instance={id:'i',businessId:'a',businessType:'REPAIR_OPS_APPLICATION',processKey:'repair_ops_collaboration',version:1,snapshot:{orderId:'o'},tasks:[{id:'t',canHandle:true}]};
const actions={tasks:[{taskId:'t',actions:['APPROVE','REJECT']}]};
let rejectNetwork=true,failRead=false,legacyCalls=0,detailCalls=0,candidateCalls=[],requests=[];
const file='src/views/workflow/components/InstanceDrawer.vue',d=sfc.parse(fs.readFileSync(file,'utf8')).descriptor;
assert.deepEqual(sfc.compileTemplate({source:d.template.content,filename:file,id:'test'}).errors,[]);
const component=load(sfc.compileScript(d,{id:'test'}).content,{
 vue:{...vue,watch:()=>{},onBeforeUnmount:()=>{}},
 '/@/views/todo/collaborationApproval':helper,
 '/@/views/todo/repairAssignment':{approvalCandidates:async(a,t)=>{candidateCalls.push({a,t});return {assignmentMode:'WITH_APPROVAL',taskId:t,nodeKey:'head',departments:[{departmentId:'d1',departmentName:'部门一',members:[{value:'u1',label:'成员一'}]},{departmentId:'d2',departmentName:'部门二',members:[{value:'u2',label:'成员二'}]}]}},reviewCollaboration:async p=>{requests.push(JSON.parse(JSON.stringify(p)));if(rejectNetwork)throw Error('network')}},
 '/@/views/operation/repair/repair.api':{repairDetail:async()=>{detailCalls++;if(failRead)throw Error('read failed');return {applications:[{id:'a',formData:{assignmentMode:'WITH_APPROVAL'}}]}}},
 '../instanceInitialDetail':{readInitialDetail:async(id,initial,fetch)=>initial||fetch(id)},
 '../Workflow.api':{handleInstance:async()=>legacyCalls++,instanceDetail:async()=>instance,instanceActions:async()=>actions,instanceForm:async()=>({instanceId:'i',processKey:'repair_ops_collaboration',version:1,fields:[]})},
 '../workflow':{newId:()=>`r-${requests.length}`,statusLabels:{}},
 '../instancePresentation':{returnOptions:()=>[]},
}).default;
const page=component.setup({open:true,instanceId:'i'},{expose:()=>{},emit:()=>{}});
const tick=()=>new Promise(setImmediate);
(async()=>{
 page.detail.value=instance;page.actions.value=actions;
 const opening=page.chooseAction('t','APPROVE');
 assert.equal(page.actionPreparing.value,true,'clicked button enters loading immediately');
 assert.equal(page.confirmOpen.value,false,'dialog stays closed during preparation');
 await Promise.all([opening,page.chooseAction('t','APPROVE'),page.loadReviewCandidates(),page.loadReviewCandidates()]);
 assert.equal(page.actionPreparing.value,false);
 assert.equal(page.confirmOpen.value,true,'open only after candidates are ready');
 await tick();assert.equal(candidateCalls[0].t,'t');
 assert.equal(detailCalls,1,'rapid clicks must not repeat order detail');
 assert.equal(candidateCalls.length,1,'in-flight candidate reads must not duplicate');
 await page.loadReviewCandidates();
 assert.equal(detailCalls,1,'retry candidates reuses protocol within the same confirmation');
 assert.equal(candidateCalls.length,2,'explicit retry refreshes candidates');
 await page.submitAction();assert.equal(requests.length,0);
 page.reviewChosen.value={d1:['u1'],d2:['u2']};await page.submitAction();assert.ok(page.pendingRequest.value);assert.equal(requests[0].departmentAssignments.length,2);
 rejectNetwork=false;await page.submitAction();assert.deepEqual(requests[0],requests[1]);assert.equal(legacyCalls,0);assert.equal(page.confirmOpen.value,false);
 await page.chooseAction('t','REJECT');await tick();assert.equal(detailCalls,2,'new confirmation reads fresh order data');await page.submitAction();assert.equal(requests.length,2);
 page.comment.value='不同意';await page.submitAction();assert.equal(requests[2].approve,false);assert.equal('departmentAssignments' in requests[2],false);assert.equal('assignedUserIds' in requests[2],false);
 failRead=true;await page.chooseAction('t','APPROVE');
 assert.equal(page.confirmOpen.value,false,'failed preparation must not open dialog');
 assert.equal(page.actionPreparing.value,false,'failed preparation releases button loading');
 assert.equal(page.candidatesError.value,'read failed');
 failRead=false;await page.chooseAction('t','APPROVE');assert.equal(page.confirmOpen.value,true,'button can retry after failure');
 console.log('PASS PC drawer: task candidates, required selections, review endpoint, retry identity and rejection without members');
})().catch(e=>{console.error(e);process.exitCode=1});
