const fs = require('node:fs'), assert = require('node:assert/strict'), sfc = require('@vue/compiler-sfc');
const editor = fs.readFileSync('src/views/plan/material-draft/editor.vue', 'utf8');
const table = fs.readFileSync('src/views/plan/components/MaterialPlanTable.vue', 'utf8');
assert(editor.includes(':color="statusMeta[String(record.status)]?.color"'));
assert(editor.includes(':color="Number(record.adopted) === 1'));
assert(editor.includes(':color="Number(record.priced) === 1'));
const block = table.slice(table.indexOf('<template v-else-if="[\'basePrice\', \'markupRate\', \'finalPrice\']'), table.indexOf('<template v-else-if="column.key === \'plannedQty\'"'));
assert(block.includes('<a-input-number'));
assert(!block.includes('v-if="column.key === \'basePrice\' || pricingEditable'));
assert(!block.includes('<span v-else>'));
assert(block.includes(':disabled="busy || (column.key === \'basePrice\' ? !basePriceEditable : !pricingEditable)"'));
assert(block.includes(':precision="quantityAndCostPrecision"'));
assert(table.includes("includes(column.key) && !priceVisible"), 'masked prices remain hidden');
for (const file of ['src/views/plan/material-draft/editor.vue', 'src/views/plan/components/MaterialPlanTable.vue']) {
  const { descriptor } = sfc.parse(fs.readFileSync(file, 'utf8'));
  const script = sfc.compileScript(descriptor, { id: file });
  assert.deepEqual(sfc.compileTemplate({ source: descriptor.template.content, id: file, filename: file, compilerOptions: { bindingMetadata: script.bindings } }).errors, []);
}
console.log('PASS quotation display: colored statuses, consistent inputs, locked/hidden guards and SFC');
