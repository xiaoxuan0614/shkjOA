const fs=require('fs'),vm=require('vm'),ts=require('typescript'),sfc=require('@vue/compiler-sfc'),assert=require('node:assert/strict'),vue=require('vue');
function moduleOf(source,deps={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:m,exports:m.exports,require:n=>deps[n]||{}});return m.exports}
const helper=moduleOf(fs.readFileSync('src/views/operation/repair/repairMaterialDisplay.ts','utf8'));
assert.equal(helper.quantity(0),'0');assert.equal(helper.quantity(undefined),'—');assert.equal(helper.quantity('1.2500'),'1.25');
const links=[{id:'a',materialId:'m',baseUnitId:'unit-a',materialName:'单位甲',baseUnitName:'个'},{id:'b',materialId:'m',baseUnitId:'unit-b',materialName:'单位乙',baseUnitName:'箱'}];
assert.equal(helper.materialInfo({pickLinkId:'b'},links).name,'单位乙');assert.equal(helper.materialInfo({materialId:'m',baseUnitId:'unit-a'},links).unit,'个');assert.equal(helper.materialInfo({materialId:'m'},links).name,'未提供物料名称');assert.notEqual(helper.materialKey(links[0]),helper.materialKey(links[1]));
let query;
const api=moduleOf(fs.readFileSync('src/views/operation/repair/repair.api.ts','utf8'),{'/@/utils/http/axios':{defHttp:{get:async p=>{query=p;return {orderId:'o',records:[],total:0}}}}});
const watches=[],pending=[];
const source=fs.readFileSync('src/views/operation/repair/RepairMaterialRecords.vue','utf8');const descriptor=sfc.parse(source).descriptor;
const result=sfc.compileTemplate({source:descriptor.template.content,filename:'RepairMaterialRecords.vue',id:'test'});assert.deepEqual(result.errors,[]);
const component=moduleOf(sfc.compileScript(descriptor,{id:'test'}).content,{vue:{...vue,watch:(s,f,o)=>{watches.push(f);if(o?.immediate)f()},onBeforeUnmount:()=>{}},'./repair.api':{repairMaterialPage:()=>new Promise(resolve=>pending.push(resolve))},'./repairMaterialDisplay':helper}).default;
(async()=>{
await api.repairMaterialPage('o',2,'camera');assert.equal(query.url,'/repair/materialAccount/page');assert.deepEqual(JSON.parse(JSON.stringify(query.params)),{orderId:'o',pageNo:2,pageSize:10,keyword:'camera'});
const props={orderId:'o',active:false,links:[],uses:[],writeoffs:[]};const page=component.setup(props,{expose(){}});assert.equal(pending.length,0);
props.active=true;watches[1]();assert.equal(pending.length,1);watches[1]();assert.equal(pending.length,1);
props.orderId='new';watches[0]();watches[1]();assert.equal(pending.length,2);pending[0]({records:[{materialId:'old'}],total:1});await new Promise(r=>setImmediate(r));assert.equal(page.records.value.length,0);
pending[1]({records:[{materialId:'new'}],total:1});await new Promise(r=>setImmediate(r));assert.equal(page.records.value[0].materialId,'new');
assert.ok(source.includes("['confirmedUseQty','已确认使用']"));assert.ok(!source.includes('库存申请ID'));
console.log('PASS repair materials: API scope, zero/missing quantities, source/unit resolution, lazy loading, duplicate guard, stale response and SFC compile');
})().catch(e=>{console.error(e);process.exitCode=1});
