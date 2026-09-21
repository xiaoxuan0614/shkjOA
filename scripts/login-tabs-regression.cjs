const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the real store actions without a browser, credentials or backend writes.
function loadStore(path, mocks) {
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require: (name) => mocks[name] || {},
    localStorage: { setItem() {} },
    Set, Date, console,
  }, { filename: path });
  return module.exports;
}

async function main() {
  const local = new Map([['tabs', ['old']], ['other', 'preserve']]);
  const session = new Map([['tabs', ['old']], ['other', 'preserve']]);
  const writes = [];
  const common = { pinia: { defineStore: (_id, options) => options } };
  const definition = loadStore('src/store/modules/multipleTab.ts', {
    ...common,
    '/@/settings/projectSetting': { default: { multiTabsSetting: { cache: true } } },
    '/@/enums/cacheEnum': { MULTIPLE_TABS_KEY: 'tabs' },
    '/@/utils/cache/persistent': { Persistent: {
      getLocal: (key) => local.get(key),
      removeLocal: (key, immediate) => { local.delete(key); writes.push(immediate); },
      removeSession: (key, immediate) => { session.delete(key); writes.push(immediate); },
    } },
  }).useMultipleTabStore;
  const tabs = { ...definition.state(), ...definition.actions };
  tabs.cacheTabList.add('old-component'); tabs.lastDragEndIndex = 9; tabs.redirectPageParam = { path: '/old' };
  tabs.resetState();
  assert.equal(tabs.tabList.length, 0);
  assert.equal(tabs.cacheTabList.size, 0);
  assert.equal(tabs.lastDragEndIndex, 0);
  assert.equal(tabs.redirectPageParam, null);
  assert.equal(local.has('tabs'), false); assert.equal(session.has('tabs'), false);
  assert.equal(local.get('other'), 'preserve'); assert.equal(session.get('other'), 'preserve');
  assert.deepEqual(writes, [true, true]);
  assert.equal(definition.state().tabList.length, 0);

  let resets = 0;
  const user = loadStore('src/store/modules/user.ts', {
    ...common,
    '/@/store/modules/multipleTab': { useMultipleTabStore: () => ({ resetState: () => resets++ }) },
    '/@/router': { router: { currentRoute: { value: { query: {} } } } },
    '/@/hooks/setting': { useGlobSetting: () => ({ domainUrl: '' }) },
    '/@/enums/jeecgEnum': { JDragConfigEnum: { DRAG_BASE_URL: 'drag' } },
  }).useUserStore.actions;
  const context = { getToken: '', getUserInfoAction: async () => ({}), setLoginInfo() {}, setSessionTimeout(value) { this.sessionTimeout = value; } };
  await user.afterLoginAction.call(context, false, {});
  assert.equal(resets, 0);
  context.getToken = 'test-only';
  context.getUserInfoAction = async () => { throw new Error('authentication failed'); };
  await assert.rejects(user.afterLoginAction.call(context, false, {}));
  assert.equal(resets, 0);
  context.getUserInfoAction = async () => ({});
  await user.afterLoginAction.call(context, false, {});
  context.sessionTimeout = true;
  await user.afterLoginAction.call(context, false, {});
  assert.equal(resets, 2);
  assert.equal(context.sessionTimeout, false);
  console.log('Login tab regression passed: memory/cache reset, persisted reload, unrelated cache retained, success/timeout/failure branches.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
