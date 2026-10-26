<template>
  <a-drawer :open="true" title="维修内协邀请 · 本地 Mock" width="min(1240px, 100vw)" :mask-closable="false" @close="emit('close')">
    <section class="repair-mock">
      <a-alert type="info" show-icon message="仅本地演示，不会生成真实审批或待办"
        description="部门、主管均为示例数据；与当前流程草稿隔离，不调用业务接口、不修改已发布模型。" />
      <header class="mock-toolbar">
        <a-radio-group v-model:value="step" button-style="solid">
          <a-radio-button value="basic">1. 基础信息</a-radio-button>
          <a-radio-button value="canvas">2. 流程设计</a-radio-button>
        </a-radio-group>
        <a-space wrap><span class="save-status" role="status">{{ saveStatus }}</span><a-button @click="saveLocal">暂存本地 Mock</a-button></a-space>
      </header>
      <div v-if="step === 'basic'" class="mock-basic">
        <h2>关联已有业务，不重复搭建表单</h2>
        <a-form layout="vertical">
          <a-form-item label="流程名称" required><a-input v-model:value="name" :maxlength="100" /></a-form-item>
          <a-form-item label="关联业务"><a-select value="repairInternal" :options="[{value:'repairInternal',label:'维修内协邀请'}]" /></a-form-item>
        </a-form>
        <p>申请人在维修详情中选择受邀部门，逐部门填写协助原因。审批画布只负责配置审批顺序和选人规则。</p>
        <a-button type="primary" @click="step = 'canvas'">下一步：配置审批节点</a-button>
      </div>
      <div v-else class="mock-workbench">
        <div class="mock-canvas" aria-label="维修内协审批画布">
          <div class="canvas-caption"><strong>{{ name || '维修内协邀请' }}</strong><span>点击节点，查看人员配置</span></div>
          <div class="mock-diagram">
            <div class="mock-terminal"><UserOutlined />发起内协申请</div>
            <FlowSequence v-model:nodes="nodes" readonly :selected="selected.id" @select="selectNode" />
            <div class="mock-terminal"><CheckCircleOutlined />审批结束</div>
            <p class="after-flow">审批外业务：各部门单独指定内协人员</p>
          </div>
          <p class="canvas-footnote">一个关联节点容纳全部受邀部门，无需增加分支。</p>
        </div>
        <aside class="mock-inspector">
          <a-tabs v-model:activeKey="tab">
            <a-tab-pane key="config" tab="人员配置" />
            <a-tab-pane key="run" tab="模拟审批" />
          </a-tabs>
          <template v-if="tab === 'config'">
            <h2>{{ selected.name }}</h2>
            <a-form layout="vertical">
              <a-form-item label="节点名称"><a-input v-model:value="selected.name" :maxlength="60" /></a-form-item>
              <a-form-item label="审批人员类型">
                <a-select :value="selected.id === nodes[0].id ? 'role' : 'related'" disabled
                  :options="[{value:'role',label:'指定角色'},{value:'related',label:'关联部门主管'}]" />
              </a-form-item>
            </a-form>
            <template v-if="selected.id === nodes[0].id">
              <a-form layout="vertical"><a-form-item label="审批角色"><a-select value="mock-ops-role" :options="[{value:'mock-ops-role',label:'运维主管（示例角色）'}]" /></a-form-item></a-form>
              <p class="muted">此节点先办理。示例角色仅用于 Mock，正式角色需后端绑定，不使用发起人所在部门的主管代替。</p>
            </template>
            <template v-else>
              <RelatedDepartmentConfig v-model:value="rule" :fields="fields" repair />
              <div class="binding-example"><strong>每次申请动态关联</strong><p>受邀部门字段 → 查询部门主管 → 按部门并行审批</p><p>例如选择技术部和工程部，就分别通知两个部门的主管。</p></div>
            </template>
            <a-button type="primary" @click="tab = 'run'">选择示例部门，模拟审批</a-button>
          </template>
          <template v-else>
            <h2>模拟一次内协邀请</h2>
            <p class="muted">先选部门，再模拟运维主管审批。通过后，所有受邀部门同时进入待审批。</p>
            <a-form layout="vertical"><a-form-item label="受邀部门（示例）" required>
              <a-select v-model:value="departmentIds" mode="multiple" :options="departmentOptions" :max-tag-count="3" placeholder="选择一个或多个部门" />
            </a-form-item></a-form>
            <div class="run-toolbar"><a-button type="primary" @click="startRun">{{ run ? '重新模拟' : '开始模拟' }}</a-button><span class="muted">更改配置或部门后，模拟结果会清空。</span></div>
            <a-empty v-if="!run" :image="Empty.PRESENTED_IMAGE_SIMPLE" description="尚未开始模拟，不会向实际主管发消息。" />
            <template v-else>
              <a-alert v-if="run.error" type="error" show-icon :message="run.error" />
              <div v-else class="run-result" aria-live="polite">
                <div class="run-heading"><strong>{{ stateLabels[stage] }}</strong><span>{{ approvedCount }} / {{ run.groups.length }} 个部门已通过</span></div>
                <div class="operations-row"><div><strong>运维主管（示例）</strong><p>{{ voteLabels[run.operations] }}</p></div>
                  <a-space><a-button size="small" :disabled="stage !== 'OPERATIONS'" @click="voteOperations(run, 'APPROVED')">模拟通过</a-button><a-button size="small" danger :disabled="stage !== 'OPERATIONS'" @click="voteOperations(run, 'REJECTED')">模拟驳回</a-button></a-space>
                </div>
                <div class="department-results" aria-label="受邀部门审批任务">
                  <section v-for="group in run.groups" :key="group.department.id" class="department-row">
                    <div class="department-heading"><strong>{{ group.department.name }}</strong><a-tag :color="groupState(group) === 'APPROVED' ? 'green' : groupState(group) === 'REJECTED' ? 'red' : 'default'">{{ departmentStatus(group) }}</a-tag></div>
                    <div v-for="head in group.department.heads" :key="head.id" class="head-row">
                      <span>{{ head.name }}<small>{{ headStatus(group, head.id) }}</small></span>
                      <a-space><a-button size="small" :disabled="!canVote(group, head.id)" :aria-label="`${group.department.name}${head.name}模拟通过`" @click="voteDepartment(run, group.department.id, head.id, 'APPROVED')">通过</a-button><a-button size="small" danger :disabled="!canVote(group, head.id)" :aria-label="`${group.department.name}${head.name}模拟驳回`" @click="voteDepartment(run, group.department.id, head.id, 'REJECTED')">驳回</a-button></a-space>
                    </div>
                  </section>
                </div>
                <a-alert v-if="stage === 'REJECTED'" type="error" show-icon message="整单退回，不创建指定人员待办，不加入成员。" />
                <div v-else-if="stage === 'APPROVED'" class="assignment-result">
                  <h3>审批已结束 · 待独立指定人员</h3>
                  <p>下面是审批外业务待办的模拟结果，不是新增审批节点。</p>
                  <ul><li v-for="group in run.groups" :key="group.department.id">{{ group.department.name }}主管：待指定本部门内协人员</li></ul>
                  <p>此演示不实际指定成员，也不会改变维修单权限。</p>
                </div>
              </div>
            </template>
          </template>
        </aside>
      </div>
    </section>
  </a-drawer>
