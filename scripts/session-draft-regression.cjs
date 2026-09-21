const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), ts = require('typescript');
const vue = require('vue'), {routeLocationKey} = require('vue-router');
function load(file, deps, globals={}) {
  const context={exports:{},require:id=>{if(!(id in deps))throw Error(id);return deps[id];},...globals};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);
  return context.exports;
}
async function main() {
  const storage = new Map();
  const sessionStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k),get length(){return storage.size;},key:i=>[...storage.keys()][i]};
  const util=load('src/utils/sessionDraftStorage.ts',{}, {sessionStorage});
  const hooks={};
  const user={getToken:'a',getUserInfo:{id:'u',loginTenantId:'tenant'}};
  const api=load('src/hooks/web/useSessionDraft.ts',{
    vue:{onBeforeUnmount:fn=>hooks.unmount=fn,onDeactivated:fn=>hooks.deactivate=fn,onActivated:fn=>hooks.activate=fn},
    'vue-router':{onBeforeRouteLeave:fn=>hooks.leave=fn},
    '/@/store/modules/user':{useUserStore:()=>user},
    '/@/hooks/web/useMessage':{useMessage:()=>({createMessage:{warning:()=>{}}})},
    '/@/utils/sessionDraftStorage':util,
  },{sessionStorage,window:{addEventListener:()=>{},removeEventListener:()=>{}}});
  let form={name:'草稿',rows:[{qty:0}]};
  const a=api.useSessionDraft('contract:p',()=>form);
  a.enable();hooks.leave();assert.equal(a.read().rows[0].qty,0);
  user.getUserInfo.loginTenantId='other';assert.equal(a.read(),undefined);a.persist();
  user.getUserInfo.loginTenantId='tenant';
  user.getToken='b';form={name:'旧组件不得回写'};a.persist();assert.equal(a.read(),undefined);
  util.clearSessionDrafts();assert.equal(storage.size,0);
  const b=api.useSessionDraft('contract:p',()=>({name:'new'}));b.enable();b.persist();b.clear();hooks.leave();assert.equal(b.read(),undefined);
  hooks.activate();b.persist();assert.equal(b.read().name,'new');
  const other=api.useSessionDraft('contract:other',()=>({}));assert.equal(other.read(),undefined);

  // 用 Vue 真正的 KeepAlive 验证路由名匹配和后台页签 route 注入隔离。
  const {createTabPage}=load('src/layouts/page/tabPage.ts',{vue,'vue-router':{routeLocationKey}});
  const renderer=vue.createRenderer({
    createElement:type=>({type,children:[]}),createText:text=>({text}),createComment:text=>({text}),
    setText:(n,t)=>n.text=t,setElementText:(n,t)=>n.text=t,parentNode:n=>n.parent,
    nextSibling:n=>{const a=n.parent?.children||[];return a[a.indexOf(n)+1]||null;},
    insert:(n,p,anchor)=>{if(n.parent){const a=n.parent.children;const i=a.indexOf(n);if(i>=0)a.splice(i,1);} n.parent=p;const i=p.children.indexOf(anchor);p.children.splice(i<0?p.children.length:i,0,n);},
    remove:n=>{const a=n.parent?.children;const i=a?.indexOf(n);if(i>=0)a.splice(i,1);},patchProp:()=>{},
  });
  let mounts=0;const instances=[];const active=vue.ref('a');
  const Page=vue.defineComponent({name:'DifferentFromRouteName',setup(){mounts++;const route=vue.inject(routeLocationKey);const value=vue.ref('');instances.push({route,value});return()=>vue.h('div',value.value);}});
  const wrapped=createTabPage('MenuRouteName');
  const App=vue.defineComponent({setup:()=>()=>vue.h(vue.KeepAlive,{include:['MenuRouteName']},{default:()=>vue.h(wrapped,{key:active.value,page:vue.h(Page),context:{fullPath:active.value,query:{periodId:active.value}}})})});
  const app=renderer.createApp(App);app.mount({children:[]});
  instances[0].value.value='未保存内容';active.value='b';await vue.nextTick();
  assert.equal(instances[0].route.query.periodId,'a','后台页签不能跟随当前路由');
  active.value='a';await vue.nextTick();assert.equal(mounts,2,'返回原页签不能重新挂载');assert.equal(instances[0].value.value,'未保存内容');
  app.unmount();
  const {parse,compileScript,compileTemplate}=require('@vue/compiler-sfc');
  for(const file of ['src/layouts/page/index.vue','src/views/project/apply/ProjectApply.vue','src/views/project/contract/index.vue','src/views/plan/material-draft/editor.vue','src/views/plan/components/MaterialPlanTable.vue','src/views/material/apply/MaterialApply.vue','src/views/material/return/index.vue']) {
    const {descriptor}=parse(fs.readFileSync(file,'utf8'));compileScript(descriptor,{id:'session'});
    assert.equal(compileTemplate({source:descriptor.template.content,filename:file,id:'session'}).errors.length,0,file);
  }
  const pickFile='src/views/material/pick/index.vue';
  const {descriptor:pick}=parse(fs.readFileSync(pickFile,'utf8'));compileScript(pick,{id:'pick'});
  assert.equal(compileTemplate({source:pick.template.content,filename:pickFile,id:'pick'}).errors.length,0);
  console.log('会话草稿读写/清理/账号租户隔离、真实KeepAlive切页保留与路由隔离、8个SFC检查通过');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
