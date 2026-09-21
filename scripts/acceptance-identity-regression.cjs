const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const {parse} = require('@vue/compiler-sfc');
const files = ['src/views/project/detail/components/DetailAcceptance.vue', '../SHKKJ-uniapp/src/pages/ops/components/ProjectAcceptancePopup.vue'];
function extract(file, name, context) {
  const ast=ts.createSourceFile('test.ts',parse(fs.readFileSync(file,'utf8')).descriptor.scriptSetup.content,ts.ScriptTarget.Latest,true);
  const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name.text===name);
  vm.runInNewContext(ts.transpileModule(fn.getText(ast)+';this.run='+name,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,context);
  return context.run;
}
async function main(){
  for(const file of files){
    const manager={value:false};
    const state={identitySequence:0, props:{projectId:'p'},periodId:{value:'p'}, currentUserId:{value:'u'},userId:{value:'u'},visible:{value:true},
      identityReady:{value:false}, acceptedManager:manager,manager,operationsMember:{value:false},identityError:{value:''},
      hasPermission:()=>true,permission:{hasPermission:()=>true},
      userStore:{getToken:'session',getUserInfo:{}}, user:{userInfo:{token:'session'}},
      readCachedProjectMembership:async()=>({manager:true})};
    const run=extract(file,'loadIdentity',state);
    await run(); assert.equal(manager.value,true); assert.equal(state.operationsMember.value,false);
    state.readCachedProjectMembership=async()=>({manager:false});
    await run(); assert.equal(manager.value,false);
    state.readCachedProjectMembership=async()=>{throw Error('network');};
    await run(); assert.equal(manager.value,false); assert.equal(state.operationsMember.value,false);assert.ok(state.identityError.value);
    let resolve;
    state.readCachedProjectMembership=()=>new Promise(r=>resolve=r);
    const pending=run(); assert.equal(state.identityReady.value,false);
    state.currentUserId.value='other';state.userId.value='other'; resolve({manager:true}); await pending;
    assert.equal(state.identityReady.value,false,'切换用户不能沿用旧结果');assert.equal(manager.value,false);
  }
  const state={identityReady:{value:true},loading:{value:false},operationsMember:{value:false},acceptedManager:{value:true},
    activeRecord:()=>({acceptStatus:'IN_PROGRESS'}),resolveStatus:r=>r.acceptStatus,hasPermission:()=>true};
  const canOperate=extract(files[0],'canOperate',state);
  assert.equal(canOperate('CUSTOMER'),true);assert.equal(canOperate('INTERNAL'),false);
  state.acceptedManager.value=false;state.operationsMember.value=true;
  assert.equal(canOperate('CUSTOMER'),false);assert.equal(canOperate('INTERNAL'),true);
  state.identityReady.value=false;assert.equal(canOperate('INTERNAL'),true);
  state.identityReady.value=true;state.activeRecord=()=>({acceptStatus:'COMPLETED'});assert.equal(canOperate('INTERNAL'),false);
  console.log('两端身份回归通过：项目经理缓存、登录内验资格、查询失败、切换账号及已完成只读');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
