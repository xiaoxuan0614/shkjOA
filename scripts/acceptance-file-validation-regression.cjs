const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const dayjs = require('dayjs');
const {parse} = require('@vue/compiler-sfc');
const source = fs.readFileSync('src/views/project/detail/components/DetailAcceptance.vue','utf8');
const ast = ts.createSourceFile('acceptance.ts',parse(source).descriptor.scriptSetup.content,ts.ScriptTarget.Latest,true);
const fn = ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='validateAcceptance');
let record = {};
const context = {dayjs,activeRecord:()=>record,normalizeResult:v=>v,responsibilityText:()=>'',ACCEPTANCE_REPORT_LIMIT:3,attachmentCount:()=>String(record.acceptanceFormFileId||'').split(',').filter(v=>v.trim()).length};
vm.createContext(context);
vm.runInContext(ts.transpileModule(fn.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,context);
for (const type of ['INTERNAL','CUSTOMER']) {
  record={acceptDate:'2026-09-20',acceptLeaderId:'manager',result:'PASSED',acceptanceFormFileId:'report.pdf'};
  assert.doesNotThrow(()=>context.validateAcceptance(type,true),'实际验收文件足够，不要求竣工报告');
  record.acceptanceFormFileId='';record.completionReportFileId='old.pdf';
  assert.throws(()=>context.validateAcceptance(type,true),/至少一个验收文件/);
  record.acceptanceFormFileId='a,b,c,d';assert.throws(()=>context.validateAcceptance(type,true),/最多 3/);
  record.result='FAILED';record.acceptanceFormFileId='';assert.throws(()=>context.validateAcceptance(type,true),/原因/);
  record.remark='不合格';assert.doesNotThrow(()=>context.validateAcceptance(type,true));
}
assert.doesNotMatch(source,/:show-time=/);
assert.ok(source.includes('value-format="YYYY-MM-DD"'));
console.log('内外验文件必填/数量/失败原因及日期控件回归通过；未验证后端日期粒度');
const submitFn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='handleComplete');
let payload;
record={id:'acceptance',acceptDate:'2026-09-20',acceptLeaderId:'manager',acceptUnitLeader:'客户',acceptUnitName:'TECHNICAL_LEADER',result:'PASSED',acceptanceFormFileId:'report.pdf',reworkId:'record-round'};
Object.assign(context,{
  activeLoading:()=>({value:false}),internalLoading:{value:false},customerLoading:{value:false},uploadBusy:{value:false},canComplete:()=>true,
  assignResponsible:()=>{}, props:{projectId:'period'},currentUserName:{value:'经理'},
  completeProjectAcceptance:async data=>{payload=data;},createMessage:{success:()=>{},warning:m=>{throw Error(m);},error:m=>{throw Error(m);}},
  historyCache:new Map(),load:async()=>{},refreshTodos:async()=>{},emit:()=>{},
});
vm.runInContext(ts.transpileModule(submitFn.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,context);
context.handleComplete('CUSTOMER').then(()=>{
  assert.equal(payload.acceptUnitName,'TECHNICAL_LEADER');
  assert.equal(payload.acceptanceFormFileId,'report.pdf');
  assert.equal(payload.acceptEndDate,'2026-09-20 00:00:00');
  assert.equal(payload.reworkId,'record-round');
  console.log('外验提交函数确实调用接口，角色/验收文件/日期/自身轮次载荷回归通过');
}).catch(e=>{console.error(e);process.exitCode=1;});
