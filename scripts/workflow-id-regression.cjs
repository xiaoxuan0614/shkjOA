const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto').webcrypto;
const code = ts.transpileModule(fs.readFileSync('src/views/workflow/workflow.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
function load(browserCrypto) {
  const exports = {};
  vm.runInNewContext(code, { exports, crypto: browserCrypto, require: () => ({}) });
  return exports;
}
const uuid = '12345678-1234-4234-8234-123456789abc';
assert.equal(load({ randomUUID: () => uuid }).newId('flow'), `flow_${uuid.replace(/-/g, '')}`);
const http = load({ getRandomValues: bytes => crypto.getRandomValues(bytes) });
const ids = new Set();
for (let i = 0; i < 1000; i++) {
  const id = http.newId('flow');
  assert.match(id, /^flow_[0-9a-f]{12}4[0-9a-f]{3}[89ab][0-9a-f]{15}$/);
  ids.add(id);
}
assert.equal(ids.size, 1000);
assert.match(http.newDefinition().nodes[0].key, /^node_/);
assert.throws(() => load(undefined).newId('flow'), /不支持安全随机数/);
console.log('Workflow ID native, HTTP fallback, UUID format, uniqueness and unsupported-browser checks passed');
