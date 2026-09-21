const fs = require('node:fs');
const assert = require('node:assert/strict');
const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc');
const pc = 'src/views/project/detail/components/DetailAcceptance.vue';
const mobile = '/Users/xuan/AI/ClaudeAllData/SHKKJ-uniapp/src/pages/ops/components/ProjectAcceptancePopup.vue';
for (const file of [pc, mobile]) {
  const text = fs.readFileSync(file, 'utf8');
  const { descriptor, errors } = parse(text);
  assert.equal(errors.length, 0);
  compileScript(descriptor, { id: 'acceptance-layout' });
  assert.equal(compileTemplate({ source: descriptor.template.content, filename: file, id: 'acceptance-layout' }).errors.length, 0);
  assert.ok(text.includes('查看详情'));
  assert.ok(text.includes('客户验收负责人'));
  assert.doesNotMatch(text, /acceptUnitLeader\s*\|\|\s*(?:card\.model\.|record\.|forms\[type\]\.|row\.)?acceptLeaderName/, '客户姓名不能作为实际操作人兜底');
  assert.ok(text.includes(file === pc ? 'v-if="!footerActions && !loading"' : 'v-if="!loading"'));
  assert.ok(text.includes('historyOpen.value = false'));
  if (file === pc) {
    const drawer = text.slice(text.indexOf('<a-drawer'), text.indexOf('</a-drawer>'));
    assert.ok(drawer.includes('<a-table'));
    assert.ok(drawer.includes('<DetailReworks'));
    assert.equal((text.match(/<DetailReworks/g) || []).length, 1);
    assert.ok(text.includes('v-if="!canEdit(card.model, card.type)"'));
    const actionsStart = text.indexOf('<div v-if="!footerActions && !loading && failedActionCards.length"');
    assert.ok(actionsStart > text.indexOf('</a-spin>'), '失败操作应在验收卡片下方');
    const actions = text.slice(actionsStart, text.indexOf('<a-drawer'));
    assert.ok(actions.includes('申请重新验收'));
    assert.ok(actions.includes('申请返工'));
    assert.ok(actions.includes('card.title'));
    assert.ok(actions.includes('openRecheck(card.type)'));
    assert.ok(actions.includes('openRework(card.model, card.type)'));
  } else {
    const drawer = text.slice(text.indexOf('position="right"'), text.indexOf('<ContractFilePreview'));
    assert.ok(drawer.includes('<ProjectReworkPanel'));
    assert.ok(drawer.includes('row.acceptType'));
    assert.ok(text.includes('v-else-if="!canEdit(type)"'));
  }
}
const rework = fs.readFileSync('src/views/project/detail/components/ReworkDrawer.vue', 'utf8');
const modalFile = 'src/views/project/components/AcceptanceModal.vue';
const modalSource = fs.readFileSync(modalFile, 'utf8');
const modalDescriptor = parse(modalSource).descriptor;
compileScript(modalDescriptor, {id:'acceptance-modal'});
assert.equal(compileTemplate({source:modalDescriptor.template.content, filename:modalFile, id:'acceptance-modal'}).errors.length,0);
assert.ok(modalSource.includes('<template #footer>'));
assert.ok(modalSource.includes('acceptanceRef.submit(action.type)'));
assert.ok(modalSource.includes(':disabled="acceptanceRef.submitDisabled"'));
assert.ok(modalSource.includes('footer-actions'));
assert.ok(modalSource.includes('acceptanceRef.secondaryActions'));
assert.ok(modalSource.includes('@click="action.onClick()"'));
assert.ok(fs.readFileSync(pc,'utf8').includes('!footerActions && canComplete(card.model, card.type)'));
const ts = require('typescript');
const vm = require('node:vm');
const ownerScript = parse(fs.readFileSync(pc, 'utf8')).descriptor.scriptSetup.content;
const ownerAst = ts.createSourceFile('owner.ts', ownerScript, ts.ScriptTarget.Latest, true);
const actionDeclaration = ownerAst.statements.find(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(ownerAst) === 'secondaryActions'));
const clicked = [];
const actionContext = {
  computed:fn=>({get value(){return fn();}}), loading:{value:false}, submitDisabled:{value:false}, startingAcceptance:{value:false},
  recheckLoading:{value:false}, canApplyNormal:{value:false}, openLatestRework:()=>clicked.push('latest-rework'),
  props:{project:{status:'ACCEPTING'}}, acceptedManager:{value:true}, canStartAcceptance:()=>true,
  failedActionCards:{value:[]}, canRequestRecheck:()=>true, canApplyRework:()=>true,
  openHistory:()=>clicked.push('history'), handleStartAcceptance:()=>clicked.push('start'),
  openRecheck:type=>clicked.push(type), openRework:(record,type)=>clicked.push(record.id+type),
};
vm.createContext(actionContext);
vm.runInContext(ts.transpileModule(actionDeclaration.getText(ownerAst)+';globalThis.actions=secondaryActions;', {compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,actionContext);
assert.equal(actionContext.actions.value.length,1, '无失败项也保留查看详情');
actionContext.actions.value[0].onClick(); assert.equal(clicked.pop(),'history');
actionContext.failedActionCards.value=[{type:'CUSTOMER',title:'外部验收',model:{id:'f'}}];
assert.equal(actionContext.actions.value.length,3);
actionContext.actions.value[1].onClick(); assert.equal(clicked.pop(),undefined);
actionContext.actions.value[2].onClick(); assert.equal(clicked.pop(),'latest-rework');
actionContext.failedActionCards.value.push({type:'INTERNAL',title:'内部验收',model:{id:'i'}});
assert.deepEqual(Array.from(actionContext.actions.value,a=>a.label),['查看详情','申请验收（免整改复验）','申请返工']);
actionContext.submitDisabled.value=true; assert.ok(actionContext.actions.value.every(a=>a.disabled));
actionContext.failedActionCards.value=[]; actionContext.props.project.status='PENDING_ACCEPT';
actionContext.canApplyNormal.value=true;
assert.equal(actionContext.actions.value[1].label,'申请验收');
actionContext.loading.value=true; assert.equal(actionContext.actions.value.length,0);
const ownerFunction = ownerAst.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'responsibleName');
let editable = true;
const ownerRecord = {acceptLeaderName:'原办理人', acceptUnitLeader:'客户联系人'};
const ownerContext = {activeRecord:()=>ownerRecord, canEdit:()=>editable, currentUserName:{value:'当前操作人'}};
vm.createContext(ownerContext);
vm.runInContext(ts.transpileModule(ownerFunction.getText(ownerAst), {compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText, ownerContext);
assert.equal(ownerContext.responsibleName('CUSTOMER'),'当前操作人');
editable = false;
assert.equal(ownerContext.responsibleName('CUSTOMER'),'原办理人');
ownerRecord.acceptLeaderName = '';
assert.equal(ownerContext.responsibleName('CUSTOMER'),'—');
assert.ok(rework.includes(':data-source="parsePlan(detailRecord).materials"'));
assert.ok(rework.includes(':data-source="parsePlan(approvalRecord).materials"'));
assert.ok(rework.includes('本次返工无需额外领料'));
assert.ok(rework.includes('v-if="!materialStatsLoaded"'), '执行统计仍按需加载');
console.log('验收布局回归通过：历史仅在抽屉、空记录隐藏条件、只读摘要及两端 SFC 编译');