</template>
<script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  import { Empty, message } from 'ant-design-vue';
  import { CheckCircleOutlined, UserOutlined } from '@ant-design/icons-vue';
  import FlowSequence from './FlowSequence.vue';
  import RelatedDepartmentConfig from './RelatedDepartmentConfig.vue';
  import { repairInternalPreset } from './businessPresets';
  import type { DesignNode } from './graph';
  import { createMockRun, mockDepartments, mockRunState, groupState, voteDepartment, voteOperations, type MockRun } from './departmentMock';
  const emit = defineEmits<{(e:'close'):void}>();
  const preset = repairInternalPreset();
  // Never mix synthetic IDs or mock persistence with executable workflow definitions.
  const nodes = ref(preset.nodes);
  nodes.value[0].approval!.roleIds = ['mock-ops-role'];
  const fields = [{key:'departments',name:'受邀部门',type:'departments'}];
  const name = ref('维修内协邀请');
  const step = ref('canvas'), tab = ref('config'), selectedId = ref(nodes.value[1].id);
  const selected = computed(() => nodes.value.find(n => n.id === selectedId.value) || nodes.value[1]);
  const rule = computed({get:() => nodes.value[1].config.relatedDepartment!,set:value => {nodes.value[1].config.relatedDepartment = value;}});
  const departmentIds = ref(['mock-tech','mock-engineering']);
  const departmentOptions = mockDepartments.map(d => ({value:d.id,label:d.name}));
  const run = ref<MockRun>();
  const stage = computed(() => run.value ? mockRunState(run.value) : 'BLOCKED');
  const approvedCount = computed(() => run.value?.groups.filter(g => groupState(g) === 'APPROVED').length || 0);
  const voteLabels = {PENDING:'待审批',APPROVED:'已通过',REJECTED:'已驳回'};
  const stateLabels = {BLOCKED:'无法发起',OPERATIONS:'等待运维主管审批',DEPARTMENTS:'受邀部门并行审批中',APPROVED:'全部审批通过',REJECTED:'申请已驳回'};
  const storageKey = 'workflow-mock:repair-internal:v1';
  const saveStatus = ref('未暂存 · 关闭后未存修改将丢失');
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
    if (saved?.version === 1 && typeof saved.name === 'string' && Array.isArray(saved.nodeNames) && saved.nodeNames.length === 2 && saved.nodeNames.every(n => typeof n === 'string') && Array.isArray(saved.departmentIds) && saved.departmentIds.every(id => mockDepartments.some(d => d.id === id))) {
      name.value = saved.name.slice(0,100);
      nodes.value.forEach((n,i) => {n.name = saved.nodeNames[i].slice(0,60);});
      departmentIds.value = [...new Set<string>(saved.departmentIds)];
      saveStatus.value = '已恢复本机会话 Mock';
    }
  } catch { saveStatus.value = '未恢复本地 Mock，使用默认示例'; }
  watch([name, nodes, departmentIds], () => { saveStatus.value = '有未暂存修改'; }, {deep:true});
  watch([rule, departmentIds], () => { run.value = undefined; }, {deep:true});
  function selectNode(node: DesignNode) { selectedId.value = node.id; tab.value = 'config'; }
  function startRun() { run.value = createMockRun(departmentIds.value, rule.value); }
  function canVote(group: MockRun['groups'][number], headId: string) {
    return stage.value === 'DEPARTMENTS' && groupState(group) === 'PENDING' && group.votes[headId] === 'PENDING';
  }
  function departmentStatus(group: MockRun['groups'][number]) {
    if (groupState(group) !== 'PENDING') return voteLabels[groupState(group)];
    return stage.value === 'REJECTED' ? '已终止' : stage.value === 'OPERATIONS' ? '等待前序审批' : '待审批';
  }
  function headStatus(group: MockRun['groups'][number], id: string) {
    if (group.votes[id] !== 'PENDING') return voteLabels[group.votes[id]];
    return groupState(group) === 'APPROVED' ? '同部门已通过，无需办理' : departmentStatus(group);
  }
  function saveLocal() {
    if (!name.value.trim() || nodes.value.some(n => !n.name.trim())) { message.warning('请填写流程名称和节点名称'); return; }
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({version:1,name:name.value,nodeNames:nodes.value.map(n => n.name),departmentIds:departmentIds.value}));
      saveStatus.value = '已暂存本机会话 · 未保存到服务器';
      message.success('Mock 已暂存，审批模拟结果不会保存');
    } catch { message.error('本机存储不可用，未保存，请勿关闭页面'); }
  }
