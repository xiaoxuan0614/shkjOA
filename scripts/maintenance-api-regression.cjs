const fs=require('fs'),vm=require('vm'),ts=require('typescript'),sfc=require('@vue/compiler-sfc'),assert=require('node:assert/strict');
function load(file,deps={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:m,exports:m.exports,require:n=>deps[n]||{}});return m.exports;}
const model=load('src/views/operation/maintenance/maintenance.model.ts');
const plain=x=>JSON.parse(JSON.stringify(x));
assert.throws(()=>model.locationPayload('a',{locationName:'位置',longitude:0,latitude:'',sortNo:0}),/同时/);
assert.throws(()=>model.locationPayload('a',{locationName:'位置',longitude:181,latitude:0,sortNo:0}),/经纬度/);
assert.throws(()=>model.locationPayload('a',{locationName:'位置',longitude:0,latitude:91,sortNo:0}),/经纬度/);
const loc=model.locationPayload('a',{id:'l',archiveId:'wrong',locationName:'零坐标',longitude:0,latitude:0,sortNo:0,version:4,delFlag:1,projectId:'x'});
assert.equal(loc.longitude,'0');assert.equal(loc.archiveId,'a');assert.ok(!('version'in loc)&&!('delFlag'in loc)&&!('projectId'in loc));
assert.equal(model.locationPayload('a',{locationName:'无坐标',longitude:'',latitude:null,sortNo:0}).longitude,null);
const renewed=model.newContract('a',{id:'old',contractName:'原合同',approvalStatus:'APPROVED',attachmentIds:['oldfile'],version:99,scopeMode:'ALL'});
assert.equal(renewed.previousContractId,'old');assert.deepEqual(plain(renewed.attachmentIds),[]);assert.equal(renewed.version,undefined);assert.equal(renewed.startDate,undefined);
assert.ok(!('version' in model.contractPayload({id:'c',archiveId:'a',contractName:'合同',contractNo:'no',version:4},[]).contract));
const payload=model.contractPayload({archiveId:'a',contractName:'合同',contractNo:'no',scopeMode:'ALL',approvalStatus:'APPROVED',contractAmount:0,customerId:'spoof',periodId:'wrong'},[]);
assert.ok(!('approvalStatus'in payload.contract)&&!('customerId'in payload.contract)&&!('periodId'in payload.contract));assert.equal(payload.contract.contractAmount,0);
assert.throws(()=>model.validateSubmit({}),/日期/);
assert.throws(()=>model.validateSubmit({signedDate:'2026-10-30',startDate:'2026-10-30',endDate:'2027-10-30',maintenanceType:'FULL',serviceContent:'服务',contractAmount:0}),/备注/);
const plan={id:'p1',paymentNode:'首款',plannedAmount:30,plannedDate:'2026-11-01',ratio:30,payMethod:'转账',remark:'说明',actualAmount:99,periodId:'bad',maintenanceContractId:'bad'};
const c={archiveId:'a',contractName:'合同',contractNo:'no',scopeMode:'ALL',contractAmount:100,paymentPlans:[plan]};
const aggregate=model.contractPayload(c,[]);assert.equal(aggregate.paymentPlans[0].id,'p1');assert.ok(!('actualAmount'in aggregate.paymentPlans[0])&&!('periodId'in aggregate.paymentPlans[0])&&!('maintenanceContractId'in aggregate.paymentPlans[0]));
assert.deepEqual(plain(model.contractPayload({...c,paymentPlans:[]},[]).paymentPlans),[]);
assert.ok(!('paymentPlans'in model.contractPayload({...c,paymentPlans:undefined},[])));
assert.ok(!('paymentPlans'in model.contractPayload({...c,paymentPlans:null},[])));
assert.deepEqual(plain(renewed.paymentPlans),[]);
for(const p of [{...plan,plannedAmount:0},{...plan,plannedAmount:101},{...plan,plannedAmount:1.123},{...plan,plannedDate:'2026-02-30'},{...plan,paymentNode:''},{...plan,ratio:101}]) assert.throws(()=>model.contractPayload({...c,paymentPlans:[p]},[]));
assert.throws(()=>model.contractPayload({...c,paymentPlans:[plan,plan]},[]),/重复/);
assert.throws(()=>model.contractPayload({...c,paymentPlans:[{...plan,id:'a',plannedAmount:60},{...plan,id:'b',plannedAmount:50}]},[]),/超过/);
let calls=[],response={success:true,code:200,result:{records:[],total:0}};
const api=load('src/views/operation/maintenance/maintenance.api.ts',{'/@/utils/http/axios':{defHttp:{get:async req=>{calls.push(req);return response;},post:async req=>{calls.push(req);return response;}}}});
(async()=>{
await api.archives(2,'项目');assert.deepEqual(plain(calls.at(-1).params),{pageNo:2,pageSize:20,keyword:'项目'});
await api.contracts('archive-only',3);assert.equal(calls.at(-1).params.archiveId,'archive-only');assert.ok(!('periodId'in calls.at(-1).params));
response={success:false,code:500,message:'拒绝'};await assert.rejects(api.archives(),/拒绝/);
response={success:true,code:200,result:{id:'c',archiveId:'other'}};await assert.rejects(api.contractDetail('c','a'),/不匹配/);
response={success:true,code:200,result:[{archiveId:'other'}]};await assert.rejects(api.locations('a'),/不匹配/);
for(const file of ['index','ArchiveLocations','MaintenanceContract']){const {descriptor,errors}=sfc.parse(fs.readFileSync(`src/views/operation/maintenance/${file}.vue`,'utf8'));assert.equal(errors.length,0);sfc.compileScript(descriptor,{id:file});assert.equal(sfc.compileTemplate({source:descriptor.template.content,filename:file+'.vue',id:file}).errors.length,0);}
console.log('PASS maintenance API: archive identity, business errors, whitelists, coordinates, renewal, versions and Vue compilation');
})().catch(e=>{console.error(e);process.exitCode=1;});
