const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const sfc = require('@vue/compiler-sfc');
const list = fs.readFileSync('src/views/project/index.vue', 'utf8');
const page = fs.readFileSync('src/views/project/plan/ProjectPlan.vue', 'utf8');
// 入口已迁移到详情，权限矩阵在共享解析器专项测试中覆盖。
require('./period-detail-actions-regression.cjs');
const userStore = { getUserInfo: { id: 'u' }, getIdentity: { roleCodes: ['admin'] } };
const editCtx = { projectRecord: {value:{}}, approvalSummary: {value:{}}, isHistoryView: {value:false}, props: { embeddedPeriodId: '' }, canEditPeriodPlan: p => p.status === 'PREPARING', userStore, route: { query: {} }, permissionLoaded: { value: true }, contextReady: { value: true },
  periodStatus: { value: 'NOT_STARTED' }, currentUserId: { value: 'u' }, isProjectManager: { value: false }, computed: f => f };
vm.createContext(editCtx);
vm.runInContext(page.slice(page.indexOf('  const editable ='), page.indexOf('  const isAuditView')) + '\nthis.canEdit = editable;', editCtx);
assert.equal(editCtx.canEdit(), false);
editCtx.periodStatus.value = 'PREPARING'; assert.equal(editCtx.canEdit(), true);
editCtx.periodStatus.value = 'NOT_STARTED'; editCtx.projectRecord.value.planStatus = '1'; assert.equal(editCtx.canEdit(), false);
editCtx.periodStatus.value = 'PREPARING'; assert.equal(editCtx.canEdit(), true);
editCtx.props.embeddedPeriodId = 'p'; assert.equal(editCtx.canEdit(), false, 'embedded plan is read-only even for admin');
editCtx.props.embeddedPeriodId = '';
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
