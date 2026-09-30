const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(path,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:id=>mocks[id]||require(id)});return exports;}
const view=load('src/views/workflow/instancePresentation.ts');
assert.equal(view.processName({processName:' 历史名称 ',processKey:'flow_internal'}),'历史名称');
assert.equal(view.processName({processName:' ',processKey:'flow_internal'}),'流程名称暂不可用');
assert.equal(view.roundLabel(undefined),'轮次状态暂不可用');
assert.equal(view.roundLabel(false),'历史轮次');
assert.equal(view.roundLabel(true),'最新轮次');
assert.equal(view.returnOptions({actions:['RETURN'],returnTargets:['START']}).length,0);
assert.equal(view.returnOptions({actions:[],returnTargetOptions:[{nodeKey:'START',nodeName:'发起人'}]}).length,0);
const task={actions:['RETURN'],returnTargetOptions:[{nodeKey:'a',nodeName:'同名节点'},{nodeKey:'b',nodeName:'同名节点'},{nodeKey:'START',nodeName:'发起人'}]};
assert.deepEqual(JSON.parse(JSON.stringify(view.returnOptions(task))),[{value:'a',label:'同名节点'},{value:'b',label:'同名节点'},{value:'START',label:'发起人'}]);
const calls=[];const http={get:async c=>{calls.push(c);return {success:true,code:200,result:{records:[],total:0}};}};
const api=load('src/views/workflow/Workflow.api.ts',{'/@/utils/http/axios':{defHttp:http}, './starterScope':load('src/views/workflow/starterScope.ts')});
(async()=>{await api.myInstances(2);assert.equal(calls.at(-1).params.latestOnly,true);assert.equal(calls.at(-1).params.pageNo,2);await api.myInstances(1,false);assert.equal(calls.at(-1).params.latestOnly,false);await api.handledInstances();assert.equal(calls.at(-1).params.latestOnly,false);await api.handledInstances(1,true);assert.equal(calls.at(-1).params.latestOnly,true);await api.instanceRounds('old-round',3);assert.equal(calls.at(-1).params.instanceId,'old-round');assert.equal(calls.at(-1).params.pageNo,3);assert.equal('latestOnly' in calls.at(-1).params,false);console.log('Instance names, round labels, return targets and server pagination contracts passed');})().catch(e=>{console.error(e);process.exitCode=1;});

assert.equal(view.peopleNames([]), '—');
assert.equal(view.peopleNames(null), '—');
assert.equal(view.peopleNames([{userId:'1',userName:'张三'},{userId:'2',userName:'李四'}]), '张三、李四');
assert.equal(view.peopleNames([{userId:'1',userName:' '},{userId:'2',userName:null}]), '1、2');
console.log('Personnel names: multiple users, empty array and missing-name fallback passed');
