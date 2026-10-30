const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const dayjs = require('dayjs');
const compiler = { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true };
function evaluate(source, requireMock = require) {
  const output = {};
  new Function('require', 'exports', ts.transpileModule(source, { compilerOptions: compiler }).outputText)(requireMock, output);
  return output;
}
const directory = 'src/views/operation/duty-roster/';
const rules = evaluate(fs.readFileSync(`${directory}dutyRoster.rules.ts`, 'utf8'));
const textRules = evaluate(fs.readFileSync(`${directory}dutyRoster.textRule.ts`, 'utf8'));
const users = ['A', 'B', 'C'].map((userId) => ({ userId, name: userId, phone: `00-${userId}` }));
const fourUsers = [...users, {userId:'D',name:'D',phone:'00-D'}];
const clone = (value) => JSON.parse(JSON.stringify(value));
function rows(month) {
  const date = dayjs(month);
  return Array.from({ length: date.daysInMonth() }, (_, i) => ({
    date: date.date(i + 1).format('YYYY-MM-DD'),
    weekday: '',
    dayUsers: [],
    nightUser: null,
    restUser: null,
  }));
}
function result(month, extra = {}) {
  return { id: null, month, version: 0, saved: false, canManage: true, rotationUsers: [], days: [], ...extra };
}
(async () => {
  const october = rules.rotateDutyRoster(rows('2026-10'), fourUsers);
  const sample = rules.rotateDutyRoster(rows('2026-10').slice(25), fourUsers);
  assert.deepEqual(sample.map(r => [r.dayUsers.map(u=>u.userId),r.nightUser.userId]), [
    [['A','B','C','D'],'A'], [['A','B','C','D'],'B'], [['A','B','C','D'],'C'],
    [['A','B','C','D'],'D'], [['A','B','C','D'],'A'], [['B'],'C']
  ]);
  const sampleNext = rules.rotateDutyRoster(rows('2026-11'),fourUsers,sample.at(-1).nightUser.userId);
  assert.deepEqual(sampleNext[0].dayUsers.map(u=>u.userId),['D']); assert.equal(sampleNext[0].nightUser.userId,'A');
  assert.equal(sampleNext[1].nightUser.userId,'B');
  assert.deepEqual(rules.getMorningRestUsers(sampleNext[1],sampleNext[0]),[fourUsers[0]]);
  assert.deepEqual(rules.getRestUsers(fourUsers,sampleNext[1]),[]);
  for (const month of ['2026-02','2028-02','2026-04','2026-10']) {
    const generated=rules.rotateDutyRoster(rows(month),fourUsers);
    generated.forEach(day=>assert.equal(day.dayUsers.length,[0,6].includes(dayjs(day.date).day())?1:4));
  }
  const november = rules.rotateDutyRoster(rows('2026-11'),fourUsers,october.at(-1).nightUser.userId);
  assert.equal(november[0].dayUsers.length,1);
  assert.throws(()=>rules.rotateDutyRoster(rows('2026-10'),users),/需要选择4名/);
  assert.deepEqual(rules.rotateDutyRoster(rows('2026-10'),[fourUsers[2],fourUsers[0],fourUsers[3],fourUsers[1]])[0].nightUser,fourUsers[2]);
  const adjusted = clone(october);
  adjusted[0].dayUsers = [users[0]];
  adjusted[0].nightUsers = [users[2]];
  adjusted[0].nightUser = users[2]; // 人工调整不强制夜班属于白班。
  adjusted[0].restUser = null; // 不由后端或数据层重新推导。
  const payload = rules.createDutyRosterPayload('2026-10', 2, users, adjusted);
  assert.deepEqual(payload.days[0].dayUsers, [users[0]]);
  assert.equal(payload.days[0].nightUser.phone, '00-C');
  assert.deepEqual(payload.days[0].restUsers.map(p => p.userId), ['B']);
  assert.ok(!('weekday' in payload.days[0]));
  adjusted[0].dayUsers = [];
  assert.equal(payload.days[0].dayUsers.length, 1, '提交快照不随后续页面修改改变');

  // 正式API只认success，按契约发送data，导出错误不能作为Excel下载。
  const calls = [];
  let apiResponse = { success: true, code: 200, result: { canManage: true, persons: users } };
  let exportBlob = new Blob(['xlsx'], { type: 'application/octet-stream' });
  const api = evaluate(fs.readFileSync(`${directory}dutyRoster.api.ts`, 'utf8'), (name) => name === './dutyRoster.rules' ? rules : ({
    defHttp: {
      get: async (config) => {
        calls.push(config);
        return config.responseType === 'blob' ? exportBlob : typeof apiResponse === 'function' ? apiResponse(config) : apiResponse;
      },
      post: async (config) => {
        calls.push(config);
        return apiResponse;
      },
    },
  }));
  apiResponse = (config) => ({ success: true, result: config.url.includes('queryTreeList')
    ? [{id:'company', children:[{id:'ops',departName:'运维部'}]}]
    : {records: (config.params.pageNo === 1 ? users.slice(0,2) : users.slice(1)).map(p=>({id:p.userId,realname:p.name,phone:p.phone})),total:4,size:2,pages:2} });
  assert.deepEqual((await api.loadDutyRosterUsers()).persons, users);
  assert.equal(calls.at(-1).url, '/sys/user/list');
  assert.deepEqual(calls.at(-1).params, {departId:'ops',pageNo:2,pageSize:100});
  apiResponse = {success:true,result:[]};
  await assert.rejects(api.loadDutyRosterUsers(), /未找到运维部/);
  apiResponse = {success:true,result:[{id:'a',title:'运维部'},{id:'b',title:'运维部'}]};
  await assert.rejects(api.loadDutyRosterUsers(), /多个运维部/);
  apiResponse = (config) => ({success:true,result:config.url.includes('queryTreeList') ? [{id:'ops',title:'运维部'}] : null});
  assert.deepEqual((await api.loadDutyRosterUsers()).persons, []);
  apiResponse = {success:false,message:'无权读取部门'};
  await assert.rejects(api.loadDutyRosterUsers(), /无权读取部门/);
  apiResponse = { success: false, code: 200, message: '版本过期，请刷新' };
  await assert.rejects(api.saveDutyRoster(payload), /版本过期/);
  assert.deepEqual(Object.keys(calls.at(-1).data).sort(), ['days', 'month', 'rotationUsers']);
  assert.deepEqual(calls.at(-1).data.rotationUsers[0], { userId: 'A' });
  assert.deepEqual(calls.at(-1).data.days[0], { date: '2026-10-01', dayUsers: [{userId: 'A'}], nightUsers: [{userId:'C'}], restUsers: [{userId:'B'}] });
  apiResponse = { success: true, result: result('2026-10') };
  await api.saveDutyRoster({...payload, days:[{...payload.days[0], nightUsers:[users[0],users[1]]}]});
  assert.deepEqual(calls.at(-1).data.days[0].nightUsers, [{userId:'A'},{userId:'B'}]);
  await api.saveDutyRoster({...payload, days:[{...payload.days[0], dayUsers:[users[0]], nightUsers:[users[0]]}]});
  assert.deepEqual(calls.at(-1).data.days[0].restUsers, [{userId:'B'},{userId:'C'}]);
  await api.saveDutyRoster({...payload, days:[{...payload.days[0], dayUsers:[], nightUsers:[]}]});
  assert.deepEqual(calls.at(-1).data.days[0], {date:'2026-10-01',dayUsers:[],nightUsers:[],restUsers:users.map(p=>({userId:p.userId}))});
  await api.queryDutyRoster('2026-10');
  assert.deepEqual(calls.at(-1).params, { month: '2026-10' });
  // 新版接口删除 rotationUsers，参与人员必须包含仅休息的人，且支持空班次/空元素。
  apiResponse = { success: true, result: {
    id: 'roster', month: '2026-10', saved: true, canManage: true,
    days: [{ date: '2026-10-01', dayUsers: [users[0], null], nightUsers: [users[0], users[1], null], restUsers: [users[2]] }],
  } };
  const currentRoster = await api.queryDutyRoster('2026-10');
  assert.deepEqual(currentRoster.rotationUsers, users);
  assert.deepEqual(currentRoster.days[0].nightUsers, users.slice(0, 2));
  assert.deepEqual(rules.getRestUsers(currentRoster.rotationUsers, currentRoster.days[0]), [users[2]]);
  assert.deepEqual((await api.saveDutyRoster(payload)).rotationUsers, users, '保存回显也适配新契约');
  apiResponse = { success: true, result: { id: null, month: '2026-11', saved: false, canManage: true, days: [] } };
  assert.deepEqual((await api.queryDutyRoster('2026-11')).rotationUsers, []);
  assert.ok((await api.downloadDutyRoster('2026-10')) instanceof Blob);
  exportBlob = new Blob([JSON.stringify({ success: false, message: '尚未保存' })], { type: 'application/json' });
  await assert.rejects(api.downloadDutyRoster('2026-10'), /尚未保存/);

  // 页面使用真实Vue响应式；网络隔离，验证保存锁定、失败保留与月份竞态。
  const pageSource = fs.readFileSync(`${directory}DutyRosterEditor.vue`, 'utf8');
  const setup = pageSource.match(/<script lang="ts" setup>([\s\S]*?)<\/script>/)[1].replace("  defineOptions({ name: 'OperationDutyRoster' });", '').replace('defineProps<{ month?: string }>()', '({})').replace("defineEmits<{ (event: 'back'): void }>()", '(() => {})');
  const expose =
    '\nexport { wizardStep, goToStep, ruleForm, ruleConfirmed, movePerson, morningRest, applyMonth, generateRoster, applyAutoRoster, saveRoster, exportRoster, loadUsers, startEditing, handleDayUsersChange, handleNightUsersChange, handleSelectedUsersChange, handlePageChange, rosterRows, rotationUsers, persons, generationRule, isLocked, dirty, savedVersion, currentPage, pageSize, canManage, ruleAnalysis, textRuleCanGenerate, checkRuleText };';
  const saved = new Map();
  const messages = [],
    confirmations = [];
  let savedPayload,
    saveCount = 0,
    failSave = false,
    exportCount = 0,
    readonly = false,
    deferred;
  const mockApi = {
    loadDutyRosterUsers: async () => ({ canManage: !readonly, persons: clone(fourUsers) }),
    queryDutyRoster: async (month) => {
      if (deferred && !deferred.requested && month === '2026-08')
        return new Promise((resolve) => {
          deferred.requested = true;
          deferred.resolve = resolve;
        });
      return clone(saved.get(month) || result(month, { canManage: !readonly }));
    },
    saveDutyRoster: async (data) => {
      saveCount++;
      if (failSave) throw new Error('版本过期，请刷新后重试');
      savedPayload = clone(data);
      const stored = result(data.month, { ...clone(data), id: 'roster', version: data.version + 1, saved: true });
      saved.set(data.month, stored);
      return clone(stored);
    },
  };
  const state = evaluate(setup + expose, (path) => {
    if (path === './dutyRoster.permissions') return { useDutyRosterPermissions: () => ({canAdd: {get value(){return !readonly;}}, canEdit:{get value(){return !readonly;}}, canExport:{get value(){return !readonly;}}}) };
    if (path === 'vue') return { ...require('vue'), onMounted() {} };
    if (path === 'dayjs') return dayjs;
    if (path === 'ant-design-vue') return { Modal: { confirm: (options) => confirmations.push(options) } };
    if (path.includes('useMessage'))
      return { useMessage: () => ({ createMessage: { warning: (m) => messages.push(m), error: (m) => messages.push(m), success() {} } }) };
    if (path === './dutyRoster.rules') return rules;
    if (path === './dutyRoster.textRule') return textRules;
    if (path === './dutyRoster.advancedRule') return evaluate(fs.readFileSync('src/views/operation/duty-roster/dutyRoster.advancedRule.ts','utf8'), require);
    if (path === './dutyRoster.api') return mockApi;
    if (path === './dutyRosterExcel')
      return {
        exportDutyRosterExcel: async () => {
          exportCount++;
        },
      };
    return {};
  });
  await state.loadUsers();
  state.generationRule.value = 'text';
  await state.applyMonth(dayjs('2026-10'));
  state.handleSelectedUsersChange(['A','B','C']);
  assert.equal(state.wizardStep.value,0);
  state.goToStep(1);assert.equal(state.wizardStep.value,1);
  state.ruleForm.value.nightRest='full';
  state.goToStep(0);state.goToStep(2);assert.equal(state.ruleForm.value.nightRest,'full','切换步骤保留休息设置');
  state.goToStep(3);assert.equal(state.wizardStep.value,2,'未生成不可进入排班页');
  state.ruleForm.value.nightRest='morning';

  await state.generateRoster();
  assert.equal(state.rosterRows.value.length, 0, '人数规则未检查不能生成');
  state.ruleForm.value = {...state.ruleForm.value,day:2,night:1,weekendDay:1,weekendNight:1};
  await state.checkRuleText();
  assert.equal(state.textRuleCanGenerate.value, true);
  assert.equal(state.rosterRows.value.length, 0, '检查规则不覆盖已有表格');
  state.ruleForm.value.day = 3;
  assert.equal(state.textRuleCanGenerate.value, false, '人数改变后先前检查自动失效');
  state.ruleForm.value = {...state.ruleForm.value,day:2,night:1,weekendDay:1,weekendNight:1};
  await state.checkRuleText();
  await state.generateRoster();
  assert.equal(state.rosterRows.value.length,0,'检查通过后仍需确认理解');
  state.ruleConfirmed.value=true;
  await state.generateRoster();
  assert.equal(state.wizardStep.value,3,'生成成功跳转排班页');
  state.handleDayUsersChange(state.rosterRows.value[0], ['A']);
  assert.equal(state.ruleAnalysis.value.rows[0].dayUsers.length, 2, '生成表和检查结果不共享可变引用');
  const editedRows = JSON.stringify(state.rosterRows.value);
  state.movePerson(0, 1);
  assert.equal(state.ruleConfirmed.value, false, '人员调序清除确认');
  assert.equal(state.textRuleCanGenerate.value, false, '人员调序后须重新检查');
  assert.equal(JSON.stringify(state.rosterRows.value), editedRows, '人员调序不覆盖人工修改');
  await state.applyMonth(dayjs('2026-10'));
  assert.equal(state.textRuleCanGenerate.value, false, '月份刷新需重新检查');
  state.generationRule.value = 'rotation';
  state.handleSelectedUsersChange(['A','B','C','D']);
  await state.generateRoster();
  assert.equal(state.rosterRows.value.length, 31);
  state.handleDayUsersChange(state.rosterRows.value[0], ['A']);
  state.handleNightUsersChange(state.rosterRows.value[0], 'C');
  assert.deepEqual(state.morningRest(state.rosterRows.value[1]).map(p=>p.userId),['C'],'修改昨夜夜班自动更新次日上午休息');
  state.handleDayUsersChange(state.rosterRows.value[1], ['A','B','D']);
  assert.deepEqual(state.morningRest(state.rosterRows.value[1]),[],'没有排当天白班的不误标半天休息');

  await state.saveRoster();
  assert.equal(saveCount, 1);
  assert.equal(savedPayload.days[0].dayUsers.length, 1, '实际1人白班允许保存');
  assert.equal(savedPayload.days[0].nightUser.userId, 'C');
  assert.deepEqual(savedPayload.days[0].restUsers, rules.getRestUsers(savedPayload.rotationUsers, savedPayload.days[0]));
  assert.equal(state.isLocked.value, true);
  assert.equal(state.savedVersion.value, 1);
  state.handleDayUsersChange(state.rosterRows.value[0], ['B']);
  await state.saveRoster();
  assert.equal(saveCount, 1, '锁定后禁止再保存或修改');
  assert.equal(state.rosterRows.value[0].dayUsers[0].userId, 'A');
  await state.exportRoster();
  assert.equal(exportCount, 1);
  state.startEditing();
  state.handleDayUsersChange(state.rosterRows.value[0], []);
  failSave = true;
  await state.saveRoster();
  assert.equal(state.isLocked.value, false);
  assert.equal(state.dirty.value, true);
  assert.equal(state.savedVersion.value, 1);
  assert.equal(state.rosterRows.value[0].dayUsers.length, 0);
  assert.ok(messages.includes('版本过期，请刷新后重试'));
  await state.exportRoster();
  assert.equal(exportCount, 1, '编辑中不能误导出旧的服务器版本');
  failSave = false;
  await state.applyMonth(dayjs('2026-10'));
  assert.equal(state.isLocked.value, true);
  assert.equal(state.rosterRows.value[0].dayUsers.length, 1, '重新打开回显人工调整而非生成规则');
  state.startEditing();
  state.applyAutoRoster();
  assert.equal(confirmations.length, 1, '重新生成需要确认覆盖人工调整');
  await state.applyMonth(dayjs('2026-11'));
  state.handleSelectedUsersChange(['A','B','C','D']);
  await state.generateRoster();
  assert.deepEqual(
    state.rosterRows.value[0].dayUsers.map((u) => u.userId),
    november[0].dayUsers.map(u=>u.userId)
  );
  state.generationRule.value = 'manual';
  await state.generateRoster();
  assert.equal(state.rosterRows.value[0].dayUsers.length, 0);
  state.handleDayUsersChange(state.rosterRows.value[0], ['A']);
  state.handleSelectedUsersChange(['B', 'C']);
  assert.equal(state.rosterRows.value[0].dayUsers[0].userId, 'A', '配置变更不删改已编辑明细');
  state.handlePageChange(3, 10);
  assert.equal(state.currentPage.value, 3);
  state.handlePageChange(2, 20);
  assert.equal(state.currentPage.value, 1);
  deferred = {};
  const oldRequest = state.applyMonth(dayjs('2026-08'));
  await state.applyMonth(dayjs('2026-09'));
  deferred.resolve(result('2026-08', { days: rows('2026-08') }));
  await oldRequest;
  assert.equal(state.rosterRows.value.length, 0, '过期月份请求不覆盖当前月');
  deferred = undefined;
  readonly = true;
  await state.loadUsers();
  await state.applyMonth(dayjs('2026-12'));
  const countBefore = saveCount;
  await state.generateRoster();
  await state.saveRoster();
  assert.equal(state.canManage.value, false);
  assert.equal(saveCount, countBefore);

  const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc');
  const { descriptor, errors } = parse(pageSource);
  assert.deepEqual(errors, []);
  compileScript(descriptor, { id: 'roster' });
  assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename: `${directory}DutyRosterEditor.vue`, id: 'roster' }).errors, []);
  console.log(
    'PASS 轮值初稿/跨月、自由人数与空班保存、原样快照、正式API/业务失败/导出错误、保存锁定/重新编辑/失败保留、只读权限、月份竞态与分页、SFC编译'
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
