const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { File } = require('node:buffer');
const output = ts.transpileModule(fs.readFileSync('src/utils/documentUploadPolicy.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const mod = { exports: {} };
new Function('exports', 'module', output)(mod.exports, mod);
const { validateDocumentFile, isAllowedDocumentFile, DOCUMENT_UPLOAD_ACCEPT } = mod.exports;
// Minimal ZIP central directory fixture: validates container classification, not Office rendering.
function container(names) {
  const locals = [];
  let offset = 0;
  const entries = names.map(name => {
    const local = Buffer.alloc(30 + Buffer.byteLength(name));
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(Buffer.byteLength(name), 26); local.write(name, 30); locals.push(local);
    const b = Buffer.alloc(46 + Buffer.byteLength(name));
    b.writeUInt32LE(0x02014b50); b.writeUInt16LE(Buffer.byteLength(name), 28); b.write(name, 46); b.writeUInt32LE(offset,42); offset += local.length; return b;
  });
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(names.length, 10);
  end.writeUInt32LE(offset,16);
  return Buffer.concat([...locals, ...entries, end]);
}
(async () => {
  assert.equal(DOCUMENT_UPLOAD_ACCEPT, '.docx,.pdf,.xls,.xlsx');
  for (const name of ['a.doc','a.ppt','a.pptx','a.exe','a.csv']) assert.equal(isAllowedDocumentFile({name}), false);
  for (const name of ['a.DOCX','a.pdf','a.xls','a.xlsx']) assert.equal(isAllowedDocumentFile({name}), true);
  await validateDocumentFile(new File(['%PDF-1.7\n%%EOF'], 'a.pdf'));
  await validateDocumentFile(new File([container(['[Content_Types].xml','word/document.xml'])], 'a.docx'));
  await validateDocumentFile(new File([container(['[Content_Types].xml','xl/workbook.xml'])], 'a.xlsx'));
  await assert.rejects(validateDocumentFile(new File([container(['[Content_Types].xml','xl/workbook.xml'])], 'a.docx')));
  await assert.rejects(validateDocumentFile(new File(['%PDF-1.7 /Encrypt 1 0 R\n%%EOF'], 'a.pdf')), /加密/);
  await assert.rejects(validateDocumentFile(new File([], 'a.pdf')), /为空/);
  await assert.rejects(validateDocumentFile(new File([Buffer.alloc(20*1024*1024+1)], 'a.pdf')), /20 MB/);
  await assert.rejects(validateDocumentFile(new File(['not zip'], 'a.docx')), /实际格式/);
  await assert.rejects(validateDocumentFile(new File(['not PDF'], 'a.pdf')), /实际格式/);
  const supplied = '/Users/xuan/Desktop/智能闸口采购合同（唐山中远）20261009.docx';
  if (fs.existsSync(supplied)) await assert.rejects(validateDocumentFile(new File([fs.readFileSync(supplied)], 'renamed.docx')), /实际格式/);
  const upload = fs.readFileSync('src/utils/documentUpload.ts','utf8');
  assert(upload.indexOf('await validateDocumentFile') < upload.indexOf('await uploadFile'));
  const paths = ['src/views/project/contract/index.vue','src/views/project/detail/components/DetailFile.vue','src/views/project/plan/PlanFileMgmt.vue','src/views/project/apply/ProjectApply.vue','src/views/project/detail/components/DetailAcceptance.vue','src/views/payment/FinanceEntryDrawer.vue'];
  const compiler = require('@vue/compiler-sfc');
  for (const path of paths) {
    const source = fs.readFileSync(path,'utf8');
    assert(source.includes('a-tooltip') && source.includes('DOCUMENT_UPLOAD_HINT'), path);
    const {descriptor, errors} = compiler.parse(source); assert.deepEqual(errors, []);
    assert.deepEqual(compiler.compileTemplate({source: descriptor.template.content, filename:path, id:'test'}).errors, []);
  }
  console.log('PASS document type/size/container validation, renamed DOC rejection and upload tooltip templates');
})().catch(e => { console.error(e); process.exitCode = 1; });
