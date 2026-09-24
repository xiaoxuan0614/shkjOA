const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const sfc = require('@vue/compiler-sfc');
const list = fs.readFileSync('src/views/project/index.vue', 'utf8');
const page = fs.readFileSync('src/views/project/plan/ProjectPlan.vue', 'utf8');
const ast = ts.createSourceFile('list.ts', sfc.parse(list).descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true);
const node = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'canEditPlan');
const userStore = { getUserInfo: { id: 'u' }, getIdentity: { roleCodes: [] } };
const ctx = { userStore };
vm.createContext(ctx);
vm.runInContext(ts.transpileModule(node.getText(ast), {}).outputText, ctx);
const row = { status: 'PREPARING', _isArrivalManager: false, _managerUserId: 'u' };
assert.equal(Boolean(ctx.canEditPlan(row)), false);
row._isArrivalManager = true; assert.equal(ctx.canEditPlan(row), true);
row._managerUserId = 'other'; assert.equal(ctx.canEditPlan(row), false);
userStore.getIdentity.roleCodes = ['admin']; assert.equal(ctx.canEditPlan(row), true);
row.status = 'PENDING_APPROVAL'; assert.equal(ctx.canEditPlan(row), false);
const editCtx = { canEditPeriodPlan: p => ['NOT_STARTED', 'PREPARING'].includes(p.status), userStore, route: { query: {} }, permissionLoaded: { value: true }, contextReady: { value: true },
  periodStatus: { value: 'PREPARING' }, currentUserId: { value: 'u' }, isProjectManager: { value: false }, computed: f => f };
vm.createContext(editCtx);
vm.runInContext(page.slice(page.indexOf('  const editable ='), page.indexOf('  const isAuditView')) + '\nthis.canEdit = editable;', editCtx);
assert.equal(editCtx.canEdit(), true);
userStore.getIdentity.roleCodes = []; assert.equal(editCtx.canEdit(), false);
editCtx.isProjectManager.value = true; assert.equal(editCtx.canEdit(), true);
editCtx.route.query.mode = 'view'; assert.equal(editCtx.canEdit(), false);
delete editCtx.route.query.mode; editCtx.contextReady.value = false; assert.equal(editCtx.canEdit(), false);
for (const [name, source] of [['list', list], ['plan', page]]) {
  const { descriptor } = sfc.parse(source);
  sfc.compileScript(descriptor, { id: name });
  assert.deepEqual(sfc.compileTemplate({ source: descriptor.template.content, filename: name, id: name }).errors, []);
}
console.log('计划编辑权限：经理、管理员、其他账号、只读、加载失败及SFC检查通过');
