const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vueTypes = require('vue-types');

// Load the project's actual propTypes wrapper and tableSetting declaration.
const moduleBox = { exports: {} };
const js = ts.transpileModule(fs.readFileSync('src/utils/propTypes.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
new Function('require', 'exports', js)(require, moduleBox.exports);
const source = ts.createSourceFile('props.ts', fs.readFileSync('src/components/Table/src/props.ts', 'utf8'), ts.ScriptTarget.Latest, true);
let initializer;
function visit(node) {
  if (ts.isPropertyAssignment(node) && node.name.getText(source) === 'tableSetting') initializer = node.initializer.getText(source);
  ts.forEachChild(node, visit);
}
visit(source);
assert(initializer);
const declaration = ts.transpile(`const setting = ${initializer};`).trim();
const setting = new Function('propTypes', declaration + '\nreturn setting;')(moduleBox.exports.propTypes);
const warnings = [];
const warn = console.warn;
console.warn = message => warnings.push(message);
try {
  for (const value of [{}, { redo: false }, { setting: true }, { redo: false, size: false, setting: true, fullScreen: false, cacheKey: 'quotation:cost' }]) {
    assert.equal(vueTypes.validateType(setting, value, true), true);
  }
  assert.equal(warnings.length, 0, 'valid settings must not emit warnings');
  for (const value of [{ redo: 'false' }, { size: 1 }, { setting: 'true' }, { fullScreen: [] }, { cacheKey: 123 }, { unknown: true }]) {
    assert.notEqual(vueTypes.validateType(setting, value, true), true);
  }
} finally { console.warn = warn; }
console.log('PASS tableSetting runtime validation: optional valid keys accepted, wrong types and unknown keys rejected');
