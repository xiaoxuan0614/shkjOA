const fs = require('node:fs'), assert = require('node:assert/strict'), ts = require('typescript');
const { parse, compileScript } = require('@vue/compiler-sfc');
const { createSSRApp } = require('vue');
const { renderToString } = require('vue/server-renderer');
const helper = {};
new Function('exports', 'require', ts.transpile(fs.readFileSync('src/views/project/contract/quotationSnapshotPreview.ts', 'utf8'), { module: ts.ModuleKind.CommonJS, esModuleInterop: true }))(helper, require);
const file = 'src/views/project/contract/QuotationSnapshotPreview.vue';
const { descriptor } = parse(fs.readFileSync(file, 'utf8'), { filename: file });
const script = compileScript(descriptor, { id: 'no-amounts', inlineTemplate: true });
const component = {};
new Function('exports', 'require', ts.transpile(script.content, { module: ts.ModuleKind.CommonJS, esModuleInterop: true }))(
  component, name => name === './quotationSnapshotPreview' ? helper : require(name));
async function render(props) {
  const app = createSSRApp(component.default, props);
  app.component('a-alert', { template: '<div>金额提示</div>' });
  return renderToString(app);
}
(async () => {
  const quotation = { items: [{ materialName: '物料名称', quantity: 2, unit: '个', finalPrice: 321.12 }], serviceFees: [{ name: '服务名称', quantity: 1, unit: '次', guidePrice: 456.78 }] };
  const html = await render({ quotation, hideAmounts: true });
  for (const text of ['单价', '小计', '合计', '321.12', '456.78', '<tfoot', '金额提示']) assert(!html.includes(text), text);
  assert(html.includes('物料名称') && html.includes('服务名称'));
  assert.equal((html.match(/scope="col"/g) || []).length, 8);
  assert((await render({ quotation: { items: [], serviceFees: [] }, hideAmounts: true })).includes('colspan="8"'));
  const normal = await render({ quotation });
  assert(normal.includes('单价') && normal.includes('小计') && normal.includes('合计'));
  assert(fs.readFileSync('src/views/project/contract/index.vue', 'utf8').includes(':quotation="quotationPreviewData" live hide-amounts'));
  assert(fs.readFileSync('src/views/project/contract/ContractApproval.vue', 'utf8').includes(':quotation="snapshot.quotation" hide-amounts'));
  assert(!fs.readFileSync('src/views/plan/material-draft/editor.vue', 'utf8').includes('hide-amounts'));
  console.log('PASS rendered contract previews: no price/subtotal/total, eight columns, normal quotation unchanged');
})().catch(error => { console.error(error); process.exitCode = 1; });
