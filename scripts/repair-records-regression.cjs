const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),sfc=require('@vue/compiler-sfc');
const root='src/views/operation/repair/';
const source=fs.readFileSync(root+'repair.api.ts','utf8');
let calls=[],response={records:[],total:0};
const box={exports:{},Blob,require:()=>({defHttp:{get:async x=>{calls.push(x);return response}}})};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,box);
const api=box.exports;
async function main(){
const params=api.listParams({pageNo:-1,pageSize:999,scope:'ADMIN',keyword:'x',workStatus:'UNKNOWN'},'REPORTED');
assert.equal(params.scope,'REPORTED');assert.equal(params.pageSize,200);assert.equal(params.pageNo,1);assert.ok(!('keyword' in params));assert.ok(!('workStatus' in params));
assert.equal(api.display(0),'0');assert.equal(api.display(false),'否');assert.equal(api.hours(3600),'1.00 小时');assert.equal(api.hours(null),'—');
await api.listRepairs({},'ALL');assert.equal(calls[0].url,'/repair/order/list');assert.equal(calls[0].params.scope,'ALL');
response={order:{id:'other'}};await assert.rejects(api.repairDetail('wanted'),/不匹配/);
response={records:[],total:0};await api.repairLogs('wanted',2);assert.equal(calls.at(-1).params.pageNo,2);assert.equal(calls.at(-1).params.id,'wanted');
assert.throws(()=>api.normalizePage({total:4}),/格式/);
assert.ok(!/defHttp\.(post|put|delete)/.test(source),'no business write endpoint');
for(const file of ['index.vue','RepairList.vue','RepairDetail.vue','RepairFiles.vue','../reports/index.vue']){
 const path=root+file;const {descriptor,errors}=sfc.parse(fs.readFileSync(path,'utf8'),{filename:path});assert.equal(errors.length,0);
 const script=sfc.compileScript(descriptor,{id:file});const tpl=sfc.compileTemplate({source:descriptor.template.content,filename:path,id:file,compilerOptions:{bindingMetadata:script.bindings}});assert.equal(tpl.errors.length,0,JSON.stringify(tpl.errors));
}
const vue=require('vue');
const detailPath=root+'RepairDetail.vue';
const {descriptor}=sfc.parse(fs.readFileSync(detailPath,'utf8'),{filename:detailPath});
const compiled=sfc.compileScript(descriptor,{id:'race'});
let resolveOld;
const mockApi={...api,repairDetail:id=>id==='old'?new Promise(r=>resolveOld=r):Promise.resolve({order:{id}}),repairLogs:async()=>({records:[],total:0})};
const setupBox={exports:{},require:name=>name==='vue'?{...vue,onBeforeUnmount:()=>{}}:name==='./repair.api'?mockApi:{}};
vm.runInNewContext(ts.transpileModule(compiled.content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,setupBox);
const props=vue.reactive({id:'old'});const scope=vue.effectScope();
const page=scope.run(()=>setupBox.exports.default.setup(props,{expose(){},emit(){}}));
props.id='new';await vue.nextTick();await new Promise(setImmediate);
resolveOld({order:{id:'old'}});await new Promise(setImmediate);
assert.equal(page.data.value.order.id,'new','old detail response must not replace selected order');
props.id='';await vue.nextTick();assert.equal(page.data.value,null,'close clears sensitive detail');scope.stop();
console.log('PASS repair readonly APIs, scope, pagination, missing fields, 0/false, five Vue SFCs');
}
main().catch(e=>{console.error(e);process.exitCode=1});
