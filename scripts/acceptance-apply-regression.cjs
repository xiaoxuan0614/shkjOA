const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const {parse,compileScript,compileTemplate}=require('@vue/compiler-sfc');
const root='/Users/xuan/AI/ClaudeAllData/SHKKJ-uniapp/';
const files=['src/views/project/detail/components/DetailAcceptance.vue','src/views/project/components/AcceptanceModal.vue','src/views/project/index.vue',root+'src/pages/ops/components/ProjectAcceptancePopup.vue',root+'src/pages/ops/projectDetail.vue'];
async function run(mobile,mode,selected,reason,fail=false){
 const calls=[],forms={INTERNAL:{id:'old-i',result:'PASSED'},CUSTOMER:{id:'old-c',result:'FAILED'}},ref=value=>({value});
 const send=async data=>{calls.push(JSON.parse(JSON.stringify(data)));if(fail)throw Error('事务拒绝');const rows=data.acceptTypes.map(acceptType=>({id:'new-'+acceptType,acceptType,acceptStatus:'IN_PROGRESS'}));return mobile?{success:true,result:rows}:rows;};
 const ctx={recheckLoading:ref(false),internalLoading:ref(false),customerLoading:ref(false),uploadBusy:ref(false),recheckTypes:ref(selected),recheckReason:ref(reason),recheckOpen:ref(true),applicationMode:ref(mode),props:{projectId:'p'},applicationReady:ref(true),activeRecord:t=>forms[t],canSelectApplication:()=>true,applyProjectAcceptance:send,fillInternal:r=>forms.INTERNAL=r,fillCustomer:r=>forms.CUSTOMER=r,internalRecords:ref([]),customerRecords:ref([]),createMessage:{warning:()=>{},success:()=>{},error:()=>{}},historyCache:new Map(),refreshTodos:async()=>{},emit:()=>{},setTimeout:fn=>fn(),document:{getElementById:()=>({scrollIntoView:()=>{}})},busy:ref(false),canApplyNormal:ref(true),canApplyRecheck:ref(true),applicationTypes:ref(selected),applicationReason:ref(reason),selectableTypes:ref(['INTERNAL','CUSTOMER']),submitting:ref(false),periodId:ref('p'),acceptanceApi:{apply:send},forms:ref(forms),records:ref({INTERNAL:[],CUSTOMER:[]}),project:ref({status:'PENDING_ACCEPT'}),applicationOpen:ref(true),focusedSection:ref('')};
 ctx.toast=ctx.createMessage;
 const name=mobile?'submitApplication':'submitRecheck';
 const source=parse(fs.readFileSync(files[mobile?3:0],'utf8')).descriptor.scriptSetup.content;
 const ast=ts.createSourceFile('t.ts',source,ts.ScriptTarget.Latest,true);
 const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);
 vm.runInNewContext(ts.transpileModule(fn.getText(ast)+';this.run='+name,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,ctx);
 await ctx.run();
 const valid=selected.length&&reason.trim().length>0&&reason.trim().length<=400;
 assert.equal(calls.length,valid?1:0,'同一申请只能一次请求');
 if(valid)assert.deepEqual(calls[0],{periodId:'p',acceptTypes:selected,reason:reason.trim(),applyMode:mode});
 if(valid&&!fail){selected.forEach(t=>assert.equal(forms[t].id,'new-'+t));if(!selected.includes('INTERNAL'))assert.equal(forms.INTERNAL.result,'PASSED');assert.equal((mobile?ctx.applicationOpen:ctx.recheckOpen).value,false);}
 else{assert.equal(forms.INTERNAL.id,'old-i');assert.equal(forms.CUSTOMER.id,'old-c');assert.equal((mobile?ctx.applicationOpen:ctx.recheckOpen).value,true);}
 assert.equal((mobile?ctx.submitting:ctx.recheckLoading).value,false);
}
async function main(){
 for(const mobile of [false,true])for(const mode of ['NORMAL','WITHOUT_RECTIFICATION']){
  await run(mobile,mode,['INTERNAL','CUSTOMER'],'  原因  ');await run(mobile,mode,['CUSTOMER'],'复验');await run(mobile,mode,['INTERNAL','CUSTOMER'],'原因',true);await run(mobile,mode,[],'原因');await run(mobile,mode,['INTERNAL'],'  ');await run(mobile,mode,['INTERNAL'],'字'.repeat(401));
 }
 for(const file of files){const {descriptor}=parse(fs.readFileSync(file,'utf8'));compileScript(descriptor,{id:'accept'});assert.equal(compileTemplate({source:descriptor.template.content,filename:file,id:'accept'}).errors.length,0,file);}
 for(const file of ['src/views/project/detail/ProjectDetail.api.ts',root+'src/service/projectAcceptance.ts']){const s=fs.readFileSync(file,'utf8');assert.ok(s.includes('/project/acceptance/apply'));assert.ok(!s.includes('/project/acceptance/submit'));}
 console.log('两端NORMAL/免整改、单项/双项单次事务、必填/400字、失败保留、通过项不覆盖与5个SFC检查通过');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
