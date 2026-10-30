const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),ts=require('typescript'),sfc=require('@vue/compiler-sfc');
function load(file,deps={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:n=>deps[n]||require(n)});return exports}
const {repairQuotationPresentation:display}=load('src/views/workflow/repairQuotationPresentation.ts',{'./snapshotPresentation':load('src/views/workflow/snapshotPresentation.ts')});
const visible={form:{scope:{faultScope:'故障\n维修'},remark:'备注',items:[{itemName:'配件',quantity:1.005,unitPrice:1},{itemName:'服务',quantity:2,unitPrice:10}]},projectContext:{customerName:'客户',projectName:'项目'}};
const result=display(visible);assert.equal(result.total,'21.01');assert.equal(result.items[0].lineAmount,'1.01');assert.equal(result.info.length,1);assert.equal(result.info[0].label,'故障范围');
assert.equal(display({'form.scope':{faultScope:'范围'},'form.items':visible.form.items}).info.find(r=>r.label==='故障范围').value,'范围');
const hidden=display(visible,{'form.items[].unitPrice':'HIDDEN','form.remark':'HIDDEN'});assert.equal(hidden.total,undefined);assert.equal(hidden.columns.some(c=>c.dataIndex==='unitPrice'),false);assert.equal(hidden.info.some(r=>r.label==='备注'),false);
assert.equal(display(visible,{form:'HIDDEN'}).showItems,false);
assert.equal(display({form:{items:[{itemName:'缺价',quantity:1}]}}).total,undefined);
assert.equal(display({}).total,undefined);
for(const file of ['src/views/workflow/components/RepairQuotationSnapshot.vue','src/views/workflow/components/InstanceDrawer.vue']){const d=sfc.parse(fs.readFileSync(file,'utf8')).descriptor;sfc.compileScript(d,{id:'test'});assert.deepEqual(sfc.compileTemplate({source:d.template.content,filename:file,id:'test'}).errors,[])}
console.log('PASS repair quotation snapshot, decimal totals, missing data, field permissions and Vue compilation');
