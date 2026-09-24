const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/views/project/projectListFilters.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: exportsObject });
const normalize = (params) => JSON.parse(JSON.stringify(exportsObject.normalizeProjectListParams(params)));
for (const keyword of ['', '   ', null, undefined]) {
  assert.equal(Object.hasOwn(normalize({ keyword, pageNo: 1 }), 'keyword'), false);
}
for (const file of ['src/views/project/Project.api.ts', 'src/views/plan/Plan.api.ts', 'src/views/implement/Implement.api.ts']) {
  assert.match(fs.readFileSync(file, 'utf8'), /params: (?:\{ \.\.\.)?normalizeProjectListParams\(/);
}
assert.deepEqual(normalize({ keyword: ' 项目 ', projectManagerName: ' 陈雄 ', status: ['NEW', 'IMPLEMENTING', 'NEW'], projectType: [1, 2], arrivalStatus: [0, 1], contractStatus: [-1, 0, 2], pageNo: 2 }), {
  keyword: '项目', projectManagerName: '陈雄', status: 'NEW,IMPLEMENTING', projectType: '1,2', arrivalStatus: '0,1', contractStatus: '-1,0,2', pageNo: 2,
});
assert.deepEqual(normalize({ status: [], projectType: [], arrivalStatus: [], contractStatus: [], keyword: ' ', projectManagerName: '' }), {});
assert.deepEqual(normalize({ arrivalStatus: 0, contractStatus: 0 }), { arrivalStatus: '0', contractStatus: '0' });
assert.equal(exportsObject.projectDisplayName({ projectName: '主项目', periodName: '一期' }), '主项目-一期');
assert.equal(exportsObject.projectDisplayName({ projectName: '主项目' }), '主项目');
assert.equal(exportsObject.projectDisplayName({}), '—');
assert.equal(exportsObject.projectDisplayName({ projectName: ' 主项目 ', periodName: ' 一期 ' }), '主项目-一期');
assert.equal(exportsObject.projectDisplayName({ projectName: null, periodName: '一期' }), '一期');
assert.deepEqual(normalize({ projectName: ' 主项目 ', pageNo: 1 }), { projectName: '主项目', pageNo: 1 });
for (const file of ['src/views/project/Project.data.ts', 'src/views/plan/Plan.data.ts', 'src/views/implement/Implement.data.ts']) {
  const source = fs.readFileSync(file, 'utf8');
  const search = source.split('export const searchFormSchema')[1].split('];')[0];
  assert.match(search, /field: 'keyword'/);
  assert.doesNotMatch(search, /field: '(projectName|periodName)'/);
  assert.match(source, /customRender: \(\{ record \}\) => projectDisplayName\(record\)/);
}
console.log('Project name, multi-select serialization, zero values, empty reset and manager search checks passed');
