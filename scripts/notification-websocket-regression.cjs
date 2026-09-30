const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
let token = 'test-token';
let connection;
const context = {
  exports: {}, console: { debug() {}, error() {}, log() {} },
  require(name) {
    if (name === '/@/utils/auth') return { getToken: () => token };
    if (name === '@vueuse/core') return { useWebSocket: (url, options) => {
      connection = { url, options };
      return { close() {} };
    } };
    throw new Error(name);
  },
};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/hooks/web/useWebSocket.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, context);
const api = context.exports;
assert.equal(api.notificationWebSocketUrl('https://example.test/shouhuiApi/', 'u1'), 'wss://example.test/shouhuiApi/websocket/u1');
assert.equal(api.notificationWebSocketUrl('http://example.test/shouhuiApi', 123), 'ws://example.test/shouhuiApi/websocket/123');
assert.equal(api.notificationWebSocketUrl('wss://example.test/shouhuiApi', 'a/b'), 'wss://example.test/shouhuiApi/websocket/a%2Fb');
let opened = 0;
api.connectWebSocket(api.notificationWebSocketUrl('https://example.test/shouhuiApi', 'u1'), () => opened++);
assert.equal(connection.options.protocols[0], token);
assert.ok(!connection.url.includes(token));
assert.equal(connection.options.heartbeat.message, 'ping');
assert.equal(connection.options.autoReconnect.delay, 5000);
connection.options.onConnected();
assert.equal(opened, 1);
const messages = [];
const listener = data => messages.push(data);
api.onWebSocket(listener);
api.onWebSocket(listener);
for (const data of ['ping', 'pong', 'bad json', 'null', '[]', '42']) connection.options.onMessage(null, { data });
assert.equal(messages.length, 0);
for (const cmd of ['topic', 'user']) connection.options.onMessage(null, { data: JSON.stringify({ cmd }) });
assert.equal(messages.length, 2);
token = 'other-token';
connection.options.onConnected();
connection.options.onMessage(null, { data: '{"cmd":"user"}' });
assert.equal(opened, 1);
assert.equal(messages.length, 2);
token = '';
const previous = connection;
api.connectWebSocket('wss://example.test/');
assert.equal(connection, previous);
api.offWebSocket(listener);
console.log('通知 WebSocket 地址、Token 子协议、心跳过滤、消息分发、旧 Token 隔离回归通过');
