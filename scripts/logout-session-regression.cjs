const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const axios = require('axios');
const exportsBag = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/http/axios/sessionRequests.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: exportsBag, require, URL, AbortController });
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
assert(logout.indexOf('invalidateSessionRequests(true)') < logout.indexOf('await doLogout()'));
assert(logout.indexOf('await doLogout()') < logout.indexOf("this.setToken('')"));
assert(logout.includes('if (logoutTask) return logoutTask'));
assert(!logout.includes('setTimeout('));
console.log('PASS: exit gate, in-flight abort, queued requests, stale responses after relogin, public endpoints, cleanup, upload cancellation and logout order');
