const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const sfc = require('@vue/compiler-sfc');
const file = 'src/views/plan/material-draft/editor.vue';
const { descriptor } = sfc.parse(fs.readFileSync(file, 'utf8'));
const source = descriptor.scriptSetup.content;
const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const fn = name => ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === name).getText(ast);
const refresh = fn('refreshAfterSubmit');
assert(!/refreshAfterWrite|router\.|tableRef|loadRejection|getCandidateRecord|tableEpoch/.test(refresh));
assert(fn('submit').includes('await refreshAfterSubmit(submitted)'));
assert(!fn('submit').includes('refreshAfterWrite'));
assert(fn('submit').indexOf('await verifyCurrent()') < fn('submit').indexOf("candidateAction('submit'"));
const js = ts.transpileModule(refresh, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
async function check(result, failure = false) {
  const state = Object.fromEntries(Object.entries({ candidateId: 'q1', record: { id: 'q1', version: 4, status: '0' }, candidateName: '报价', editing: false,
    pricingUnlocked: false, rejectionReason: '旧原因', rejectionLoadError: '', rejectionLoading: true, access: {}, needsRecovery: false, loaded: true
  }).map(([k, value]) => [k, { value }]));
  let requests = 0;
  const env = { ...state, quotationVersion: v => { if (!Number.isSafeInteger(v)) throw Error(); return v; },
    quotationDraft: { clear() {} }, noQuotationAccess: {}, reloadAccess: async () => { requests++; if (failure) throw Error(); } };
  const run = new Function(...Object.keys(env), `let rejectionSequence = 0; ${js}; return refreshAfterSubmit;`)(...Object.values(env));
  const valid = result && result.id === 'q1' && result.status === '2' && result.version > 4;
  if (!valid || failure) {
    await assert.rejects(run(result), /勿重复提交/);
    assert.equal(state.loaded.value, false);
    assert.equal(state.needsRecovery.value, true);
  } else {
    await run(result);
    assert.equal(state.record.value, result);
    assert.equal(state.loaded.value, true, 'table stays mounted');
    assert.equal(state.rejectionReason.value, '');
    assert.equal(state.rejectionLoading.value, false);
  }
  assert.equal(requests, valid ? 1 : 0);
}
(async () => {
  await check({ id: 'q1', version: 5, status: '2' });
  await check({ id: 'q1', version: 5, status: '2' }, true);
  for (const result of [null, {}, { id: 'other', version: 5, status: '2' }, { id: 'q1', version: 4, status: '2' }, { id: 'q1', version: 5, status: '-1' }]) await check(result);
  sfc.compileScript(descriptor, { id: file });
  assert.deepEqual(sfc.compileTemplate({ source: descriptor.template.content, filename: file, id: file }).errors, []);
  console.log('PASS submit: one permission refresh, no remount/requery, current version and failure recovery');
})().catch(error => { console.error(error); process.exitCode = 1; });
