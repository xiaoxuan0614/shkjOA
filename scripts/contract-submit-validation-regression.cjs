const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const sfc = require('@vue/compiler-sfc');
const read = path => fs.readFileSync(path, 'utf8');
const events = ts.createSourceFile('events.ts', read('src/components/Form/src/hooks/useFormEvents.ts'), ts.ScriptTarget.Latest, true);
const functions = {};
function visit(node) {
  if (ts.isFunctionDeclaration(node)) functions[node.name?.text] = node.getText(events);
  ts.forEachChild(node, visit);
}
visit(events);
async function check(submitOnly) {
  const model = {}, calls = [];
  const set = new Function('unref', 'getSchema', 'getProps', 'formModel', 'handleInputNumberValue', 'handleInputStringValue', 'itemIsDateType', 'validateFields',
    ts.transpile(functions.setFieldsValue) + '\nreturn setFieldsValue;')(
    value => value, [{ field: 'name', component: 'Input' }], { validateOnSubmitOnly: submitOnly }, model,
    (_component, value) => value, (_component, value) => value, () => false, async keys => { calls.push(keys); });
  await set({ name: '' });
  assert.equal(model.name, '');
  assert.equal(calls.length, submitOnly ? 0 : 1);
}
(async () => {
  await check(true); await check(false); await check(undefined);
  const contract = read('src/views/project/contract/index.vue');
  assert(contract.includes('validateOnSubmitOnly: true'));
  assert(contract.includes('const values = await validate()'));
  const form = read('src/components/Form/src/BasicForm.vue');
  assert(form.includes('bindValue.validateTrigger = []'));
  assert(form.includes('bindValue.validateOnRuleChange = false'));
  const item = read('src/components/Form/src/components/FormItem.vue');
  assert(item.includes('!findItem && !props.formProps.validateOnSubmitOnly'));
  assert(item.includes('props.formProps.validateOnSubmitOnly ? { validateTrigger: [] }'));
  for (const [name, source] of [['contract', contract], ['form', form], ['item', item]]) {
    const { descriptor, errors } = sfc.parse(source); assert.deepEqual(errors, []);
    sfc.compileScript(descriptor, { id: name });
    if (descriptor.template) assert.deepEqual(sfc.compileTemplate({ source: descriptor.template.content, filename: name, id: name }).errors, []);
  }
  console.log('PASS submit-only validation: silent prefills, opt-in isolation, event/rule guards and explicit submit validation');
})().catch(error => { console.error(error); process.exitCode = 1; });
