const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
let now = 0;
function compile(file) {
  return ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
}
const context = { exports: {}, Date: { now: () => now } };
vm.runInNewContext(compile('src/utils/dict/requestCache.ts'), context);
const { cachedDictRequest: get, clearDictRequestCache: clear } = context.exports;
(async () => {
  let calls = 0;
  const fetcher = async () => { calls++; return [{ value: '1', text: '名称' }]; };
  const first = get('a', 'type', fetcher);
  assert.equal(first, get('a', 'type', fetcher));
  await first;
  await get('a', 'type', fetcher);
  assert.equal(calls, 1);
  now = 300001;
  await get('a', 'type', fetcher);
  assert.equal(calls, 2);
  await get('b', 'type', fetcher);
  assert.equal(calls, 3);
  clear();
  await get('b', 'type', fetcher);
  assert.equal(calls, 4);
  let emptyCalls = 0;
  const empty = async () => { emptyCalls++; return []; };
  await get('b', 'empty', empty); await get('b', 'empty', empty);
  assert.equal(emptyCalls, 1);
  now += 30001; await get('b', 'empty', empty);
  assert.equal(emptyCalls, 2);
  await assert.rejects(get('b', 'bad', async () => { throw new Error('failed'); }));
  await get('b', 'bad', fetcher);
  await assert.rejects(get('b', 'invalid', async () => ({})));
  // Invalidation during a request must not let the old response repopulate cache.
  let resolveOld;
  const old = get('b', 'race', () => new Promise((resolve) => { resolveOld = resolve; }));
  await Promise.resolve(); clear();
  await get('b', 'race', async () => ['new']);
  resolveOld(['old']); await old;
  assert.equal((await get('b', 'race', fetcher))[0], 'new');

  let httpCalls = 0;
  const store = { getToken: 'user', getUserInfo: { id: 'u', loginTenantId: 't' }, getAllDictItems: {} };
  const loader = { exports: {}, require: (id) => {
    if (id.includes('requestCache')) return context.exports;
    if (id.includes('axios')) return { defHttp: { get: async () => { httpCalls++; return ['loaded']; } } };
    if (id.includes('store/modules/user')) return { useUserStore: () => store };
    if (id.includes('utils/auth')) return { getAuthCache: () => ({}) };
    return { DB_DICT_DATA_KEY: 'dict' };
  } };
  vm.runInNewContext(compile('src/utils/dict/index.ts'), loader);
  const { initDictOptions, ajaxGetDictItems } = loader.exports;
  await Promise.all([initDictOptions('x'), initDictOptions('x')]);
  await initDictOptions('x'); assert.equal(httpCalls, 1);
  await initDictOptions(''); assert.equal(httpCalls, 1);
  store.getAllDictItems.x = ['updated'];
  assert.equal((await initDictOptions('x'))[0], 'updated');
  await ajaxGetDictItems('x', { keyword: 'a' });
  assert.equal(httpCalls, 2); // parameterized requests retain their original semantics
  console.log('PASS dictionary cache: sequential/concurrent, TTL, empty, failure, scope, invalidation race, login snapshot, explicit query');
})().catch((error) => { console.error(error); process.exitCode = 1; });
