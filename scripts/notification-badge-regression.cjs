const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const sfc = require('@vue/compiler-sfc');
const file = 'src/layouts/default/header/components/notify/index.vue';
const descriptor = sfc.parse(fs.readFileSync(file, 'utf8')).descriptor;
const source = sfc.compileScript(descriptor, { id: 'badge-test' }).content;
const pending = [], timers = new Map();
let exiting = false, endSession, cleanup, timerId = 0;
const context = {
  exports: {},
  setTimeout(fn) { timers.set(++timerId, fn); return timerId; },
  clearTimeout(id) { timers.delete(id); },
  window: { removeEventListener() {} }, document: { removeEventListener() {} },
  require(name) {
    if (name === 'vue') return {
      defineComponent: x => x, ref: value => ({ value }), watch() {}, onMounted() {},
      onBeforeUnmount(fn) { cleanup = fn; },
    };
    if (name.endsWith('useDesign')) return { useDesign: () => ({ prefixCls: 'notify' }) };
    if (name.endsWith('/setting')) return { useGlobSetting: () => ({}) };
    if (name.endsWith('/user')) return { useUserStore: () => ({ getUserInfo: { id: 'user' } }) };
    if (name.endsWith('/auth')) return { getToken: () => 'token' };
    if (name.endsWith('/Modal')) return { useModal: () => [null, {}] };
    if (name.endsWith('/sessionRequests')) return {
      isSessionExiting: () => exiting,
      onSessionEnd: fn => { endSession = fn; return () => {}; },
    };
    if (name.endsWith('/useWebSocket')) return { useMyWebSocket: () => null, offWebSocket() {} };
    if (name === './notification.api') return {
      notificationUnreadCount: () => new Promise(resolve => pending.push(resolve)),
    };
    return {};
  },
};
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, context);
const state = context.exports.default.setup({}, { expose() {} });
(async () => {
  const first = state.loadCount(), second = state.loadCount();
  pending[1]({ count: 7 }); await second;
  pending[0]({ count: 100 }); await first;
  assert.equal(state.messageCount.value, 7, 'late responses cannot overwrite current count');
  assert.doesNotMatch(descriptor.template.content, /@count=/, 'list totals must not overwrite badge');
  assert.match(descriptor.template.content, /@read="loadCount"/, 'reading history must query count rather than subtract');
  state.refresh(); state.refresh(); state.refresh();
  assert.equal(timers.size, 1, 'burst messages coalesce');
  let refreshed = 0;
  state.center.value = { refreshList() { refreshed++; return true; } };
  const callback = [...timers.values()][0]; timers.clear(); callback();
  assert.equal(refreshed, 1);
  assert.equal(pending.length, 3, 'open list refresh never suppresses dedicated count');
  let shown = 0;
  state.center.value.show = () => shown++;
  state.showNotifications();
  assert.equal(shown, 1);
  assert.equal(pending.length, 3, 'opening bell must not request count');
  assert.doesNotMatch(source, /addEventListener\(['"](?:focus|visibilitychange)/);
  state.onMessage({ cmd: 'ping' });
  assert.equal(timers.size, 0, 'heartbeat does not refresh');
  state.onMessage({ cmd: 'user' });
  assert.equal(timers.size, 1, 'business notification refreshes');
  state.showNotifications();
  assert.equal(timers.size, 1, 'opening bell must not cancel a queued business refresh');
  exiting = true; endSession();
  pending[2]({ count: 99 }); await Promise.resolve();
  assert.equal(state.messageCount.value, 7, 'logout invalidates in-flight response');
  await state.loadCount(); state.refresh();
  assert.equal(pending.length, 3); assert.equal(timers.size, 0);
  cleanup();
  console.log('PASS notification badge: independent count, coalescing, stale responses, session exit');
})().catch(error => { console.error(error); process.exitCode = 1; });
