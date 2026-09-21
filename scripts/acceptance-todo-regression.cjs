const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const {parse,compileScript,compileTemplate}=require('@vue/compiler-sfc');
const root='/Users/xuan/AI/ClaudeAllData/SHKKJ-uniapp/';
const pc='src/views/todo/components/TodoActionHost.vue', mobile=root+'src/pages/home/index.vue';
function source(file){return parse(fs.readFileSync(file,'utf8')).descriptor.scriptSetup.content;}
function extract(file,name){const s=source(file),a=ts.createSourceFile('t.ts',s,ts.ScriptTarget.Latest,true);return a.statements.find(n=>(ts.isFunctionDeclaration(n)&&n.name?.text===name)||(ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(a)===name))).getText(a);}
function setup(file,name,ctx){vm.runInNewContext(ts.transpileModule(extract(file,name)+';this.run='+name,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,ctx);return ctx.run;}
async function main(){
 const calls=[],ctx={parseTodoActionParams:v=>typeof v==='string'?JSON.parse(v):v||{},resolvePeriodId:(t,p)=>String(p.periodId||t.bizSubId||''),createMessage:{error:m=>calls.push(['error',m])},openFailure:async(t,p,id)=>calls.push(['failed',p,id]),openAcceptanceModal:(v,p)=>calls.push(['pending',p.periodId]),router:{push:()=>{throw Error('验收待办不能跳项目详情页');}}};
 const open=setup(pc,'openTodo',ctx);
 await open({todoType:'PROJECT_ACCEPTANCE_FAILED',actionKey:'PROJECT_ACCEPTANCE_FAILED_HANDLE',bizId:'accept-id',bizSubId:'period',actionParams:'{"acceptType":"INTERNAL"}'});
 await open({todoType:'PROJECT_ACCEPTANCE_PENDING',actionKey:'PROJECT_ACCEPTANCE_HANDLE',bizId:'accept-id',bizSubId:'period',actionParams:{}});
 await open({actionKey:'PROJECT_ACCEPTANCE_FAILED_HANDLE',bizId:'accept-id',actionParams:{}});
 assert.deepEqual(calls.slice(0,2),[['failed','period','accept-id'],['pending','period']]);assert.equal(calls[2][0],'error');
 const mobileCalls=[];
 const mobileOpen=setup(mobile,'openTodo',{openAcceptanceTodo:(t,failed)=>mobileCalls.push(failed)});
 mobileOpen({todoType:'PROJECT_ACCEPTANCE_FAILED',actionKey:'PROJECT_ACCEPTANCE_FAILED_HANDLE'});mobileOpen({todoType:'PROJECT_ACCEPTANCE_PENDING'});
 assert.deepEqual(mobileCalls,[true,false]);
 for(const file of [pc,mobile,'src/views/project/components/AcceptanceModal.vue','src/views/project/detail/components/DetailAcceptance.vue',root+'src/pages/ops/components/ProjectAcceptancePopup.vue']){const {descriptor}=parse(fs.readFileSync(file,'utf8'));compileScript(descriptor,{id:'todo'});assert.equal(compileTemplate({source:descriptor.template.content,filename:file,id:'todo'}).errors.length,0,file);}
 const record={id:'a',periodId:'p',result:'FAILED',acceptType:'INTERNAL',remark:'原因'};
 const c={failureSequence:0,failureContext:{},failureRecord:{},failureError:{},failureOpen:{},failureLoading:{},getAcceptanceById:async()=>record};
 const load=setup(pc,'openFailure',c);await load({summary:'主-分期'},'p','a');assert.equal(c.failureRecord.value.remark,'原因');
 await load({},'wrong','a');assert.ok(c.failureError.value);assert.equal(c.failureLoading.value,false);
 console.log('两端验收待办类型/动作识别、分期与验收ID分离、弹窗分派、失败详情校验与5个SFC通过');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