</script>
<style scoped>
  /* Local extension: incumbent OA canvas + shared personnel controls; synthetic execution stays outside the editable graph. */
  .repair-mock { color:#303448; }
  .mock-toolbar { display:flex; justify-content:space-between; gap:16px; flex-wrap:wrap; align-items:center; margin:20px 0; }
  .save-status,.muted { color:#545b6c; font-size:13px; line-height:1.7; }
  .mock-basic { max-width:660px; margin:36px auto; }
  h2 { margin:0 0 20px; font-size:16px; font-weight:600; }
  p { line-height:1.7; }
  .mock-workbench { display:grid; grid-template-columns:minmax(300px,0.85fr) minmax(0,1.15fr); border:1px solid #dcdee7; }
  .mock-canvas { background:#f7f8fc; padding:24px 16px; }
  .canvas-caption { text-align:center; overflow-wrap:anywhere; }
  .canvas-caption span { display:block; margin-top:8px; color:#545b6c; font-size:13px; }
  .mock-diagram { display:flex; align-items:center; flex-direction:column; margin:28px 0; }
  .mock-terminal { display:flex; align-items:center; justify-content:center; gap:8px; padding:12px 18px; background:#fff; border:1px solid #dcdee7; border-radius:4px; }
  .mock-diagram :deep(.insert-node) { visibility:hidden; }
  .mock-diagram :deep(.add-connector) { height:44px; }
  .mock-inspector { background:#fff; padding:12px 24px 28px; min-width:0; border-left:1px solid #dcdee7; }
  .mock-inspector :deep(.ant-tabs) { margin-bottom:12px; }
  .binding-example { background:#f7f8fc; padding:16px; margin:20px 0; border-radius:4px; }
  .binding-example p { margin:8px 0 0; font-size:13px; color:#545b6c; }
  .after-flow,.canvas-footnote { margin:16px 0 0; text-align:center; font-size:13px; color:#545b6c; }
  .after-flow { max-width:230px; }
  .run-toolbar { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:20px; }
  .run-heading,.department-heading,.operations-row,.head-row { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; }
  .run-heading { padding:12px 0; border-bottom:1px solid #dcdee7; }
  .run-heading span { color:#545b6c; font-size:13px; font-variant-numeric:tabular-nums; }
  .operations-row { padding:20px 0; }
  .operations-row p { margin:6px 0 0; color:#545b6c; font-size:13px; }
  .department-results { max-height:360px; overflow:auto; scrollbar-color:#dcdee7 #f7f8fc; }
  .department-row { padding:18px 0; border-top:1px solid #dcdee7; }
  .head-row { margin-top:12px; }
  .head-row small { display:block; color:#545b6c; margin-top:4px; }
  .assignment-result { border-top:1px solid #dcdee7; margin-top:20px; padding-top:20px; }
  .assignment-result h3 { font-size:14px; margin:0 0 10px; }
  .assignment-result p,.assignment-result li { color:#545b6c; font-size:13px; line-height:1.8; }
  .assignment-result ul { padding-left:20px; }
  .repair-mock :deep(button:focus-visible) { outline:2px solid #6266dc !important; outline-offset:3px; }
  .repair-mock ::selection { background:#f0f7ff; color:#303448; }
  @media (max-width:760px) {
    .mock-workbench { grid-template-columns:1fr; }
    .mock-inspector { border-left:0; border-top:1px solid #dcdee7; padding:12px 16px 24px; }
    .mock-canvas { padding:20px 12px; }
  }
</style>
