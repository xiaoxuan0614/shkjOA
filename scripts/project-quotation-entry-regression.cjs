const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
function load(path, imports = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, require: name => imports[name] || require(name) });
  return exports;
}
const { canViewProjectQuotation: canView } = load('src/views/project/detail/quotationDepartment.ts');
const departments = [{ id: 'sales', departName: '市场部' }, { id: 'tech', departName: '技术部' }, { id: 'ops', departName: '运维部' }];
assert.equal(canView(['sales'], departments), true);
assert.equal(canView(['tech'], departments), true);
assert.equal(canView(['ops'], departments), false);
assert.equal(canView([], departments), false);
assert.equal(canView(['sales'], [{ id: 'sales', departName: '市场部', delFlag: 1 }]), false);
const { needsQuotationDetailRoute: needs } = load('src/router/helper/quotationDetailRoute.ts');
const projectRoutes = [{ path: '/project', children: [{ path: 'detail/:id' }] }];
assert.equal(needs(projectRoutes), true);
assert.equal(needs([]), false);
assert.equal(needs([{ path: '/plan', children: [{ path: 'material-draft' }, { path: 'material-draft/editor' }] }]), false);
const { quotationDetailFallback } = load('src/router/routes/staticRouter.ts', { '/@/router/constant': { LAYOUT: {} } });
const { createRouter, createMemoryHistory } = require('vue-router');
const router = createRouter({ history: createMemoryHistory(), routes: [quotationDetailFallback] });
assert.equal(router.resolve('/plan/material-draft/editor?mode=view&periodId=p&candidateId=q').name, 'ContractMaterialDraftEditor');
const page = fs.readFileSync('src/views/project/detail/index.vue', 'utf8');
assert.match(page, /v-if="canViewQuotation" key="quotation"/);
assert.match(page, /key !== 'quotation' \|\| canViewQuotation.value/);
const entry = fs.readFileSync('src/views/project/detail/components/DetailQuotation.vue', 'utf8');
for (const field of ['candidateName', 'status', 'version', 'adopted', 'priced', 'createBy']) assert.ok(entry.includes(`${field}: record.${field}`));
const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc');
for (const filename of ['src/views/project/detail/index.vue', 'src/views/project/detail/components/DetailQuotation.vue', 'src/views/plan/material-draft/editor.vue']) {
  const { descriptor, errors } = parse(fs.readFileSync(filename, 'utf8'), { filename });
  assert.equal(errors.length, 0);
  compileScript(descriptor, { id: filename });
  assert.equal(compileTemplate({ source: descriptor.template.content, filename, id: filename }).errors.length, 0);
}
console.log('报价入口：部门允许/拒绝、隐藏页路由解析/去重、查询参数、页签门禁及SFC检查通过');
