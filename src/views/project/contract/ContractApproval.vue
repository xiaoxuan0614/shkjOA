<template>
  <div class="contract-approval">
    <a-space><a-button @click="$router.back()">返回</a-button><a-button type="primary" :disabled="!instance || loading" @click="recordsOpen = true">审批记录</a-button><a-button :disabled="busy || loading || !!pending || !!withdrawal" @click="load">刷新审批</a-button></a-space>
    <a-alert v-if="capabilityError" type="warning" show-icon :message="capabilityError" />
    <a-alert v-if="error" type="error" show-icon :message="error" />
    <a-spin :spinning="loading">
      <template v-if="instance && business">
        <a-alert v-if="!business.snapshotComplete" type="warning" message="历史送审资料不完整，仅展示当时保存且有权查看的内容。" />
        <a-card v-if="snapshot.projectContext" title="项目基本信息">
          <a-descriptions bordered size="small" :column="{ xs: 1, sm: 2, md: 3 }">
            <a-descriptions-item label="项目名称">{{ [snapshot.projectContext.projectName, snapshot.projectContext.periodName].filter(Boolean).join('-') || '—' }}</a-descriptions-item>
            <a-descriptions-item v-if="hasProject('customerName')" label="甲方名称">{{ snapshot.projectContext.customerName || '—' }}</a-descriptions-item>
            <a-descriptions-item v-if="hasProject('contactPerson')" label="项目对接人">{{ snapshot.projectContext.contactPerson || '—' }}</a-descriptions-item>
          </a-descriptions>
        </a-card>
        <a-card title="合同信息">
          <a-descriptions bordered size="middle" :column="{ xs: 1, sm: 1, md: 2 }">
            <a-descriptions-item label="审批状态"><a-tag>{{ statusLabels[instance.status] || instance.status }}</a-tag></a-descriptions-item>
            <a-descriptions-item v-for="key in contractFields.filter(hasField)" :key="key" :label="labels[key]">{{ displayField(key) }}</a-descriptions-item>
            <a-descriptions-item v-for="key in attachments.filter(hasField)" :key="key" :label="labels[key]" :span="2">
              <a-space v-if="files(key).length" direction="vertical"><a-button v-for="file in files(key)" :key="file.id" :loading="downloading === file.id" :disabled="!!downloading" @click="download(file)">{{ file.fileName || '下载附件' }}</a-button></a-space><span v-else>—</span>
            </a-descriptions-item>
            <a-descriptions-item v-if="hasField('quotation')" label="关联报价单" :span="2"><a-button v-if="snapshot.quotation" @click="quotationOpen = true">{{ snapshot.quotation.candidateName || '查看报价详情' }}</a-button><span v-else>未关联报价单</span></a-descriptions-item>
            <a-descriptions-item v-if="hasField('remark')" label="备注" :span="2">{{ snapshot.remark || '—' }}</a-descriptions-item>
          </a-descriptions>
          <template v-if="hasField('paymentPlan')">
            <h3 class="payback-title">回款计划</h3>
            <a-table :columns="paymentColumns" :data-source="snapshot.paymentPlan || []" :pagination="false" :row-key="(_row, index) => index" :scroll="{ x: 700 }" bordered size="middle" />
          </template>
        </a-card>
        <a-card v-if="currentBusinessActions?.canWithdraw || currentBusinessActions?.canResubmit" title="申请操作">
          <template v-if="currentBusinessActions?.canWithdraw">
            <a-textarea v-model:value="withdrawComment" :disabled="busy || !!withdrawal" :maxlength="1000" placeholder="请填写撤回原因（必填）" />
            <a-button class="task-actions" danger :loading="busy" :disabled="loading || !!pending || !!withdrawal" @click="withdraw">撤回</a-button>
          </template>
          <a-button v-if="currentBusinessActions?.canResubmit" type="primary" :disabled="busy || loading || !!pending || !!withdrawal" @click="resubmit">修改重提</a-button>
        </a-card>

        <a-card v-if="allowedTasks.length" title="办理审批">
          <a-textarea v-model:value="comment" :disabled="busy || !!pending" :maxlength="1000" placeholder="填写审批意见，驳回时必填" />
          <a-space v-for="task in allowedTasks" :key="task.taskId" class="task-actions"><span>{{ instance.tasks.find(t => t.id === task.taskId)?.name }}</span>
            <a-button v-for="action in task.actions.filter(a => ['APPROVE','REJECT'].includes(a))" :key="action" :type="action === 'APPROVE' ? 'primary' : 'default'" :danger="action === 'REJECT'" :disabled="busy || loading || !!error || !!pending || !!withdrawal" @click="submit(task.taskId, action)">{{ action === 'APPROVE' ? '同意' : '驳回' }}</a-button>
          </a-space>
        </a-card>
        <a-alert v-else type="info" message="当前没有可办理的审批任务，页面仅供查看。" />
        <a-alert v-if="actionError" type="error" :message="actionError"><template #action><a-button v-if="pending" :loading="busy" @click="retry">重试同一请求</a-button><a-button v-if="withdrawal" :loading="busy" @click="withdraw">重试撤回</a-button></template></a-alert>
        <a-alert v-if="todoError" type="warning" message="审批已成功，待办计数刷新失败，可稍后刷新首页。" />
      </template>
    </a-spin>
    <a-drawer :open="recordsOpen" title="审批记录" width="min(640px, 96vw)" @close="recordsOpen = false">
      <template v-if="instance"><a-descriptions :column="1" bordered size="small"><a-descriptions-item label="审批流程">{{ instance.processName || '未命名流程' }}</a-descriptions-item><a-descriptions-item label="流程版本">V{{ instance.version }}</a-descriptions-item></a-descriptions><ApprovalProgress :instance="instance" /></template>
    </a-drawer>
    <a-drawer :open="quotationOpen" title="关联报价单" width="min(1000px, 96vw)" @close="quotationOpen = false"><SubmittedValue v-if="quotationOpen" :value="snapshot.quotation" /></a-drawer>
  </div>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { instanceDetail, instanceActions, handleInstance } from '/@/views/workflow/Workflow.api';
