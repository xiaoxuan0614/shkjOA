const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const sfc = require('@vue/compiler-sfc');
const source = fs.readFileSync('src/views/material/apply/components/MaterialSelectDrawer.vue', 'utf8');
const { descriptor, errors } = sfc.parse(source);
assert.deepEqual(errors, []);
sfc.compileScript(descriptor, { id: 'brands' });
assert.deepEqual(sfc.compileTemplate({ source: descriptor.template.content, filename: 'brands.vue', id: 'brands' }).errors, []);
const ast = ts.createSourceFile('brands.ts', descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true);
const fn = name => ts.transpile(ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === name).getText(ast));
const optionNode = ast.statements.find(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(ast) === 'brandOptions'));
function create(loader) {
  const map = { value: {} };
  const api = new Function('brandMap', 'initDictOptions', 'computed', `let brandMapLoaded=false, brandMapRequest=null;
    ${fn('ensureBrandMap')} ${fn('filterBrandOption')}
    ${ts.transpile(optionNode.getText(ast))}
    return {load:ensureBrandMap, filter:filterBrandOption, options:brandOptions};`)(map, loader, fn => ({ get value() { return fn(); } }));
  return api;
}
(async () => {
  let count = 0;
  const api = create(async code => { count++; assert.equal(code, 'material_brand'); return [
    { text: '海康威视', value: 'hk' }, { text: 'HUAWEI 华为', value: 'hw' }, { label: '其他品牌', value: 0 },
  ]; });
  await Promise.all([api.load(), api.load()]);
  assert.equal(count, 1, '共享在途字典请求');
  assert.equal(api.options.value.length, 3, '不依赖当前页出现的品牌');
  assert.equal(api.options.value.filter(option => api.filter('', option)).length, 3, '未输入时完整展开');
  assert.deepEqual(api.options.value.filter(option => api.filter(' 康 ', option)).map(o => o.value), ['hk']);
  assert.deepEqual(api.options.value.filter(option => api.filter('huawei', option)).map(o => o.value), ['hw']);
  assert.equal(api.options.value.filter(option => api.filter('不存在', option)).length, 0);
  assert.equal(api.options.value.find(o => o.label === '其他品牌').value, '0');
  assert.equal(api.filter('', undefined), true);
  let attempts = 0;
  const retry = create(async () => { if (++attempts === 1) throw Error('network'); return [{ value: 'new', text: '新增品牌' }]; });
  await assert.rejects(retry.load(), /network/);
  await retry.load(); assert.equal(retry.options.value[0].value, 'new');
  assert(source.includes('brand: queryParam.brand'), '物料查询仍提交字典值');
  assert(!source.includes('collectBrands('));
  assert(!source.includes('@search="onBrandSearch"'));
  assert(source.includes(':filter-option="filterBrandOption"'));
  console.log('PASS 品牌完整字典、空输入展开、中文/英文模糊搜索、字典值、失败重试和SFC编译');
})().catch(error => { console.error(error); process.exitCode = 1; });
