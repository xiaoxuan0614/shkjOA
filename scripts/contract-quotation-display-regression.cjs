const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const source = fs.readFileSync('src/views/project/contract/index.vue', 'utf8');
const fn = source.slice(source.indexOf('  async function loadContractCandidates('), source.indexOf('  async function openQuotation('));
const js = ts.transpileModule(fn, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
async function check(records, selected, failure = false) {
  const ref = value => ({ value });
  const env = { candidatesLoading:ref(false), candidatesFailed:ref(false), quotationAccess:ref({}), noQuotationAccess:{}, periodId:ref('p'), contractCandidates:ref([]), materialCandidateId:ref(selected),
    getAllMaterialCandidates:async()=>{ if(failure) throw Error('network'); return records; }, getQuotationAccess:async()=>{throw Error('permissions unavailable');}, isQuotationAdopted:r=>String(r.adopted)==='1', createMessage:{error(){}} };
  vm.createContext(env);vm.runInContext(js,env);await env.loadContractCandidates(true);return env;
}
(async()=>{
  const rows=[{id:'adopted',adopted:1,status:'-1',candidateName:'修订报价'},{id:'other',adopted:0,status:'1'}];
  let env=await check(rows);assert.equal(env.materialCandidateId.value,'adopted');assert.equal(env.candidatesFailed.value,false,'permissions failure must not erase relation');
  env=await check(rows,'explicit');assert.equal(env.materialCandidateId.value,'explicit');
  env=await check([]);assert.equal(env.materialCandidateId.value,undefined);
  env=await check(rows,undefined,true);assert.equal(env.candidatesFailed.value,true);
  env=await check([{id:'a',adopted:1},{id:'b',adopted:1}]);assert.equal(env.candidatesFailed.value,true);assert.equal(env.materialCandidateId.value,undefined);
  const expression=source.match(/const contractCandidateOptions = computed\(\s*\(\) =>([\s\S]*?)\n  \);/)[1];
  const options=vm.runInNewContext(expression,{contractCandidates:{value:rows},materialCandidateId:{value:'adopted'},QUOTATION_STATUS_APPROVED:'1'});
  assert.equal(options.length,2);assert.equal(options[0].label,'修订报价');
  console.log('PASS contract quotation display: adopted fallback, explicit relation, draft display, failures and ambiguity');
})().catch(e=>{console.error(e);process.exitCode=1;});
