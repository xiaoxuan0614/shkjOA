const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),ts=require('typescript'),vue=require('vue'),sfc=require('@vue/compiler-sfc');
function load(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>mocks[n]||require(n)});return exports}
const helper=load('src/views/workflow/approvalReuse.ts');
const reused={departmentId:'d1',automatic:true,approvalSource:'FIRST_LEVEL_REUSE',handledBy:'u1',sourceTaskId:'head-task'};
assert.equal(helper.isApprovalReused(reused),true);assert.equal(helper.isApprovalReused({...reused,automatic:false}),false);assert.equal(helper.isApprovalReused({...reused,approvalSource:undefined}),false);
assert.equal(helper.reusedDepartmentRecords({}).length,0);assert.equal(helper.reusedDepartmentRecords({relatedDepartmentGroups:{departments:[reused,{departmentId:'d2',automatic:false}]}}).length,1);
const file='src/views/workflow/components/MoreSettings.vue';const {descriptor}=sfc.parse(fs.readFileSync(file,'utf8'));const compiled=sfc.compileScript(descriptor,{id:'reuse-settings'});const componentExports={};vm.runInNewContext(ts.transpileModule(compiled.content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:componentExports,require:()=>({...vue,inject:()=>vue.ref({})})});
for(const initial of [undefined,null,false,true]){
 const props=vue.reactive({repairInternal:true,value:{notifications:{TASK:false},reuseFirstLevelApprovalResult:initial}});let saved;
 const scope=vue.effectScope();const page=scope.run(()=>componentExports.default.setup(props,{expose:()=>{},emit:(_name,value)=>saved=value}));
 assert.equal(page.settings.value.reuseFirstLevelApprovalResult===true,initial===true);
 page.update({reuseFirstLevelApprovalResult:true});assert.equal(saved.reuseFirstLevelApprovalResult,true);assert.equal(saved.notifications.TASK,false);
 props.value=saved;page.update({reuseFirstLevelApprovalResult:false});assert.equal(saved.reuseFirstLevelApprovalResult,false);scope.stop();
}
console.log('PASS approval reuse metadata, missing fields, switch defaults, on/off and preservation of other settings');
