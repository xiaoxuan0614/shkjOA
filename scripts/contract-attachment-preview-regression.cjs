const assert = require('node:assert/strict');
const fs = require('node:fs');
const { File } = require('node:buffer');
const ts = require('typescript');
const sfc = require('@vue/compiler-sfc');
const source = fs.readFileSync('src/views/project/contract/ContractApproval.vue', 'utf8');
const ast = ts.createSourceFile('approval.ts', sfc.parse(source).descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true);
const fn = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'download');
assert(source.includes('@click="download(file, true)"'));
assert(source.includes('@click="download(file)"'));
async function run() {
  const downloading = { value: '' }, actionError = { value: '' };
  const previews = [], downloads = [], requests = [];
  let fail = false;
  const invoke = new Function('generation', 'downloading', 'actionError', 'props', 'contractApprovalAttachment', 'previewFileInModal', 'downloadByData', 'File', ts.transpile(fn.getText(ast)) + '\nreturn download;')(
    1, downloading, actionError, { instanceId: 'round' }, async (...args) => {
      requests.push(args);
      if (fail) throw Error('没有附件权限');
      return new Blob(['frozen bytes']);
    }, f => previews.push(f), (...args) => downloads.push(args), File);
  await invoke({ id: 'attachment', fileName: '合同.pdf' }, true);
  assert.deepEqual(requests[0], ['round', 'attachment']);
  assert.equal(previews[0].name, '合同.pdf');
  assert.equal(await previews[0].text(), 'frozen bytes');
  assert.equal(downloads.length, 0);
  await invoke({ id: 'attachment', fileName: '合同.pdf' });
  assert.equal(downloads.length, 1);
  fail = true;
  await invoke({ id: 'attachment' }, true);
  assert.equal(previews.length, 1);
  assert.equal(actionError.value, '没有附件权限');
  assert.equal(downloading.value, '');
  downloading.value = 'busy';
  await invoke({ id: 'attachment' }, true);
  assert.equal(requests.length, 3);
  console.log('PASS contract attachment: authorized frozen bytes, preview/download separation, errors and duplicate guard');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
