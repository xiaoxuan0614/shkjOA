const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const sfc = require('@vue/compiler-sfc');
const policy = {};
new Function('exports', ts.transpileModule(fs.readFileSync('src/views/system/depart/singleCompany.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(policy);
const company = { id: 'company', parentId: '', orgCategory: '1', children: [{ id: 'dept', orgCategory: '2' }] };
assert.equal(policy.resolveCompanyRoot([company]), company);
for (const nodes of [[], null, [company, {...company,id:'other'}], [{...company,orgCategory:'2'}], [{...company,parentId:'other'}], [{...company,id:''}]]) {
  assert.throws(() => policy.resolveCompanyRoot(nodes));
}
assert.deepEqual(policy.departmentCreateValues({departName:'研发部',parentId:'dept',orgCategory:'3',id:'old',orgCode:'old',positionId:'post',tenantId:99}, 'company'), {departName:'研发部',parentId:'company',orgCategory:'2'});
assert.throws(() => policy.departmentCreateValues({}, ''));
const base = 'src/views/system/depart/';
const tree = fs.readFileSync(base+'components/DepartLeftTree.vue','utf8');
assert.doesNotMatch(tree, /onAddChildDepart|onDrop|updateChangeDepart|onImportXls|<a-upload|\sdraggable\s/);
assert.match(tree, /新增部门/);
const page = fs.readFileSync(base+'index.vue','utf8');
assert.doesNotMatch(page, /DepartRuleTab|DepartRankRelation/);
assert.match(page, /部门成员/);
assert.match(page, /DepartmentHeadList/);
const modal = fs.readFileSync(base+'components/DepartmentCreateModal.vue','utf8');
assert.match(modal, /await readCompanyRoot\(\)/);
assert.match(modal, /departmentCreateValues\(values, companyId\), false/);
assert.match(modal, /String\(latest.id\) !== companyId/);
const edit = fs.readFileSync(base+'components/DepartFormTab.vue','utf8');
for (const field of ['parentId','orgCategory','orgCode']) assert.ok(edit.includes(`values.${field} = props.data.${field}`));
for (const file of ['index.vue','components/DepartLeftTree.vue','components/DepartmentCreateModal.vue','components/DepartFormTab.vue']) {
  const path = base+file, {descriptor,errors} = sfc.parse(fs.readFileSync(path,'utf8'));
  assert.deepEqual(errors,[]);
  const script = sfc.compileScript(descriptor,{id:file});
  assert.deepEqual(sfc.compileTemplate({source:descriptor.template.content,filename:path,id:file,compilerOptions:{bindingMetadata:script.bindings}}).errors,[]);
}
console.log('PASS single company roots, create payload, hierarchy guards, retained membership and four SFCs');
