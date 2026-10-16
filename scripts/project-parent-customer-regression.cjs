const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const vm = require('node:vm');
const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc');
const filename = 'src/views/project/apply/ProjectApply.vue';
const source = fs.readFileSync(filename, 'utf8');
const { descriptor } = parse(source);
compileScript(descriptor, { id: 'parent-customer' });
assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename, id: 'parent-customer' }).errors, []);
const body = source.match(/async function loadMainProjects\(\) \{[^]*?\n  \}/)[0];
const customer = { id: 'c1', customerName: '甲方', contactPerson: '联系人', contactPhone: '123', customerInfo: '资料' };
const fields = {};
const errors = [];
const context = {
  Error, isPeriodCreate: { value: true }, selectedParentProjectId: { value: 'p1' },
  route: { query: { parentProjectName: '主项目', parentCustomerId: 'c1' } },
  selectedMainProjectName: { value: '' }, inheritedCustomer: { value: undefined }, mainProjectMap: {}, customerMap: {},
  editId: { value: undefined }, handleParentChange() {},
  getMainProjectList: async () => { throw new Error('新增分期不应补查主项目列表'); },
  getCustomerList: async (params) => { assert.equal(params.id, 'c1'); return { records: [customer] }; },
  updateSchema: async () => {}, setFieldsValue: async (values) => Object.assign(fields, values),
  createMessage: { error: (message) => errors.push(message) }, router: { replace: async () => {} },
};
vm.createContext(context);
vm.runInContext(ts.transpile(body, { target: ts.ScriptTarget.ES2020 }), context);
(async () => {
  await context.loadMainProjects();
  assert.equal(fields.customerId, 'c1');
  assert.equal(fields.contactPerson, customer.contactPerson);
  assert.equal(fields.contactPhone, customer.contactPhone);
  assert.equal(fields.customerInfo, customer.customerInfo);
  assert.equal(errors.length, 0);
  context.getCustomerList = async () => ({ records: [{ ...customer, id: 'wrong' }] });
  await context.loadMainProjects();
  assert.equal(context.inheritedCustomer.value, undefined);
  assert.equal(errors.length, 1);
  context.getCustomerList = async () => ({ records: [{ ...customer, contactPhone: '' }] });
  await context.loadMainProjects();
  assert.equal(context.inheritedCustomer.value.contactPhone, '');
  assert.equal(errors.length, 1, '联系人信息可在分期表单补填');
  assert.match(source, /identityFields.includes\(schema.field\)/);
  assert.match(source, /isPeriodCreate.value && parentLockedFields.includes\(schema.field\)/);
  assert.match(source, /const parentLockedFields = \['projectId', 'projectName', 'customerId', 'customerName'\]/);
  assert.match(source, /const identityFields = \['projectId', 'projectName', 'customerId', 'customerName', 'contactPerson', 'contactPhone', 'customerInfo'\]/);
  assert.doesNotMatch(source, /await setFieldsValue\(editIdentity.value\)/);
  assert.doesNotMatch(source, /lockedIdentity/);
  assert.match(source, /editProject\(\{ \.\.\.base, projectName, periodId: editId.value, periodName \}/);
  assert.doesNotMatch(fs.readFileSync('src/views/project/Project.data.ts','utf8'), /dynamicDisabled: \(\{ model \}\) => !!model.id/);
  assert.match(source, /if \(!isPeriodCreate.value\) await loadCustomers\(\)/);
  assert.doesNotMatch(source, /Object.assign\(values, inheritedCustomer.value/);
  const saveBody = source.match(/async function handleSave\(\) \{[^]*?const values = await validate\(\)/)[0];
  assert.doesNotMatch(saveBody, /setFieldsValue\(inheritedCustomer.value\)/);
  assert.match(saveBody, /customerId: inheritedCustomer.value.customerId/);
  console.log('PASS parent customer inheritance, mismatch/missing data blocking, readonly scope, draft/save protection and SFC');
})().catch((error) => { console.error(error); process.exitCode = 1; });
