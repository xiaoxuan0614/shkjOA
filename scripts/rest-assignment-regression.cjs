const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
const file='src/views/operation/rest-assignment/restAssignment.ts';
const out=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const context={exports:{}};vm.runInNewContext(out,context);const m=context.exports;
const form={date:'2026-10-30',userId:'demo-a',start:'08:00',end:'10:00',reason:''};
assert.equal(m.validateRest(form),'');
assert.ok(m.validateRest({...form,end:'07:00'}));
let rows=m.previewOrders(form);assert.equal(rows.length,1);assert.ok(m.assignmentError(form,rows));
rows[0].targetId='demo-a';assert.ok(m.assignmentError(form,rows));
rows[0].targetId='demo-d';assert.ok(m.assignmentError(form,rows));
rows[0].targetId='demo-b';assert.equal(m.assignmentError(form,rows),'');
assert.ok(m.assignmentError({...form,end:'12:00'},m.previewOrders({...form,end:'12:00'})).includes('执行中'));
assert.equal(m.previewOrders({...form,start:'16:00',end:'18:00'}).length,0);
assert.equal(m.previewOrders({...form,start:'09:00',end:'10:30'}).length,1,'结束边界不含下一时段');
const mobile='/Users/xuan/AI/ClaudeAllData/SHKKJ-uniapp/src/pages/ops/components/preview/';
assert.equal(fs.readFileSync(file,'utf8'),fs.readFileSync(mobile+'restAssignment.ts','utf8'),'双端模型一致');
const {parse,compileScript,compileTemplate}=require('@vue/compiler-sfc');
for(const name of ['src/views/operation/rest-assignment/RestAssignment.vue','src/views/operation/duty-roster/index.vue',mobile+'RestAssignment.vue',mobile+'OpsWorkflow.vue']){
 const {descriptor,errors}=parse(fs.readFileSync(name,'utf8'));assert.deepEqual(errors,[]);const script=compileScript(descriptor,{id:'rest'});const result=compileTemplate({source:descriptor.template.content,filename:name,id:'rest',compilerOptions:{bindingMetadata:script.bindings}});assert.deepEqual(result.errors,[]);
}
console.log('PASS 休息时段、边界、接收人排除、执行中拦截、双端模型一致及4个SFC编译');
