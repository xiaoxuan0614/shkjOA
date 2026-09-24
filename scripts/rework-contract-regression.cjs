const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { parse } = require('@vue/compiler-sfc');
const root = path.resolve(__dirname, '..');
const pc = path.join(root, 'src/views/project/detail/components/ReworkDrawer.vue');
const app = path.resolve(root, '../SHKKJ-uniapp/src/pages/ops/components/ProjectReworkPanel.vue');
function dateRule(base) {
  const source = fs.readFileSync(path.join(base, 'src/utils/expectedAcceptanceDate.ts'), 'utf8');
  const context = { exports: {} };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
  return context.exports.expectedAcceptanceDate;
}
const expectedAcceptanceDate = dateRule(root);
for (const base of [root, path.resolve(root, '../SHKKJ-uniapp')]) {
  const validate = dateRule(base);
  assert.equal(validate('', []), null);
  assert.equal(validate('2026-10-15', [{ plannedEndTime: '2026-10-15' }]), '2026-10-15');
  assert.throws(() => validate('2026-02-30', []), /有效/);
  assert.throws(() => validate('2026-10-14', [{ plannedEndTime: '2026-10-15' }]), /早于/);
}
function functions(file, names, state) {
  const source = parse(fs.readFileSync(file, 'utf8')).descriptor.scriptSetup.content;
  const ast = ts.createSourceFile('test.ts', source, ts.ScriptTarget.Latest, true);
  const selected = ast.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name?.text));
  assert.equal(selected.length, names.length);
  const code = selected.map(n => n.getText(ast)).join('\n') + '\nexports.api={' + names.join(',') + '};';
  const context = { ...state, exports: {} };
  vm.runInNewContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, context);
  return context.exports.api;
}
const unit = { unitId: 'u1', headcount: 2, workHours: 1.5 };
for (const file of [pc, app]) {
  const rows = { value: [{ ...unit }] }, enabled = { value: true };
  const api = functions(file, ['buildOutsources'], {
    needsOutsource: enabled, outsourceRows: rows, form: { value: { outsources: rows.value } },
  });
  assert.equal(api.buildOutsources().length, 1);
  rows.value.push({ ...unit }); assert.throws(() => api.buildOutsources(), /重复/); rows.value.pop();
  for (const invalid of [0, -1, 0.001, NaN, 100000000]) {
    rows.value[0].workHours = invalid; assert.throws(() => api.buildOutsources(), /工时/);
  }
  rows.value[0].workHours = 1;
  rows.value[0].headcount = 1.5; assert.throws(() => api.buildOutsources(), /人数/);
  enabled.value = false; assert.equal(api.buildOutsources().length, 0);
  enabled.value = true; rows.value.splice(0); assert.throws(() => api.buildOutsources(), /至少/);
}
const plan = functions(pc, ['parsePlan'], {});
assert.equal(plan.parsePlan({ planJson: JSON.stringify({ process: [{processName:'A'}, {processName:'B'}] }) }).process.length, 2);
assert.equal(plan.parsePlan({ planJson: JSON.stringify({ process: {processName:'legacy'} }) }).process.length, 1);
const submittedMaterial = {materialId:'m1', materialName:'电缆', plannedQty:12, unit:'米'};
assert.equal(plan.parsePlan({approvalStatus:'2', planJson:JSON.stringify({materials:[submittedMaterial]})}).materials[0].plannedQty,12);
assert.equal(plan.parsePlan({planJson:{materials:[submittedMaterial]}}).materials[0].materialName,'电缆');
assert.equal(plan.parsePlan({planJson:'{}'}).materials.length,0);

async function main() {
  const approvalState = {
    preparingApproval:{value:false}, approvalRecord:{value:{}}, approvalApproved:{value:false},
    approvalComment:{value:'旧意见'}, approvalVisible:{value:false},
    getLatestReworkSnapshot:async()=>({latest:{id:'r1',version:2,planJson:JSON.stringify({materials:[submittedMaterial]})}}),
    canApproveRework:()=>true, createMessage:{error:m=>{throw Error(m);}},
  };
  const approval = functions(pc,['prepareApproval'],approvalState);
  await approval.prepareApproval({id:'r1',version:1},true);
  assert.equal(approvalState.approvalVisible.value,true);
  assert.equal(approvalState.approvalRecord.value.version,2);
  assert.equal(plan.parsePlan(approvalState.approvalRecord.value).materials[0].plannedQty,12);
  assert.equal(approvalState.preparingApproval.value,false);
  let payload;
  const form = { id: '', reason: '原因', sourceAcceptanceId: 'failed' };
  const state = {
    saving: {value:false}, form, expectedAcceptanceDate, expectedDateError:{value:''}, periodId:{value:'p'}, currentUserId:{value:'manager'},
    canApply:{value:true}, needsMaterials:{value:false}, materialRef:{value:{getData:()=>{throw Error('disabled materials read');}}},
    buildProcess:()=>[{processName:'A'},{processName:'B'}], buildOutsources:()=>[unit],
    assertAcceptanceApplication:async()=>{}, submitProjectRework:async p=>{payload=p;},
    createMessage:{warning:m=>{throw Error(m);}, error:m=>{throw Error(m);},success:()=>{}},
    editing:{value:true}, loadReworks:async()=>{}, emit:()=>{},
  };
  const api = functions(pc, ['submitApplication'], state);
  await api.submitApplication();
  assert.equal(payload.process.length, 2);
  assert.equal(payload.outsources.length, 1);
  assert.equal(payload.materials.length, 0);
  assert.equal('id' in payload, false);
  assert.equal(payload.expectedAcceptanceDate, null);
  form.expectedAcceptanceDate = '2026-10-15';
  form.id='r'; form.version=3;
  await api.submitApplication();
  assert.equal(payload.id,'r'); assert.equal(payload.version,3);
  assert.equal(payload.expectedAcceptanceDate, '2026-10-15');
  assert.equal('reworkId' in payload,false);
  for (const file of [pc, app]) {
    const source = fs.readFileSync(file,'utf8');
    assert.doesNotMatch(source,/reworkApi\.save\(|addProjectRework\(|editProjectRework\(/);
    assert.doesNotMatch(source,/保存草稿/);
  }
  console.log('返工契约回归通过：多工序、旧单兼容、外协去重/人数/工时、关闭补料、完整方案送审及重提版本');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
