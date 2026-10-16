const fs = require('node:fs'), assert = require('node:assert/strict'), ts = require('typescript');
const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc');
const file = 'src/views/project/contract/index.vue';
const source = fs.readFileSync(file, 'utf8');
const { descriptor } = parse(source);
const ast = ts.createSourceFile('contract.ts', descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true);
const fn = name => ts.transpile(ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name).getText(ast));
const periodId = { value: 'p' }, selectedCandidate = { value: { id: 'a' } }, selectedQuotationAccess = { value: {} };
const calls = [], messages = [];
const deps = { periodId, selectedCandidate, selectedQuotationAccess, noQuotationAccess: { canRevise: false },
  getQuotationAccess: (period, id) => new Promise((resolve, reject) => calls.push({ period, id, resolve, reject })),
  createMessage: { error: msg => messages.push(msg) } };
const api = new Function(...Object.keys(deps), 'let quotationAccessSequence=0,quotationAccessKey="",quotationAccessPending;\n'
  + fn('resetQuotationAccess') + fn('refreshSelectedQuotationAccess') + ';return {resetQuotationAccess,refreshSelectedQuotationAccess};')(...Object.values(deps));
(async () => {
  const first = api.refreshSelectedQuotationAccess(), concurrent = api.refreshSelectedQuotationAccess();
  assert.equal(calls.length, 1);
  calls[0].resolve({ canRevise: true }); await Promise.all([first, concurrent]);
  for (let i = 0; i < 4; i++) await api.refreshSelectedQuotationAccess();
  assert.equal(calls.length, 1, 'list refresh/adjust/save/preview must reuse same permission');
  selectedCandidate.value = { id: 'b' }; api.resetQuotationAccess();
  const second = api.refreshSelectedQuotationAccess();
  assert.equal(selectedQuotationAccess.value.canRevise, false);
  selectedCandidate.value = { id: 'c' }; api.resetQuotationAccess();
  const third = api.refreshSelectedQuotationAccess();
  calls[2].resolve({ canRevise: false }); await third;
  calls[1].resolve({ canRevise: true }); await second;
  assert.equal(selectedQuotationAccess.value.canRevise, false, 'stale previous quote cannot grant access');
  api.resetQuotationAccess();
  const reentry = api.refreshSelectedQuotationAccess(); calls[3].reject(new Error('failed')); await reentry;
  assert.equal(messages.length, 1);
  const retry = api.refreshSelectedQuotationAccess(); calls[4].resolve({ canRevise: true }); await retry;
  periodId.value = 'p2'; const otherPeriod = api.refreshSelectedQuotationAccess(); calls[5].resolve({ canRevise: false }); await otherPeriod;
  assert.equal(calls[5].period, 'p2');
  assert.equal(calls.length, 6);
  assert(!fn('loadContractCandidates').includes('selectedQuotationAccess.value ='));
  assert(fn('initializeContract').includes('resetQuotationAccess()'));
  assert(fn('initializeContract').includes('loadContractCandidates(true)'));
  const compiled = compileScript(descriptor, { id: file });
  assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename: file, id: file, compilerOptions: { bindingMetadata: compiled.bindings } }).errors, []);
  console.log('PASS contract permissions: one call/concurrent reuse/switch/reentry/failure retry/stale response/period isolation and SFC');
})().catch(error => { console.error(error); process.exitCode = 1; });
