const fs = require('node:fs');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const ts = require('typescript');
const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc');
function load(file, requireMock = require) {
  const exports = {};
  new Function('exports', 'require', ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText)(exports, requireMock);
  return exports;
}
const { withPagination } = load('src/components/Pagination/config.ts');
let calls = 0;
const change = () => calls++;
const original = { current: 3, pageSize: 30, total: 91, showSizeChanger: false, hideOnSinglePage: true, onChange: change };
assert.deepEqual(withPagination(original), { ...original, size: 'small' });
assert.equal(original.size, undefined);
assert.equal(withPagination(false), false);
const { BasicPagination } = load('src/components/Pagination/index.ts', name => {
  if (name === 'vue') return { defineComponent: x => x, h: (component, props, slots) => ({ component, props, slots }) };
  if (name === 'ant-design-vue') return { Pagination: 'native' };
  return { withPagination };
});
const attrs = { ...original, 'onUpdate:current': change, class: 'test', disabled: true };
const slots = { itemRender: () => 'slot' };
const render = BasicPagination.setup({}, { attrs, slots });
let vnode = render();
assert.equal(vnode.slots, slots);
assert.equal(vnode.props.onChange, change);
vnode.props.onChange(4, 30);
assert.equal(calls, 1);
assert.equal(vnode.props['onUpdate:current'], change);
attrs.current = 4;
assert.equal(render().props.current, 4);
assert.equal(BasicPagination.inheritAttrs, false);
const files = cp.execFileSync('rg', ['-l', 'BasicPagination|withPagination|BasicPagination as Pagination', 'src', '-g', '*.vue'], { encoding: 'utf8' }).trim().split('\n');
for (const file of files) {
  const { descriptor, errors } = parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(errors, [], file);
  const script = compileScript(descriptor, { id: file });
  assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename: file, id: file, compilerOptions: { bindingMetadata: script.bindings } }).errors, [], file);
}
assert.match(fs.readFileSync('src/components/registerGlobComp.ts', 'utf8'), /compList = .*BasicPagination/);
console.log(`PASS pagination configuration, event forwarding, v-model, slots and ${files.length} Vue components`);
