const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict'), ts = require('typescript'), sfc = require('@vue/compiler-sfc');
function load(file, deps = {}) { const exports = {}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2020 } }).outputText, { exports, require: n => deps[n] || require(n) }); return exports; }
const { repairCompletionSections: sections } = load('src/views/workflow/repairCompletionPresentation.ts', { './snapshotPresentation': load('src/views/workflow/snapshotPresentation.ts') });
const fields = [{key:'form',name:'申请内容',type:'object'},{key:'projectContext',name:'项目信息',type:'object'},{key:'workRecords',name:'维修记录',type:'array'},{key:'materialAccount',name:'物料台账',type:'array'},{key:'orderId',name:'维修单编号',type:'string'}];
const input = { form: JSON.stringify({description:'已修复',finalAmount:0,amountChangeReason:'免费'}),projectContext:{projectName:'项目',periodName:'一期'},workRecords:[{repairDescription:'更换设备'}],materialAccount:[{materialName:'设备',remainingReturnQty:0}],orderId:'order'};
const result = sections(input, fields);
assert.equal(result[0].rows.length,2);
assert.equal(result[2].rows.find(r=>r.field.key==='form.finalAmount').value,'0.00');
assert.equal(result[3].rows.length,1); assert.equal(result[4].rows.length,1);
assert.equal(sections(input,fields,{},true)[2].rows.length,1);
assert.equal(sections(input,fields,{},true)[2].rows[0].value,'无需报价');
const hidden = sections(input, fields, {form:'HIDDEN',workRecords:'HIDDEN'});
assert.equal(hidden[1].rows.length,0); assert.equal(hidden[2].rows.length,0); assert.equal(hidden[3].rows.length,0);
assert.equal(sections(input, fields, {'form.finalAmount':'HIDDEN'})[2].rows.some(r=>r.field.key==='form.finalAmount'),false);
const flat = sections({'form.description':'完成','form.finalAmount':12.5},[{key:'form.description',name:'说明',type:'string'},{key:'form.finalAmount',name:'金额',type:'number'}]);
assert.equal(flat[2].rows[0].value,'12.50');
assert.equal(sections({},fields).every(g=>g.rows.length===0),true);
assert.equal(sections({...input,secretCost:999},fields).some(g=>g.rows.some(r=>r.field.key==='secretCost')),false);
for (const file of ['src/views/workflow/components/RepairCompletionSnapshot.vue','src/views/workflow/components/InstanceDrawer.vue']) { const {descriptor,errors}=sfc.parse(fs.readFileSync(file,'utf8')); assert.deepEqual(errors,[]); sfc.compileScript(descriptor,{id:'test'}); assert.deepEqual(sfc.compileTemplate({source:descriptor.template.content,filename:file,id:'test'}).errors,[]); }
console.log('PASS completion grouping, frozen projection, hidden fields, missing data, amount and SFC');
