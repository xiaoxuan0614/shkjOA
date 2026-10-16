const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const axios = require('axios');
const exportsBag = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/http/axios/sessionRequests.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: exportsBag, require, URL, AbortController, console });
const s = exportsBag;
const request = (url = '/project/list') => {
  const config = { url, requestOptions: {} };
  s.stampSessionRequest(config);
  return config;
};
const old = request();
s.guardSessionRequest(old, 'test-session');
const queued = request();
let stops = 0;
const unsubscribe = s.onSessionEnd(() => stops++);
s.invalidateSessionRequests(true);
assert.equal(stops, 1);
assert.equal(old.signal.aborted, true);
assert.throws(() => s.guardSessionRequest(queued, 'test-session'), axios.isCancel);
assert.throws(() => s.guardSessionRequest(request(), ''), axios.isCancel);
assert.throws(() => s.finishSessionRequest(old), axios.isCancel);
for (const url of ['/sys/login', '/sys/phoneLogin', '/sys/randomImage/123', '/sys/sms', '/sys/user/phoneVerification', '/sys/user/passwordChange', '/sys/logout']) {
  const config = request(url);
  assert.doesNotThrow(() => s.guardSessionRequest(config, ''));
  assert.doesNotThrow(() => s.finishSessionRequest(config));
}
assert.throws(() => s.guardSessionRequest(request('/sys/user/list'), ''), axios.isCancel);
s.invalidateSessionRequests(false);
assert.throws(() => s.finishSessionRequest(old), axios.isCancel);
assert.throws(() => s.guardSessionRequest(queued, 'new-session'), axios.isCancel);
const current = request();
s.guardSessionRequest(current, 'new-session');
s.finishSessionRequest(current);
s.invalidateSessionRequests(true);
assert.equal(current.signal.aborted, false, 'completed requests are removed');
unsubscribe();
s.invalidateSessionRequests(false);
const controller = new AbortController();
const upload = { url: '/sys/common/upload', signal: controller.signal };
s.guardSessionRequest(upload, 'new-session');
controller.abort();
assert.equal(upload.signal.aborted, true, 'caller cancellation preserved');
s.finishSessionRequest(upload);
const http = fs.readFileSync('src/utils/http/axios/index.ts', 'utf8');
assert(http.indexOf('finishSessionRequest(res.config)') < http.indexOf('if (isReturnNativeResponse)'));
assert(http.indexOf('if (axios.isCancel(error)') < http.indexOf('errorLogStore.addAjaxErrorInfo(error)'));
const store = fs.readFileSync('src/store/modules/user.ts', 'utf8');
const logout = store.slice(store.indexOf('async logout('), store.indexOf('confirmLoginOut()'));
assert(logout.indexOf('await doLogout(token)') < logout.indexOf('invalidateSessionRequests(true)'));
assert(logout.indexOf('const token = this.getToken') < logout.indexOf('invalidateSessionRequests(true)'));
assert(logout.includes('if (logoutTask) return logoutTask'));
assert(!logout.includes('setTimeout('));
const removeBroken = s.onSessionEnd(() => { throw new Error('socket close failed'); });
let continued = false;
const removeFollowing = s.onSessionEnd(() => { continued = true; });
assert.doesNotThrow(() => s.invalidateSessionRequests(true));
assert(continued, 'one failed cleanup must not prevent remaining cleanup or logout');
removeBroken(); removeFollowing();
const ast = ts.createSourceFile('user.ts', store, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
let method;
function visit(node) {
  if (ts.isMethodDeclaration(node) && node.name.getText(ast) === 'logout') method = node.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
const events = [];
let settle;
const actionContext = {
  logoutTask: undefined, console, invalidateSessionRequests: () => events.push('invalidate'),
  useMyWebSocket: () => ({ close() { throw new Error('closed socket'); } }),
  doLogout: token => { events.push(['request', token]); return new Promise((resolve, reject) => { settle = { resolve, reject }; }); },
  useMessage: () => ({ createMessage: { error: () => events.push('error') } }),
  usePermissionStore: () => ({ $reset: () => events.push('permissions-clear') }),
  useMultipleTabStore: () => ({ resetState: () => events.push('tabs-clear') }),
  setAuthCache() {}, TOKEN_KEY: 'token', JDragConfigEnum: { DRAG_BASE_URL: 'drag' },
  localStorage: { removeItem() {} }, PageEnum: { BASE_LOGIN: '/login' },
  router: { currentRoute: { value: { path: '/home', fullPath: '/home' } }, push: async value => events.push(['navigate', value.path]) },
  navigateAfterLogout: async (_router, path) => events.push(['navigate', path]),
};
const action = vm.runInNewContext(`(${method.replace('async logout(', 'async function(')})`, actionContext);
const user = { getToken: 'old-session', setToken(v) { this.getToken = v; },
  setSessionTimeout() {}, setUserInfo() {}, setRoleList() {}, setLoginInfo() {}, setAllDictItems() {} };
(async () => {
  const first = action.call(user, true);
  const duplicate = action.call(user, true);
  await Promise.resolve();
  assert.equal(user.getToken, 'old-session', 'pending logout keeps session');
  assert.equal(events.filter(e => Array.isArray(e) && e[0] === 'request').length, 1);
  settle.resolve();
  await Promise.all([first, duplicate]);
  assert.equal(user.getToken, '');
  assert.deepEqual(events.find(e => Array.isArray(e) && e[0] === 'request'), ['request', 'old-session']);
  assert.deepEqual(events.find(e => Array.isArray(e) && e[0] === 'navigate'), ['navigate', '/login']);
  assert(events.includes('permissions-clear')); assert(events.includes('tabs-clear'));
  user.getToken = 'retry-session'; events.length = 0;
  const failed = action.call(user, true);
  await Promise.resolve(); settle.reject(new Error('server failure'));
  await assert.rejects(failed, /server failure/);
  assert.equal(user.getToken, 'retry-session');
  assert(!events.includes('invalidate'));
  assert(!events.some(e => Array.isArray(e) && e[0] === 'navigate'));
  assert(events.includes('error'));
  console.log('PASS logout waits for success, clears permissions/tabs and navigates; failure retains session; concurrent calls deduplicated');
})().catch(error => { console.error(error); process.exitCode = 1; });
console.log('PASS: exit gate, in-flight abort, queued requests, stale responses after relogin, public endpoints, cleanup, upload cancellation and logout order');
