const fs = require('node:fs'), assert = require('node:assert/strict'), ts = require('typescript'), sfc = require('@vue/compiler-sfc');
const vue = require('vue');
const file = 'src/views/project/detail/components/DetailPlanHistory.vue';
const source = fs.readFileSync(file, 'utf8');
const { descriptor } = sfc.parse(source);
let calls = 0, fail = false, destination;
const mocks = {
  vue: { ...vue, watch() {}, onBeforeUnmount() {} },
  'vue-router': { useRouter: () => ({ push: target => { destination = target; } }) },
  '/@/store/modules/user': { useUserStore: () => ({ getToken: 'session' }) },
  '/@/utils/approvalStatus': { getApprovalStatusMeta() {} },
  '../../plan/PeriodApproval.api': {
    getPeriodApprovalState: async () => { calls++; if (fail) throw Error('offline'); return { approvalStatus: '2' }; },
    getPeriodApprovalHistory: async () => { calls++; return [{ id: 'old', roundNo: 1 }, { id: 'new', roundNo: 2 }]; },
  },
  '../../plan/periodApproval': { parseApprovalSnapshot: value => value ? JSON.parse(value) : null },
};
const body = ts.transpileModule(descriptor.scriptSetup.content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const state = new Function('require', 'exports', 'defineProps', body + '\nreturn {load, rows, state, error, viewDetail};')(
  name => { assert(name in mocks, name); return mocks[name]; }, {}, () => ({ periodId: 'p' }),
);
(async () => {
  await state.load(); assert.equal(calls, 2); assert.equal(state.rows.value[0].id, 'new');
  state.viewDetail({ id: 'old' });
  assert.equal(destination.path, '/project/plan'); assert.equal(destination.query.approvalId, 'old'); assert.equal(destination.query.history, '1'); assert.equal(calls, 2);
  fail = true; await state.load(); assert.equal(state.rows.value.length, 0); assert.equal(state.error.value, 'offline');
  for (const filename of [file, 'src/views/project/detail/index.vue', 'src/views/project/plan/ProjectPlan.vue', 'src/views/project/plan/PlanSubmissionDetail.vue']) {
    const { descriptor: d } = sfc.parse(fs.readFileSync(filename, 'utf8'));
    const compiled = sfc.compileScript(d, { id: filename });
    assert.deepEqual(sfc.compileTemplate({ source: d.template.content, filename, id: filename, compilerOptions: { bindingMetadata: compiled.bindings } }).errors, []);
  }
  const parent = fs.readFileSync('src/views/project/detail/index.vue', 'utf8');
  assert(parent.includes('tab="计划审批记录"')); assert(!parent.includes('<ProjectPlan'));
  assert(!source.includes('/workflow/')); assert(!source.includes('submitPeriodApproval'));
  const detail = sfc.parse(fs.readFileSync('src/views/project/plan/PlanSubmissionDetail.vue', 'utf8')).descriptor.scriptSetup.content;
  const props = { periodId: 'p', approvalId: 'old' };
  let history = [{id:'old', periodId:'p', submittedSnapshot:'{"period":[],"plans":[],"processes":[]}'}];
  const detailMocks = {...mocks, dayjs: require('dayjs'), '/@/components/DictValue.vue': {}, '/@/hooks/web/useTabs': {useTabs:()=>({setTitle(){}})}, '/@/utils/filePreview': {}, './PeriodApproval.api': { getPeriodApprovalHistory: async () => history }, './periodApproval': mocks['../../plan/periodApproval']};
  const detailBody = ts.transpileModule(detail, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  let leaderIds;
  detailMocks['./PeriodApproval.api'].getSnapshotLeaderNames = async ids => { leaderIds = ids; return {u1:'测试负责人'}; };
  const page = new Function('require','exports','defineProps',detailBody+'\nreturn {load, record, snapshot, error, displayProcesses};')(name => {assert(name in detailMocks,name);return detailMocks[name];},{},()=>props);
  await page.load(); assert.equal(page.record.value.id,'old'); assert.deepEqual(page.snapshot.value.plans,[]);
  props.approvalId='missing'; await page.load(); assert.equal(page.record.value,undefined); assert.match(page.error.value,/未找到/);
  props.approvalId='old'; history=[{id:'old',periodId:'other'}]; await page.load(); assert.equal(page.record.value,undefined);
  history=[{id:'old',periodId:'p',submittedSnapshot:'{"period":[null],"plans":[],"processes":[]}'}]; await page.load(); assert.equal(page.snapshot.value,null);
  history=[{id:'old',periodId:'p',submittedSnapshot:JSON.stringify({period:[],plans:[],processes:[{site_leader_id:'u1'},{siteLeaderId:'u1',siteLeaderName:'历史姓名'},{site_leader_id:'u2'}]})}];
  await page.load(); assert.deepEqual(leaderIds,['u1','u2']); assert.equal(page.displayProcesses.value[0].siteLeaderName,'测试负责人'); assert.equal(page.displayProcesses.value[1].siteLeaderName,'历史姓名'); assert.match(page.displayProcesses.value[2].siteLeaderName,/u2/);
  assert(!detail.includes('/workflow/')); assert(!detail.includes('getPeriodApprovalState'));
  console.log('PASS history navigation, exact submission matching, missing/malformed snapshots, errors and SFC');
})().catch(error => { console.error(error); process.exitCode = 1; });
