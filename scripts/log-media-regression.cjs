const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const ts = require('typescript');
const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc');
for (const root of [process.cwd(), '/Users/xuan/AI/ClaudeAllData/SHKKJ-uniapp']) {
  const source = fs.readFileSync(root + '/src/utils/logMedia.ts', 'utf8');
  const context = { exports: {} };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
  const { logMediaUrl, isLogVideo } = context.exports;
  for (const base of ['/api', 'https://example.test/shouhuiApi']) {
    const resolve = (path) => base + '/sys/common/static/' + path;
    for (const prefix of ['', '/', 'static/', '/static/', 'sys/common/static/', '/sys/common/static/', '/shouhuiApi/sys/common/static/']) {
      assert.equal(logMediaUrl(prefix + 'project/a.mp4?x=1', resolve), resolve('project/a.mp4?x=1'));
    }
    for (const direct of ['https://cdn.test/a.mp4?sig=1', '//cdn.test/a.jpg', 'blob:local-id', 'wxfile:temp.jpg', 'data:image/png;base64,abc']) {
      assert.equal(logMediaUrl(direct, resolve), direct);
    }
    assert.equal(logMediaUrl('', resolve), '');
    assert.equal(logMediaUrl('  static/project/a.jpg  ', resolve), resolve('project/a.jpg'));
  }
  assert.equal(isLogVideo('project/a.MP4?signature=1'), true);
  assert.equal(isLogVideo('project/a.jpg'), false);
  const file = root === process.cwd()
    ? '/src/views/implement/components/ImplementLogDetailContent.vue'
    : '/src/pages/ops/implementLog.vue';
  const { descriptor, errors } = parse(fs.readFileSync(root + file, 'utf8'));
  assert.equal(errors.length, 0);
  compileScript(descriptor, { id: 'log-media' });
  assert.equal(compileTemplate({ source: descriptor.template.content, filename: file, id: 'log-media' }).errors.length, 0);
}
console.log('PC/移动端日志媒体：静态路径、完整链接、临时预览、视频分类及 SFC 编译通过');
