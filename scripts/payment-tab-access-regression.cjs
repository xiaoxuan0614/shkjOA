const fs = require('node:fs'), assert = require('node:assert/strict'), ts = require('typescript');
const output = {};
new Function('exports', ts.transpileModule(fs.readFileSync('src/views/project/detail/paymentAccess.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText)(output);
const allowed = output.canViewPaymentTab, menus = [{ path: '/payment', children: [{ path: '/payment/list' }] }];
assert(allowed('u', ['finance_staff'], menus));
assert(allowed('u', ['admin'], menus));
assert(allowed('u', ['finance_staff'], [{ path: '/payment', children: [{ path: 'list' }] }]));
assert(!allowed('u', [], menus));
assert(!allowed('u', ['project_management'], menus));
assert(!allowed('u', ['admin'], []));
assert(!allowed('', ['admin'], menus));
assert(!allowed('u', ['admin'], [{ path: '/payment/detail/:id' }]));
const source = fs.readFileSync('src/views/project/detail/index.vue', 'utf8');
assert(source.includes("(key !== 'payment' || canViewPayment.value)"));
assert(source.includes('v-if="canViewPayment && activeKey === \'payment\'"'));
assert(!source.includes('canRequestFinance'));
console.log('PASS payment tab menu/role/session guards and component mount gate');
