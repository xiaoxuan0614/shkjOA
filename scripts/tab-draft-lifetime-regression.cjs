const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), assert = require('node:assert/strict');
const values = new Map();
const sessionStorage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
function load() {
  const context = { exports: {}, sessionStorage };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/tabDraftLifetime.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context);
  return context.exports;
}
const api = load();
values.set('quote', 'legacy');
const quote = api.bindTabDraft('/quote', 'quote');
assert.equal(values.has('quote'), false, '旧无归属草稿不复活');
values.set('quote', 'rows');
let attachmentRemoved = false;
const project = api.bindTabDraft('/project', 'project', () => { attachmentRemoved = true; });
values.set('project', 'form'); values.set('preference', 'keep');
assert.equal(quote.isOpen(), true);
api.closeTabDrafts(['/project?mode=create']);
assert.equal(project.isOpen(), false); assert.equal(attachmentRemoved, true);
assert.equal(values.has('project'), false); assert.equal(values.get('quote'), 'rows');
quote.release(); assert.equal(quote.isOpen(), false);
assert.equal(values.get('quote'), 'rows', '普通卸载/刷新不等于关闭标签');
const refreshed = load();
refreshed.closeTabDrafts(['/quote']);
assert.equal(values.has('quote'), false, '刷新后尚未挂载的标签仍能清草稿');
const reopened = refreshed.bindTabDraft('/quote', 'quote');
assert.equal(reopened.isOpen(), true); assert.equal(values.has('quote'), false);
values.set('quote', 'new'); refreshed.clearTabDrafts();
assert.equal(reopened.isOpen(), false); assert.equal(values.has('quote'), false);
assert.equal(values.get('preference'), 'keep');
const store = fs.readFileSync('src/store/modules/multipleTab.ts', 'utf8');
assert.match(store, /closeTabDrafts\(\[fullPath \|\| route.path\]\)/);
assert.match(store, /closeTabDrafts\(closing.map/);
assert.match(store, /async closeAllTab[^]*?closeTabDrafts/);
for (const name of ['closeLeftTabs', 'closeRightTabs', 'closeOtherTabs']) {
  const body = store.slice(store.indexOf(`async ${name}`), store.indexOf('\n    },', store.indexOf(`async ${name}`)));
  assert.match(body, /bulkCloseTabs/);
}
console.log('PASS tab-owned drafts: close/reopen, late writes, other tabs, attachments, refresh ownership, legacy, close entrypoints');
