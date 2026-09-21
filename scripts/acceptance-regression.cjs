const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc');
const root = path.resolve(__dirname, '..');
const mobile = path.resolve(root, '../SHKKJ-uniapp');
function load(file, dependencies = {}) {
  const source = fs.readFileSync(file, 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  const exports = {};
  vm.runInNewContext(output.outputText, { exports, require: (id) => {
    if (!(id in dependencies)) throw new Error(`Unmocked dependency ${id}`);
    return dependencies[id];
  } }, { filename: file });
  return exports;
}
async function main() {
  for (const base of [root, mobile]) {
    const rules = load(path.join(base, 'src/utils/acceptanceWorkflow.ts'));
    assert.equal(rules.isAcceptanceHistory({ acceptStatus: 'IN_PROGRESS' }), false);
    assert.equal(rules.isAcceptanceHistory({ acceptStatus: 'NOT_STARTED' }), false);
    assert.equal(rules.isAcceptanceHistory({ acceptStatus: 'IN_PROGRESS', result: 'PASSED' }), false);
    assert.equal(rules.isAcceptanceHistory({ acceptStatus: 'COMPLETED', result: 'FAILED' }), true);
    assert.equal(rules.isAcceptanceHistory({ acceptStatus: 'COMPLETED', result: 'PASSED' }), true);
    assert.equal(rules.isAcceptanceHistory({ acceptStatus: 'CANCELLED' }), true);
    assert.equal(rules.isAcceptanceHistory({ result: '通过' }), true);
    assert.equal(rules.isAcceptanceHistory({}), false);
    const failed = { id: 'f', acceptStatus: 'COMPLETED', result: 'FAILED' };
    const passed = { id: 'p', acceptStatus: 'COMPLETED', result: 'PASSED' };
    assert.equal(rules.isCurrentFailedAcceptance(failed, [failed, passed]), true);
    assert.equal(rules.isCurrentFailedAcceptance(failed, [passed, failed]), true);
    assert.equal(rules.isCurrentFailedAcceptance(passed, [failed, passed]), false);
    assert.equal(rules.isCurrentFailedAcceptance({ ...failed, id: 'history' }, [failed, passed]), false);
    assert.equal(rules.hasActiveRecheck([failed, { id: 'new', sourceAcceptanceId: 'p', acceptStatus: 'IN_PROGRESS' }]), true);
    assert.equal(rules.hasActiveRecheck([failed, { id: 'new', acceptStatus: 'IN_PROGRESS' }]), false);
    for (const status of ['-1', '2', '1']) assert.equal(rules.hasBlockingRework([{ id: 'r', previousReworkId: '', approvalStatus: status }], ''), true);
    for (const status of ['0', '3']) assert.equal(rules.hasBlockingRework([{ id: 'r', previousReworkId: '', approvalStatus: status }], ''), false);
    assert.equal(rules.hasBlockingRework([{ id: 'r', previousReworkId: '', approvalStatus: '1' }], 'r'), false);
    assert.equal(rules.hasBlockingRework([{ id: 'r', previousReworkId: '', approvalStatus: '-1' }], '', 'r'), false);
    for (let count = 0; count <= 4; count++) assert.equal(rules.acceptanceAttachmentCount({ completionReportFileId: Array.from({ length: count }, (_, i) => `f${i}`).join(',') }), count);
    assert.equal(rules.acceptanceAttachmentCount({ completionReportFileId: 'a,b,c', acceptanceFormFileId: 'd' }), 4);
    let state;
    const reset = () => { state = { project: { status: 'ACCEPTING', currentReworkId: '' }, manager: true,
      INTERNAL: [{ ...failed, id: 'i', acceptType: 'INTERNAL', periodId: 'period' }],
      CUSTOMER: [{ ...passed, id: 'c', acceptType: 'CUSTOMER', periodId: 'period' }], reworks: [] }; };
    reset();
    const membership = { readProjectMembership: async () => ({ manager: state.manager }) };
    const paged = (rows) => ({ records: rows, total: rows.length });
    const workflow = base === root ? load(path.join(root, 'src/views/project/detail/acceptanceWorkflow.ts'), {
      './ProjectDetail.api': { getAcceptance: async (p) => paged(state[p.acceptType]), getProjectReworks: async () => paged(state.reworks) },
      '../Project.api': { projectDetail: async () => state.project }, '../projectMembership': membership,
      '/@/utils/acceptanceWorkflow': rules,
    }) : load(path.join(mobile, 'src/service/projectAcceptance.ts'), {
      '@/utils/http': { http: { get: async (url, p) => ({ result: paged(state[p.acceptType]) }) } },
      '@/service/shkj': { projectApi: { detail: async () => ({ result: state.project }) }, unwrapRecords: (r) => r.result.records },
      './projectMembership': membership, './projectRework': { reworkApi: { list: async () => ({ result: paged(state.reworks) }) } },
      '@/utils/acceptanceWorkflow': rules,
    });
    const apply = (source, mode = 'recheck', exclude = '') => workflow.assertAcceptanceApplication('period', 'manager', source, mode, exclude);
    await apply('i'); await apply('i', 'rework'); // 内失败 + 外通过
    state.INTERNAL[0].result = 'PASSED'; state.CUSTOMER[0].result = 'FAILED';
    await apply('c'); await apply('c', 'rework'); // 内通过 + 外失败
    await assert.rejects(apply('i')); // 已通过不得复验
    state.manager = false; await assert.rejects(apply('c')); state.manager = true;
    state.project.status = 'WARRANTY'; await assert.rejects(apply('c')); state.project.status = 'ACCEPTING';
    for (const status of ['-1', '2', '1']) {
      state.reworks = [{ id: 'r', approvalStatus: status, previousReworkId: '', sourceAcceptanceId: 'c' }];
      await assert.rejects(apply('c')); await assert.rejects(apply('c', 'rework'));
    }
    state.reworks[0].approvalStatus = '-1'; await apply('c', 'rework', 'r'); // 自己的草稿允许编辑
    for (const status of ['0', '3']) { state.reworks[0].approvalStatus = status; await apply('c'); await assert.rejects(apply('c', 'rework')); }
    state.reworks = [];
    state.CUSTOMER.push({ id: 'c2', periodId: 'period', acceptType: 'CUSTOMER', sourceAcceptanceId: 'c', acceptStatus: 'IN_PROGRESS' });
    await assert.rejects(apply('c')); // 来源已被取代
    state.INTERNAL[0].result = 'FAILED';
    await assert.rejects(apply('i', 'rework')); await apply('i'); // 另一类复验只阻止施工返工
    reset(); state.project.currentReworkId = 'new-round';
    await apply('i'); // 两端均允许尚未被替代的跨轮失败记录。
    console.log(`${base === root ? 'PC' : '移动端'}：验收规则及真实申请门禁函数回归通过`);
  }
  const files = [
    [root, 'src/views/project/detail/components/DetailAcceptance.vue'],
    [root, 'src/views/project/detail/components/ReworkDrawer.vue'],
    [root, 'src/views/project/components/AcceptanceModal.vue'],
    [mobile, 'src/pages/ops/components/ProjectAcceptancePopup.vue'],
    [mobile, 'src/pages/ops/components/ProjectReworkPanel.vue'],
  ];
  let permissions = new Set(['project:accept']);
  const account = { getUserInfo: { username: '陈雄' }, getRoleList: ['engineering_implement'] };
  const access = load(path.join(root, 'src/views/project/useAcceptanceAccess.ts'), {
    '/@/hooks/web/usePermission': { usePermission: () => ({ hasPermission: (code) => permissions.has(code) }) },
    '/@/store/modules/user': { useUserStore: () => account },
  }).useAcceptanceAccess();
  assert.equal(access.canOperateAcceptance('CUSTOMER', true), true, '详情没有经理ID时，有效经理仍可外验');
  assert.equal(access.canOperateAcceptance('CUSTOMER', false), false, '普通成员不能外验');
  assert.equal(access.canOperateAcceptance('INTERNAL', true), false, '项目经理不能因为经理身份获得内验');
  permissions = new Set(['project:internalAccept']);
  assert.equal(access.canOperateAcceptance('INTERNAL', true), false, '工程成员误授按钮权限仍不能办理');
  assert.equal(access.canOperateAcceptance('INTERNAL', false, true), true, '运维普通成员有按钮权限即可办理');
  account.getRoleList = ['operations_manager'];
  assert.equal(access.canOperateAcceptance('INTERNAL', false), false, '主管角色不能替代真实所属部门');
  permissions.clear();
  assert.equal(access.canOperateAcceptance('INTERNAL', false), false, '主管也必须有内验权限');
  permissions.add('project:internalAccept');
  assert.equal(access.canOperateAcceptance('CUSTOMER', true), false, '缺少外验权限仍禁止');
  account.getUserInfo.username = 'admin';
  assert.equal(access.canOperateAcceptance('INTERNAL', false), false, '管理员不豁免真实所属部门校验');
  assert.equal(access.canOperateAcceptance('CUSTOMER', false), false, '管理员不能绕过项目经理身份');
  account.getRoleList = [];
  assert.equal(access.canOperateAcceptance('INTERNAL', false), false, '部门资格未知时禁止');
  permissions.clear();
  assert.equal(access.canOperateAcceptance('INTERNAL', false), false, '管理员不能绕过按钮权限');
  permissions.add('project:acceptance:submit');
  assert.equal(access.canStartAcceptance(false), false);
  assert.equal(access.canStartAcceptance(true), true);
  const mobileSource = parse(fs.readFileSync(path.join(mobile, 'src/pages/ops/components/ProjectAcceptancePopup.vue'), 'utf8')).descriptor.scriptSetup.content;
  const mobileAst = ts.createSourceFile('popup.ts', mobileSource, ts.ScriptTarget.Latest, true);
  const operateStatement = mobileAst.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(d => d.name.getText(mobileAst) === 'canOperate'));
  assert.ok(operateStatement);
  const mobileContext = { identityReady:{value:true}, operationsMember:{value:false}, user: { userInfo: { roles: [{ value: 'engineering_implement' }] } }, admin: { value: false }, manager: { value: true }, permission: { hasPermission: code => permissions.has(code) }, exports: {} };
  vm.runInNewContext(ts.transpileModule(operateStatement.getText(mobileAst) + '\nexports.canOperate = canOperate;', { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, mobileContext);
  permissions = new Set(['project:accept']);
  assert.equal(mobileContext.exports.canOperate('CUSTOMER'), true);
  assert.equal(mobileContext.exports.canOperate('INTERNAL'), false);
  mobileContext.manager.value = false;
  assert.equal(mobileContext.exports.canOperate('CUSTOMER'), false, '不是本项目经理不能编辑外验');
  permissions = new Set(['project:internalAccept']);
  assert.equal(mobileContext.exports.canOperate('INTERNAL'), false, '按钮权限不能替代运维部身份');
  mobileContext.user.userInfo.roles = [{ value: 'operations_manager' }];
  assert.equal(mobileContext.exports.canOperate('INTERNAL'), false, '主管角色不能替代所属部门');
  mobileContext.operationsMember.value = true;
  assert.equal(mobileContext.exports.canOperate('INTERNAL'), true);
  mobileContext.identityReady.value = false;
  assert.equal(mobileContext.exports.canOperate('INTERNAL'), true, '内验角色来自登录态，不等待项目经理查询');
  mobileContext.identityReady.value = true;
  permissions.clear();
  assert.equal(mobileContext.exports.canOperate('INTERNAL'), false, '移动端主管也必须有内验权限');
  permissions.add('project:internalAccept');
  assert.equal(mobileContext.exports.canOperate('CUSTOMER'), false);
  console.log('两端办理权限：经理身份不依赖缺失ID、内外权限分离；空历史/当前草稿过滤通过');
  for (const [base, file] of files) {
    const { descriptor, errors } = parse(fs.readFileSync(path.join(base, file), 'utf8'));
    assert.equal(errors.length, 0, file);
    compileScript(descriptor, { id: file });
    const result = compileTemplate({ source: descriptor.template.content, filename: file, id: file });
    assert.equal(result.errors.length, 0, `${file}: ${result.errors.join(',')}`);
  }
  console.log('验收/返工 Vue 脚本与模板编译通过（不代表真实账号联调）');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
