const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const ts = require('typescript'), sfc = require('@vue/compiler-sfc');
const mobile = '/Users/xuan/AI/ClaudeAllData/SHKKJ-uniapp/';
for (const root of ['', mobile]) {
  const context = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(root + 'src/utils/reworkProcessName.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
  const format = context.exports.reworkProcessName;
  assert.deepEqual(['安装', '调试'].map(name => format(name, 2)), ['第2轮返工-安装', '第2轮返工-调试']);
  for (const round of [null, undefined, 0, -1, 1.5, true, 'bad']) assert.equal(format('安装', round), '安装');
  assert.equal(format('安装', '3'), '第3轮返工-安装');
  assert.equal(format('第2轮返工-安装', 2), '第2轮返工-安装');
}
for (const file of ['src/views/project/detail/components/ReworkDrawer.vue', mobile + 'src/pages/ops/components/ProjectReworkPanel.vue']) {
  const { descriptor, errors } = sfc.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(errors, []);
  sfc.compileScript(descriptor, { id: file });
  assert.deepEqual(sfc.compileTemplate({ source: descriptor.template.content, filename: file, id: file }).errors, []);
}
console.log('返工多工序名称、空轮次、重复前缀与两端组件编译通过');
