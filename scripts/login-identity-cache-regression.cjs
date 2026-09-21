const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const {parse}=require('@vue/compiler-sfc');
function load(file, dependencies={}) {
  const context={exports:{},require:id=>{if(!(id in dependencies))throw Error(id);return dependencies[id];}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);
  return context.exports;
}
async function main(){
  for(const root of ['.','../SHKKJ-uniapp']){
    const {normalizeIdentity}=load(root+'/src/utils/loginIdentity.ts');
    assert.equal(normalizeIdentity({id:'u',roles:[{value:'admin'}]}).canHandleInternal,true);
    assert.equal(normalizeIdentity({id:'u',roles:[{roleCode:'operations_manager'}]}).canHandleInternal,true);
    assert.equal(normalizeIdentity({username:'admin',roles:[]}).canHandleInternal,false);
    assert.equal(normalizeIdentity({roles:['operations_staff']}).canHandleInternal,false);
    assert.equal(normalizeIdentity({roles:['admin_assistant']}).canHandleInternal,false);
    assert.equal(normalizeIdentity({roles:[{id:'r',value:'admin'}],belongDepIds:'a,b',departIds:'c'}).roleIds[0],'r');
    let calls=0,fail=false;
    const fetch=async()=>{calls++;if(fail)throw Error('network');return {records:[{userId:'u',periodId:'p',inviteStatus:'1',memberRole:'2'}],total:1};};
    const pc=root==='.';
    const dependencies=pc?{'./detail/ProjectDetail.api':{getMembers:fetch}}:{'@/utils/http':{http:{get:async()=>({result:await fetch()})}},'@/service/shkj':{unwrapRecords:r=>r.result.records}};
    const api=load(root+(pc?'/src/views/project/projectMembership.ts':'/src/service/projectMembership.ts'),dependencies);
    const cached=api.readCachedProjectMembership;
    await Promise.all([cached('p','u','session1'),cached('p','u','session1')]);assert.equal(calls,1);
    await cached('p','u','session2');assert.equal(calls,2);
    assert.equal((await cached('p','other','session2')).manager,false);assert.equal(calls,3);
    fail=true;await assert.rejects(cached('p','u','failed'));await assert.rejects(cached('p','u','failed'));assert.equal(calls,5);
  }
  const file='src/views/project/detail/components/DetailAcceptance.vue';
  const ast=ts.createSourceFile('x.ts',parse(fs.readFileSync(file,'utf8')).descriptor.scriptSetup.content,ts.ScriptTarget.Latest,true);
  const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name.text==='chooseCurrent');
  const normalize=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name.text==='normalizeRecords');
  const passed={id:'passed',reworkId:'',result:'PASSED',acceptStatus:'COMPLETED'};
  const context={props:{project:{currentReworkId:'new'}},internalRecords:{value:[]},customerRecords:{value:[]},resolveStatus:r=>r.acceptStatus,normalizeResult:r=>r};
  vm.runInNewContext(ts.transpileModule(normalize.getText(ast)+fn.getText(ast)+';this.choose=chooseCurrent',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,context);
  assert.equal(context.choose([passed]).id,'passed');
  const current={id:'new',reworkId:'new',acceptStatus:'IN_PROGRESS'};
  assert.equal(context.choose([current,passed]).id,'new');
  assert.equal(context.choose([{...passed,result:'FAILED'}]).id,'passed');
  assert.equal(context.choose([{...passed,id:'later-failure',result:'FAILED'},passed]).id,'later-failure','不能跳过较新失败记录恢复更早通过记录');
  const newer={id:'newer',reworkId:'different',sourceAcceptanceId:'passed',createTime:'2026-09-20',acceptStatus:'IN_PROGRESS'};
  assert.equal(context.choose([passed,newer]).id,'newer','旧列表轮次不能覆盖接口最新记录');
  assert.equal(context.choose([{...passed,createTime:'2026-09-21'},newer]).id,'newer','复验来源不能作为当前记录');
  assert.equal(context.choose([]).id,undefined);
  console.log('登录角色、缓存会话隔离/并发复用/失败重试、历史通过只读回显测试通过');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
