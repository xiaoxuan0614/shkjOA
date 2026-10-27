const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), ts = require('typescript'), vue = require('@vue/compiler-sfc');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/views/workflow/instanceInitialDetail.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: exportsObject });
(async () => {
  const { readInitialDetail } = exportsObject;
  let calls = 0;
  const fetchDetail = async id => { calls++; return { id, version: calls, fieldPermissions: {} }; };
  const initial = await fetchDetail('a');
  const displayed = await readInitialDetail('a', initial, fetchDetail);
  assert.equal(calls, 1, 'host + first drawer opening only fetch detail once');
  assert.notEqual(displayed, initial, 'drawer must not mutate parent detail');
  displayed.fieldPermissions = { field: 'HIDDEN' };
  assert.equal(Object.keys(initial.fieldPermissions).length, 0);
  await readInitialDetail('a', undefined, fetchDetail);
  assert.equal(calls, 2, 'manual refresh and post-action reload fetch fresh detail');
  await readInitialDetail('b', initial, fetchDetail);
  assert.equal(calls, 3, 'another instance never reuses old data');
  const reopened = await fetchDetail('a');
  await readInitialDetail('a', reopened, fetchDetail);
  assert.equal(calls, 4, 'reopening fetches once again, no lasting cache');
  await assert.rejects(readInitialDetail('a', undefined, async () => ({ id: 'wrong' })), /审批实例不匹配/);
  await assert.rejects(readInitialDetail('a', undefined, async () => { throw new Error('network'); }), /network/);
  for (const file of ['src/views/todo/components/TodoActionHost.vue', 'src/views/workflow/components/InstanceDrawer.vue']) {
    const source = fs.readFileSync(file, 'utf8');
    const { descriptor, errors } = vue.parse(source, { filename: file });
    assert.equal(errors.length, 0);
    const script = vue.compileScript(descriptor, { id: file });
    const compiled = vue.compileTemplate({ source: descriptor.template.content, filename: file, id: file, compilerOptions: { bindingMetadata: script.bindings } });
    assert.equal(compiled.errors.length, 0);
    if (file.includes('TodoActionHost')) {
      assert.ok(source.includes(':initial-detail="workflowInitialDetail"'));
      assert.ok(source.includes('finally { workflowOpening = false; }'));
    } else {
      assert.ok(source.includes('if (props.open) load(props.initialDetail)'));
      assert.ok(source.includes('await load();'), 'post-action reload must not reuse initial data');
    }
  }
  console.log('PASS one-open detail reuse, refresh/reopen, mismatch, failure and SFC');
})().catch(error => { console.error(error); process.exitCode = 1; });
