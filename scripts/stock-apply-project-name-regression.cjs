const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const file = 'src/views/material/record/data.ts';
const source = fs.readFileSync(file, 'utf8');
const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
let initializer;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'applyColumns') initializer = node.initializer.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(initializer);
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(`exports.columns = ${initializer};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText, context);
const column = context.exports.columns.find(item => item.dataIndex === 'projectName');
const cases = [
  [{ projectName: '主项目', periodName: '一期' }, '主项目 - 一期'],
  [{ projectName: ' 主项目 ', periodName: ' 一期 ' }, '主项目 - 一期'],
  [{ projectName: '主项目', periodName: null }, '主项目'],
  [{ projectName: null, periodName: '历史分期' }, '历史分期'],
  [{ projectName: ' ', periodName: '' }, '—'],
  [{}, '—'],
  [{ projectName: '同名', periodName: '同名' }, '同名 - 同名'],
];
for (const [record, expected] of cases) {
  const before = JSON.stringify(record);
  assert.equal(column.customRender({ record }), expected);
  assert.equal(JSON.stringify(record), before);
}
console.log('出入库申请项目名称拼接、缺失/空白回退及原始字段不变：7项通过');
