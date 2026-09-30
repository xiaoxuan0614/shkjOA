const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const sfc = require('@vue/compiler-sfc');
const root = 'src/layouts/default/header/components/notify/';
const descriptor = sfc.parse(fs.readFileSync(root + 'NotificationCenter.vue', 'utf8')).descriptor;
const compiled = ts.transpileModule(sfc.compileScript(descriptor, { id: 'notification-test' }).content, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
function setup() {
  const calls = [], events = [], cleanup = [];
  let failRead = false, release;
  let blockRead = false;
  const item = { id: 'send-1', anntId: 'notice-1', msgContent: '正文<br/>第二行', readFlag: 0 };
  const api = {
    notificationPage: async (params) => { calls.push(['list', params]); return { records: [{ ...item }], total: 11 }; },
    markNotificationRead: async (id) => {
      calls.push(['read', id]);
      if (blockRead) await new Promise((resolve) => (release = resolve));
      if (failRead) throw new Error('failed');
    },
    notificationDetail: () => { throw new Error('Detail endpoint must not be called'); },
  };
  const context = { exports: {}, require: (name) => {
    if (name === 'vue') return {
      defineComponent: (value) => value, ref: (value) => ({ value }),
      computed: (fn) => ({ get value() { return fn(); } }), onBeforeUnmount: (fn) => cleanup.push(fn),
    };
    if (name === './notification.api') return api;
    if (name === './notificationTodo') return { notificationTodo: () => null };
    if (name === 'vue-router') return { useRouter: () => ({}) };
    if (name.includes('useMessage')) return { useMessage: () => ({ createMessage: {} }) };
    return {};
  }};
  vm.runInNewContext(compiled, context);
  let exposed;
  const state = context.exports.default.setup({ unread: 11 }, { emit: (...args) => events.push(args), expose: (value) => (exposed = value) });
  return { state, exposed, calls, events, item, cleanup, fail: (value) => (failRead = value), block: () => (blockRead = true), release: () => release() };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));
(async () => {
  const t = setup();
  assert.equal(t.state.summary({ msgSummary: ' 项目-一期，已通过 ', msgContent: '详细正文', msgAbstract: '导航摘要' }), '项目-一期，已通过');
  assert.equal(t.state.summary({ msgContent: '详细正文', msgAbstract: '导航摘要' }), '');
  assert.equal(t.state.summary({ msgSummary: null }), '');
  assert.equal(t.state.summary({ msgSummary: '长'.repeat(200) }).length, 200, 'truncate by visual lines, not character count');
  assert.equal(t.state.summary({ msgSummary: '<b>纯文本</b>' }), '<b>纯文本</b>');
  assert.match(descriptor.template.content, /\{\{ summary\(item\) \}\}/, 'summary must use escaped text interpolation');
  assert.match(descriptor.styles[0].content, /-webkit-line-clamp:\s*2;/);
  t.exposed.show(); await tick();
  assert.equal(t.calls.length, 1);
  assert.equal(t.calls[0][0], 'list');
  assert.equal(t.events[0][0], 'count'); assert.equal(t.events[0][1], 11);
  await t.state.showDetail(t.item);
  assert.equal(t.calls.length, 2); assert.equal(t.calls[1][0], 'read');
  assert.equal(t.state.detail.value.msgContent, t.item.msgContent);
  assert.equal(t.state.records.value.length, 0); assert.equal(t.state.total.value, 10);
  await t.state.showDetail(t.item);
  assert.equal(t.calls.length, 2, 'reopening a completed read must not request');
  await t.state.showDetail({ ...t.item, anntId: 'already-read', readFlag: 1 });
  assert.equal(t.calls.length, 2);
  const failed = setup(); failed.fail(true);
  await failed.state.showDetail(failed.item);
  assert.equal(failed.events.length, 0); assert.equal(failed.state.detail.value.readFlag, 0);
  assert.ok(failed.state.readError.value);
  failed.fail(false); await failed.state.markRead();
  assert.equal(failed.events.filter(([name]) => name === 'read').length, 1);
  const concurrent = setup(); concurrent.block();
  const first = concurrent.state.showDetail(concurrent.item);
  await concurrent.state.showDetail(concurrent.item);
  assert.equal(concurrent.calls.length, 1, 'deduplicate simultaneous read requests');
  concurrent.release(); await first;
  assert.equal(concurrent.state.detail.value.readFlag, 1);
  const disposed = setup(); disposed.block();
  const pending = disposed.state.showDetail(disposed.item);
  disposed.cleanup.forEach((fn) => fn()); disposed.release(); await pending;
  assert.equal(disposed.events.length, 0, 'old session must not mutate badge');
  const background = setup(); background.exposed.show(); await tick();
  assert.equal(background.exposed.refreshList(), true, 'unfiltered unread list supplies badge total');
  await tick(); assert.equal(background.calls.length, 2);
  background.state.keyword.value = '搜索';
  assert.equal(background.exposed.refreshList(), false, 'filtered total is not global unread count');
  console.log('PASS notification request counts, local read update, retry, duplicate clicks, unmount and unread total reuse');
})().catch((error) => { console.error(error); process.exitCode = 1; });
