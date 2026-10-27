const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),ts=require('typescript'),sfc=require('@vue/compiler-sfc'),vue=require('vue');
function load(source,deps){const m={exports:{}};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:m,exports:m.exports,require:n=>deps[n]});return m.exports}
let response={success:true,code:200};const apiCalls=[];
const api=load(fs.readFileSync('src/views/todo/repairAssignment.ts','utf8'),{'/@/utils/http/axios':{defHttp:{get:async()=>({departmentId:'d',members:[]}),post:async p=>{apiCalls.push(p);return response}}}});
assert.equal(api.repairAssignmentTarget({todoType:'WORKFLOW_APPROVAL'},{applicationId:'a',departmentId:'d'}),undefined);
assert.equal(api.repairAssignmentTarget({todoType:'REPAIR_COLLABORATION_ASSIGN'},{applicationId:'a'}),undefined);
assert.equal(api.repairAssignmentTarget({todoType:'REPAIR_COLLABORATION_ASSIGN'},{applicationId:'a',departmentId:'d'}).departmentId,'d');
const detail={order:{workStatus:'PROCESSING'},applications:[{id:'a',applicationType:'COLLABORATION',applicationStatus:'PENDING',formData:{departments:[
{departmentId:'d1',assignmentStatus:'PENDING_ASSIGNMENT',approverIds:['head'],approvalSource:'FIRST_LEVEL_REUSE'},
{departmentId:'d2',assignmentStatus:'PENDING_ASSIGNMENT',approverIds:['head']},
{departmentId:'d3',assignmentStatus:'PENDING_APPROVAL',approverIds:['head']},
{departmentId:'d4',assignmentStatus:'PENDING_ASSIGNMENT',approverIds:['other']}
]}}]};
assert.equal(JSON.stringify(api.availableRepairAssignments(detail,'a','head')),JSON.stringify([{applicationId:'a',departmentId:'d1'},{applicationId:'a',departmentId:'d2'}]));
assert.equal(api.availableRepairAssignments(detail,'a','stranger').length,0);
detail.applications[0].applicationStatus='WITHDRAWN';assert.equal(api.availableRepairAssignments(detail,'a','head').length,0);
const file='src/views/todo/components/RepairAssignmentModal.vue',d=sfc.parse(fs.readFileSync(file,'utf8')).descriptor;
assert.deepEqual(sfc.compileTemplate({source:d.template.content,filename:file,id:'test'}).errors,[]);
let failed=true;const requests=[],events=[];
const component=load(sfc.compileScript(d,{id:'test'}).content,{'vue':{...vue,onBeforeUnmount:()=>{}},'../repairAssignment':{assignmentOptions:async()=>({departmentId:'d',departmentName:'部门',members:[{value:'u',label:'人员'}]}),assignMembers:async p=>{requests.push(JSON.parse(JSON.stringify(p)));if(failed)throw Error('network')}}}).default;
const scope=vue.effectScope();let exposed;const state=scope.run(()=>component.setup({}, {expose:x=>exposed=x,emit:e=>events.push(e)}));
(async()=>{exposed.open({applicationId:'a',departmentId:'d'});await new Promise(r=>setImmediate(r));state.chosen.value=['u'];await state.submit();assert.ok(state.pending.value);failed=false;await state.submit();assert.deepEqual(requests[0],requests[1]);assert.equal(state.visible.value,false);assert.deepEqual(events,['processed']);await api.assignMembers(requests[0]);assert.equal(apiCalls[0].data.requestId,requests[0].requestId);response={success:false,code:500};await assert.rejects(()=>api.assignMembers(requests[0]),e=>e.definite===true);await assert.rejects(()=>api.assignmentOptions({applicationId:'a',departmentId:'other'}));exposed.openMany([{applicationId:'a',departmentId:'d1'},{applicationId:'a',departmentId:'d2'}]);await new Promise(r=>setImmediate(r));
state.chosen.value=['u'];await state.submit();assert.equal(state.visible.value,true);assert.equal(state.remaining.value.length,0);assert.equal(state.chosen.value.length,0);
state.chosen.value=['u'];failed=true;await state.submit();const retry=JSON.stringify(state.pending.value);assert.equal(state.pending.value.departmentId,'d2');failed=false;await state.submit();assert.equal(JSON.stringify(requests[requests.length-1]),retry);assert.equal(state.visible.value,false);
scope.stop();console.log('PASS assignment routing, department validation, API payload, retry identity and completion refresh')})().catch(e=>{console.error(e);process.exitCode=1});
