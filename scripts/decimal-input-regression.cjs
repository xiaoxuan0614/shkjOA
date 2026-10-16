const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sfc = require('@vue/compiler-sfc');

// Business number inputs must declare their precision; coordinates and staff counts
// retain their domain-specific behavior. Do not round persisted values on load.
const roots = ['material', 'payment', 'plan', 'project', 'resource', 'workflow'];
let checked = 0;
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { scan(file); continue; }
    if (!file.endsWith('.vue')) continue;
    const source = fs.readFileSync(file, 'utf8');
    const { descriptor, errors } = sfc.parse(source);
    assert.equal(errors.length, 0, file);
    const tags = descriptor.template?.content.match(/<a-input-number\b[\s\S]*?\/>/g) || [];
    for (const tag of tags) {
      if (/record\.(longitude|latitude)/.test(tag)) continue;
      assert(/:precision="(0|2|quantityAndCostPrecision)"/.test(tag), `${file}: missing two-decimal or integer precision`);
      assert(!tag.includes(':min="0.0001"'), `${file}: minimum must fit two decimals`);
      checked++;
    }
    if (tags.length) {
      const script = sfc.compileScript(descriptor, { id: file });
      const result = sfc.compileTemplate({ source: descriptor.template.content, filename: file, id: file, compilerOptions: { bindingMetadata: script.bindings } });
      assert.deepEqual(result.errors, [], file);
    }
  }
}
roots.forEach(root => scan(`src/views/${root}`));
for (const file of ['payment/PaybackModal.vue', 'payment/ContractModal.vue', 'plan/components/MaterialApplyModal.vue', 'material/goods/Goods.data.ts', 'resource/vehicle/Vehicle.data.ts']) {
  assert(fs.readFileSync(`src/views/${file}`, 'utf8').includes('precision: 2'), file);
}
assert(fs.readFileSync('src/views/resource/counterpartyForm.ts', 'utf8').includes("precision: 2, placeholder: '例如：13 表示 13%'"));
console.log(`PASS ${checked} business numeric inputs: decimal/integer precision and Vue compilation`);
