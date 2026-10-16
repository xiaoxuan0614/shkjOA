const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const code = ts.transpileModule(fs.readFileSync('src/utils/auth/logoutNavigation.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
async function test(mode) {
  const urls = [], timers = new Map();
  const context = { exports: {}, window: { location: { replace: url => urls.push(url) } },
    setTimeout: fn => { timers.set(1, fn); return 1; }, clearTimeout: id => timers.delete(id) };
  vm.runInNewContext(code, context);
  const router = { currentRoute: { value: { path: '/project/detail/1', fullPath: '/project/detail/1' } },
    resolve: target => {
      assert.equal(JSON.stringify(target), JSON.stringify({ path: '/login' }));
      return { href: '/oa/#/login' };
    },
    replace: async () => {
      assert.fail('logout must not rely on SPA navigation or its reported success');
      if (mode === 'success') router.currentRoute.value.path = '/login';
      if (mode === 'error') throw new Error('route import failure');
      if (mode === 'pending' || mode === 'relogin') return new Promise(() => {});
      return mode === 'cancel' ? { type: 4 } : undefined;
    } };
  const pending = context.exports.navigateAfterLogout(router, '/login');
  await pending;
  assert.equal(urls.length, 1, mode);
  if (urls.length) assert.equal(urls[0], '/oa/#/login');
  assert.equal(timers.size, 0);
}
(async () => {
  for (const mode of ['success', 'cancel', 'error', 'pending', 'relogin']) await test(mode);
  const guard = fs.readFileSync('src/router/guard/stateGuard.ts', 'utf8');
  assert.match(guard, /!failure && to.path === PageEnum.BASE_LOGIN/);
  console.log('PASS logout navigation: unconditional full-page replacement after confirmed logout, base/hash URL');
})().catch(error => { console.error(error); process.exitCode = 1; });