import type { WorkflowInstance, InstanceActions } from '/@/views/workflow/workflow.types';
import { newId, statusLabels } from '/@/views/workflow/workflow';
import ApprovalProgress from '/@/views/workflow/components/ApprovalProgress.vue';
import { refreshTodos } from '/@/views/todo/useTodoCenter';
import { downloadByData } from '/@/utils/file/download';
import { contractApprovalActions, withdrawContractApproval, contractApprovalDetail, contractApprovalAttachment, visibleSubmitted, assertContractApprovalIdentity } from './approval.api';
import type { ContractApprovalDetail, ContractApprovalActions } from './approval.api';
import SubmittedValue from './SubmittedValue.vue';
import { getDictItemsByCode } from '/@/utils/dict';
const emit = defineEmits<{ (event: 'resubmit', periodId: string, contractId: string): void }>();
const props = defineProps<{ instanceId: string; contractId?: string; periodId?: string }>();
const instance = ref<WorkflowInstance>(), business = ref<ContractApprovalDetail>(), actions = ref<InstanceActions>();
const loading = ref(false), busy = ref(false), error = ref(''), actionError = ref(''), comment = ref(''), downloading = ref(''), todoError = ref(false);
const pending = ref<Parameters<typeof handleInstance>[0]>();
const capabilityError = ref('');
const businessActions = ref<ContractApprovalActions | null>();
const withdrawComment = ref('');
const withdrawal = ref<Parameters<typeof withdrawContractApproval>[0]>();
const currentBusinessActions = computed(() => businessActions.value?.instanceId === props.instanceId ? businessActions.value : undefined);
async function resubmit() {
  if (busy.value || pending.value || withdrawal.value || !currentBusinessActions.value?.canResubmit) return;
  const period = String(snapshot.value.periodId || props.periodId || '');
  if (!period) { actionError.value = '当前资料缺少分期编号，请从项目列表的合同信息进入修改重提'; return; }
  emit('resubmit', period, business.value!.businessId);
}
async function withdraw() {
  if (busy.value || pending.value || loading.value || error.value) return;
  if (!withdrawal.value) {
    if (!currentBusinessActions.value?.canWithdraw) return;
    if (!withdrawComment.value.trim()) { actionError.value = '请填写撤回原因'; return; }
    withdrawal.value = { contractId: business.value!.businessId, requestId: crypto.randomUUID(), comment: withdrawComment.value.trim() };
  }
  busy.value = true; actionError.value = ''; todoError.value = false;
  try {
    await withdrawContractApproval({ ...withdrawal.value });
    withdrawal.value = undefined; withdrawComment.value = '';
    await load();
    try { await refreshTodos(true); } catch { todoError.value = true; }
  } catch (e) { actionError.value = e instanceof Error ? e.message : '撤回失败，请重试'; }
  finally { busy.value = false; }
}
let generation = 0;
const recordsOpen = ref(false), quotationOpen = ref(false);
const attachments = ['contractAttachments','materialAttachments'];
const labels: Record<string,string> = { contractNo:'合同编号',contractName:'合同名称',contractType:'合同类型',periodId:'分期编号',contractSignedDate:'签订日期',plannedDeliveryDate:'计划交付日期',remark:'备注',salesUserId:'销售负责人编号',salesUserName:'销售负责人',contractAmount:'项目金额',warrantyPeriod:'质保期',projectContext:'项目基本信息（送审时）',quotation:'关联报价单（送审时）',paymentPlan:'回款计划',contractAttachments:'合同附件',materialAttachments:'物料附件' };
const snapshot = computed(() => visibleSubmitted(business.value?.submitted || {}, business.value?.fieldPermissions || {}) as Record<string, any>);
const contractFields = ['contractType', 'contractNo', 'contractName', 'contractSignedDate', 'plannedDeliveryDate', 'contractAmount', 'warrantyPeriod', 'salesUserName'];
const hasField = (key: string) => Object.prototype.hasOwnProperty.call(snapshot.value, key);
const hasProject = (key: string) => Object.prototype.hasOwnProperty.call(snapshot.value.projectContext || {}, key);
function displayField(key: string) {
  const value = snapshot.value[key];
  if (value == null || value === '') return '—';
  if (key === 'contractType') return dictText('contract_type', value);
  return `${value}${key === 'contractAmount' ? ' 元' : key === 'warrantyPeriod' ? ' 月' : ''}`;
}
function dictText(code: string, value: unknown) {
  const item = (getDictItemsByCode(code) || []).find(item => String(item.value) === String(value));
  return item?.text || item?.label || (value == null || value === '' ? '—' : String(value));
}
const paymentColumns = [
  { title: '序号', key: 'index', width: 70, customRender: ({ index }) => index + 1 },
  { title: '回款项', dataIndex: 'paymentNode', customRender: ({ text }) => dictText('payback_node', text) },
  { title: '比例(%)', dataIndex: 'ratio' },
  { title: '回款周期', dataIndex: 'rollbackTime', customRender: ({ text }) => text == null ? '—' : `${text} 天` },
  { title: '回款金额', dataIndex: 'plannedAmount', customRender: ({ text }) => text == null ? '—' : `${text} 元` },
];
const allowedTasks = computed(() => (actions.value?.tasks || []).filter(task => instance.value?.tasks.some(t => t.id === task.taskId && t.canHandle) && task.actions.some(a => ['APPROVE','REJECT'].includes(a))));
async function load() {
  const current = ++generation; loading.value = true; error.value = ''; capabilityError.value = ''; actions.value = undefined; businessActions.value = undefined; instance.value = undefined; business.value = undefined;
  try {
    const [data, workflow, permitted] = await Promise.all([contractApprovalDetail(props.instanceId),instanceDetail(props.instanceId),instanceActions(props.instanceId)]);
    if (current !== generation) return;
    assertContractApprovalIdentity(data, workflow, props.instanceId, props.contractId);
    business.value = data; instance.value = workflow; actions.value = permitted;
    try {
      const capabilities = await contractApprovalActions(data.businessId);
      if (current !== generation) return;
      if (!capabilities) throw new Error('合同审批动作与当前实例不一致，请刷新页面');
      businessActions.value = capabilities;
    } catch (e) {
      if (current === generation) capabilityError.value = `撤回及修改重提权限读取失败，暂不可操作：${e instanceof Error ? e.message : '请稍后重试'}`;
    }
  } catch(e) { if (current === generation) error.value = e instanceof Error ? e.message : '审批资料读取失败'; }
  finally { if (current === generation) loading.value = false; }
}
function files(key: string): {id:string;fileName?:string}[] { return Array.isArray(snapshot.value[key]) ? snapshot.value[key].filter(file => file && typeof file.id === 'string') : []; }
async function download(file: {id:string;fileName?:string}) {
  if (downloading.value) return;
  downloading.value = file.id;
  try { downloadByData(await contractApprovalAttachment(props.instanceId,file.id),file.fileName || '合同附件'); }
  catch(e) { actionError.value = e instanceof Error ? e.message : '附件下载失败'; }
  finally { downloading.value = ''; }
}
async function submit(taskId: string, action: string) {
  if (busy.value || pending.value || withdrawal.value || loading.value || error.value || !allowedTasks.value.some(t => t.taskId === taskId && t.actions.includes(action))) return;
  if (action !== 'APPROVE' && action !== 'REJECT') return;
  if (action === 'REJECT' && !comment.value.trim()) { actionError.value = '请填写驳回意见'; return; }
  pending.value = {instanceId:props.instanceId,taskId,action,requestId:newId('action'),comment:comment.value.trim() || '同意'};
  await retry();
}
async function retry() {
  if (busy.value || !pending.value) return;
  busy.value = true; actionError.value = ''; todoError.value = false;
  try {
    await handleInstance({...pending.value}); pending.value = undefined; comment.value = '';
    await load();
    try { await refreshTodos(true); } catch { todoError.value = true; }
  } catch(e) { actionError.value = e instanceof Error ? e.message : '办理失败，请重试'; }
  finally { busy.value = false; }
}
watch(() => [props.instanceId,props.contractId], () => { pending.value = undefined; comment.value = ''; actionError.value = ''; void load(); }, {immediate:true});
onBeforeUnmount(() => {++generation;});
</script>
<style scoped>
.contract-approval { padding: 16px; display: flex; flex-direction: column; gap: 16px; }
.contract-approval :deep(.ant-card) { margin-top: 16px; }
.task-actions { margin-top: 16px; }
.payback-title { font-size: 15px; font-weight: 600; margin: 24px 0 12px; }
</style>
