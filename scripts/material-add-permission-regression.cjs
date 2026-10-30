const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const sfc = require('@vue/compiler-sfc');

async function main() {
  let allowed = false;
  const requests = [];
  const api = {};
  const dependencies = {
    '/@/utils/http/axios': { defHttp: { post: async (request) => requests.push(request) } },
    '/@/hooks/web/usePermission': { usePermission: () => ({ hasPermission: (code) => allowed && code === 'mtl:goods:add' }) },
    '/@/hooks/web/useMessage': { useMessage: () => ({ createConfirm() {} }) },
  };
  const code = ts.transpileModule(fs.readFileSync('src/views/material/goods/Goods.api.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function('exports', 'require', code)(api, (name) => dependencies[name]);
  await assert.rejects(api.saveOrUpdate({ materialName: '测试' }, false), /无新增物料权限/);
  assert.equal(requests.length, 0, '未授权不得发送新增请求');
  allowed = true;
  await api.saveOrUpdate({ materialName: '测试', guidePrice: 9 }, false);
  assert.equal(requests[0].url, '/stock/material/add');
  assert.deepEqual(requests[0].params, { materialName: '测试' });
  allowed = false;
  await api.saveOrUpdate({ id: 'existing' }, true);
  assert.equal(requests[1].url, '/stock/material/edit', '不改变既有编辑权限契约');
  for (const file of [
    'src/views/material/goods/index.vue',
    'src/views/material/goods/components/GoodsModal.vue',
    'src/views/material/apply/components/MaterialSelectDrawer.vue',
  ]) {
    const { descriptor, errors } = sfc.parse(fs.readFileSync(file, 'utf8'));
    assert.deepEqual(errors, []);
    sfc.compileScript(descriptor, { id: file });
    assert.deepEqual(sfc.compileTemplate({ source: descriptor.template.content, filename: file, id: file }).errors, []);
  }
  console.log('PASS 新增物料授权/拒绝/编辑隔离及三个公共入口SFC编译');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
