<template>
  <RepairAssignmentModal ref="repairAssignment" @processed="emit('processed')" />
  <a-drawer
    :open="open"
    :title="isRepairCompletion ? '维修完结审批' : '审批详情'"
    width="min(900px, 96vw)"
    :mask-closable="!busy && !uploading && !(isRepairApproval && pendingRequest)"
    :closable="!busy && !uploading && !(isRepairApproval && pendingRequest)"
    @close="emit('close')"
  >
    <a-alert v-if="error" type="error" :message="error" show-icon
      ><template #action><a-button size="small" :disabled="loading || busy" @click="load()">重新读取</a-button></template></a-alert
    >
    <a-alert v-if="assignmentError" type="warning" :message="assignmentError"><template #action><a-button @click="continueAssignment">继续指定人员</a-button></template></a-alert>
    <a-spin :spinning="loading">
      <template v-if="detail">
        <a-descriptions bordered :column="2"
          ><a-descriptions-item label="申请编号">{{ detail.businessId }}</a-descriptions-item
          ><a-descriptions-item label="状态">{{ statusLabels[detail.status] || detail.status }}</a-descriptions-item
          ><a-descriptions-item label="流程">{{ processName(detail) }}</a-descriptions-item
          ><a-descriptions-item label="流程版本">V{{ detail.version }}</a-descriptions-item
          ><a-descriptions-item label="申请轮次"
            >第 {{ detail.roundNo }} 轮 · {{ roundLabel(detail.latestRound) }}</a-descriptions-item
          ></a-descriptions
        >
        <a-alert v-if="metadataError" type="warning" :message="metadataError" show-icon />
        <a-alert v-if="detail.businessType === 'PROJECT_CONTRACT'" type="info" message="合同快照只读；驳回或撤回后，请由原发起人从项目合同页面修改并重新提交。" />
        <a-tabs v-model:active-key="detailTab" class="detail-tabs">
          <a-tab-pane key="application" tab="申请内容">
        <div v-if="isRepairApproval" class="repair-detail-link">
          <a-button type="primary" :disabled="!linkedRepairId || loading || busy || uploading || !!error || !!metadataError" @click="repairDetailId = linkedRepairId">查看维修单详情</a-button>
          <span v-if="!linkedRepairId && !loading" class="hint">未获取到可查看的维修单编号</span>
        </div>
        <section v-if="isInternalCollaboration" class="collaboration-summary" aria-label="受邀部门及协助原因">
          <p v-if="!collaborationDepartments.length" class="hint">暂无可查看的受邀部门及协助原因</p>
          <div v-for="(department, index) in collaborationDepartments" :key="index" class="collaboration-department">
            <strong>{{ department.name }}</strong>
            <p><span class="hint">需要协助原因：</span>{{ department.reason }}</p>
          </div>
        </section>
        <RepairQuotationSnapshot v-if="isRepairQuotation" :visible="visibleSnapshot" :permissions="detail.fieldPermissions" />
        <template v-if="isRepairCompletion">
          <RepairCompletionSnapshot :visible="visibleSnapshot" :fields="fields" :permissions="detail.fieldPermissions" :no-quotation="completionNoQuotation" />
        </template>
        <a-descriptions v-if="!isInternalCollaboration && !isRepairQuotation && !isRepairCompletion" bordered :column="1"
          ><a-descriptions-item
            v-for="row in contentRows"
            :key="row.field.key"
            :label="row.field.name"
            ><BusinessSnapshotValue :field="row.field" :value="row.value" :fields="fields" :permissions="detail.fieldPermissions" :allow-file-preview="detail.businessType === 'PROJECT_CONTRACT'" /></a-descriptions-item
          ></a-descriptions
        >
        <a-empty v-if="!isInternalCollaboration && !isRepairQuotation && !isRepairCompletion && !contentRows.length && !loading && !metadataError" description="暂无可查看的申请内容" />
          </a-tab-pane>
          <a-tab-pane key="progress" tab="审批进程"><ApprovalProgress :instance="detail" compact /></a-tab-pane>
        </a-tabs>
      </template>
    </a-spin>
    <template #footer
      ><div v-if="approvalTasks.length" class="approval-footer">
        <a-select v-if="approvalTasks.length > 1" v-model:value="approvalTaskId" placeholder="请选择本次办理任务" aria-label="选择办理任务" :disabled="busy || loading || actionPreparing" :options="approvalTasks.map(task => ({value: task.id, label: [task.name, task.departmentName].filter(Boolean).join(' · ')}))" />
        <span v-else class="hint">{{ selectedApprovalTask?.name }}</span>
        <a-space wrap>
          <a-button v-for="action in selectedTaskButtons" :key="action.value" :loading="actionPreparing && pendingAction === action.value" :type="action.value === 'APPROVE' ? 'primary' : 'default'" :danger="action.value === 'REJECT'" :disabled="actionPreparing || busy || uploading || loading || !!error || !!metadataError" :title="selectedApprovalTask && taskAction(selectedApprovalTask.id)?.disabledActions?.[action.value]" @click="chooseAction(selectedApprovalTask!.id, action.value)">{{ action.label }}</a-button>
        </a-space>
        <p v-if="selectedApprovalTask && taskAction(selectedApprovalTask.id)?.reason" class="task-reason hint">{{ taskAction(selectedApprovalTask.id)?.reason }}</p>
        <a-alert v-if="!confirmOpen && candidatesError" class="task-reason" type="error" :message="candidatesError + '，请重新点击办理按钮重试。'" show-icon />
      </div><div class="drawer-actions"
        ><a-button @click="load()" :disabled="busy || loading">刷新状态</a-button
        ><a-button v-if="actions?.canWithdraw" danger :disabled="busy || loading || !!error" @click="chooseAction(undefined, 'WITHDRAW')"
          >撤回申请</a-button
        ><a-button :disabled="busy || loading || !!error" @click="openComment">评论</a-button
        ><a-button :disabled="busy || loading || !!error" @click="openPrint">打印</a-button
        ><a-button
          v-if="actions?.canResubmit && detail?.businessType === 'WORKFLOW_FORM'"
          :disabled="busy || loading || !!metadataError"
          @click="chooseAction(undefined, 'RESUBMIT')"
          >修改重提</a-button
        ><a-button :disabled="busy || !!(isRepairApproval && pendingRequest)" @click="emit('close')">关闭</a-button></div
      ></template
    >
    <a-modal
      :open="confirmOpen && !repairDetailId"
      @cancel="confirmOpen = false"
      :title="actionLabels[pendingAction] || pendingAction"
      :confirm-loading="busy"
      :ok-button-props="{
        disabled: uploading || (pendingAction === 'APPROVE' && isInternalCollaboration && (candidatesLoading || !!candidatesError || (mergedApproval && !!reviewCandidates?.departments.some(d => !d.members.length)))) || (pendingAction === 'RETURN' && (!!returnTargetError || !availableReturnOptions.some((o) => o.value === targetNode))),
      }"
      :mask-closable="!busy && !uploading && !(isRepairApproval && pendingRequest)"
      :closable="!busy && !uploading && !(isRepairApproval && pendingRequest)"
      :cancel-button-props="{ disabled: busy || uploading || !!(isRepairApproval && pendingRequest) }"
      ok-text="确认"
      cancel-text="取消"
      @ok="submitAction"
    >
      <a-button v-if="isRepairApproval" :disabled="!linkedRepairId || busy || uploading || !!pendingRequest" style="margin-bottom:16px" @click="repairDetailId = linkedRepairId">查看维修单</a-button>
      <a-config-provider :component-disabled="busy || !!pendingRequest"
        ><a-form layout="vertical">
          <a-form-item v-if="pendingAction === 'RETURN'" label="退回目标" required
            ><a-select v-model:value="targetNode" :disabled="busy || !!pendingRequest" :options="availableReturnOptions"
          /></a-form-item>
          <a-alert v-if="pendingAction === 'RETURN' && returnTargetError" type="warning" :message="returnTargetError" />
          <p v-if="pendingAction === 'RETURN' && targetNode === 'START'">退回发起人会结束本轮，修改重提将创建新轮次。</p>
          <a-form-item v-if="['TRANSFER', 'DELEGATE', 'ADD_SIGN', 'REASSIGN'].includes(pendingAction)" label="接收人员" required
            ><DirectorySelect v-model:value="targetUsers" kind="users"
          /></a-form-item>
          <a-form-item v-if="pendingAction === 'REMOVE_SIGN'" label="减签人员" required
            ><a-select
              v-model:value="targetUsers"
              mode="multiple"
              :options="(taskAction(pendingTask || '')?.removableUserIds || []).map((value) => ({ value, label: participantNames[value] || value }))"
          /></a-form-item>
          <a-form-item v-if="pendingAction === 'COMMENT'" label="提及已有参与者"
            ><a-select
              v-model:value="targetUsers"
              mode="multiple"
              :options="Object.entries(participantNames).map(([value, label]) => ({ value, label }))"
          /></a-form-item>
          <RequestForm
            v-if="['EDIT_DATA', 'RESUBMIT'].includes(pendingAction)"
            :fields="editFields"
            :permissions="editPermissions"
            v-model:value="editData"
            :disabled="busy || !!pendingRequest"
            @uploading="(v) => (uploading = v)" />
          <a-alert
            v-if="pendingAction === 'RESUBMIT' && detail?.businessType !== 'WORKFLOW_FORM'"
            type="warning"
            message="此业务请从原业务页面修改后重新提交。" />
          <template v-if="isInternalCollaboration && ['APPROVE', 'REJECT'].includes(pendingAction)">
            <a-spin v-if="candidatesLoading" />
            <a-alert v-if="candidatesError" type="error" :message="candidatesError" />
            <a-button v-if="candidatesError" :disabled="candidatesLoading" @click="loadReviewCandidates">重新加载</a-button>
            <template v-if="pendingAction === 'APPROVE' && mergedApproval">
              <a-form-item v-for="department in reviewCandidates?.departments || []" :key="department.departmentId" :label="department.departmentName + ' · 指定内协人员'" required>
                <p v-if="department.reason"><span class="hint">需要协助原因：</span>{{ department.reason }}</p>
                <a-alert v-if="!department.members.length" type="warning" message="该部门暂无可选人员，不能直接通过" />
                <a-select v-else v-model:value="reviewChosen[department.departmentId]" mode="multiple" show-search option-filter-prop="label" :options="department.members" placeholder="选择本部门人员（1至20人）" />
              </a-form-item>
            </template>
          </template>
          <a-form-item v-if="isTransferApproval && pendingAction === 'APPROVE'" label="接收人" required>
            <p class="hint">默认使用申请人指定的接收人，可重新选择；审批通过后才变更维修负责人。</p>
            <a-select v-model:value="transferTarget" show-search option-filter-prop="label" :options="transferOptions" placeholder="请选择接收人" />
            <a-alert v-if="!transferOptions.length" type="warning" message="暂无可选接收人，请取消后重新读取" />
          </a-form-item>
          <a-form-item :label="pendingAction === 'REJECT' ? '驳回原因' : '审批意见'" :required="!['APPROVE', 'COMPLETE', 'RESUBMIT'].includes(pendingAction)"
            ><a-textarea
              v-model:value="comment"
              :maxlength="1000"
              :rows="4"
              :disabled="busy || !!pendingRequest" /></a-form-item></a-form></a-config-provider
      ><a-alert v-if="pendingRequest && !busy" type="warning" message="本次提交结果尚未确认，再次确认会使用相同请求重试；请勿重复发起。" /><a-alert
        v-if="actionError"
        type="error"
        :message="actionError"
      />
    </a-modal>
    <InstancePrint :data="printData" :open="printOpen" @close="printOpen = false" />
    <RepairDetail v-if="repairDetailId" :id="repairDetailId" @close="repairDetailId = ''" />
  </a-drawer>
</template>
<script setup lang="ts">
  import RepairAssignmentModal from '/@/views/todo/components/RepairAssignmentModal.vue';
  import { availableRepairAssignments, approvalCandidates, reviewCollaboration } from '/@/views/todo/repairAssignment';
  import { parseApprovalCandidates, approvalAssignments, type ApprovalCandidates } from '/@/views/todo/collaborationApproval';
  import { repairDetail } from '/@/views/operation/repair/repair.api';
  import { useUserStore } from '/@/store/modules/user';
  import RepairQuotationSnapshot from './RepairQuotationSnapshot.vue';
  import RepairCompletionSnapshot from './RepairCompletionSnapshot.vue';
  import BusinessSnapshotValue from './BusinessSnapshotValue.vue';
  import { visibleTaskButtons } from '../taskPresentation';
  import { applicationRows } from '../snapshotPresentation';
  import { repairApplicationDepartments } from '../repairApplicationSummary';
  import { computed, defineAsyncComponent, onBeforeUnmount, ref, watch } from 'vue';
  import { repairApprovalOrderId } from '../repairDetailLink';
  import { transferPeople, transferReviewFields, type TransferPerson } from '/@/views/todo/transferApproval';
  const transferOptions = ref<TransferPerson[]>([]);
  const transferTarget = ref('');
  import { readInitialDetail } from '../instanceInitialDetail';
  const RepairDetail = defineAsyncComponent(() => import('/@/views/operation/repair/RepairDetail.vue'));
  const repairDetailId = ref('');
  const completionNoQuotation = ref(false);
  import {
    commentInstance,
    editInstanceData,
    operateTask,
    printInstance,
    resubmitInstance,
    handleInstance,
    instanceActions,
    instanceDetail,
    instanceForm,
  } from '../Workflow.api';
  import DirectorySelect from './DirectorySelect.vue';
  import RequestForm from './RequestForm.vue';
  import InstancePrint from './InstancePrint.vue';
  import ApprovalProgress from './ApprovalProgress.vue';
  import { processName, roundLabel, returnOptions } from '../instancePresentation';
  import { newId, statusLabels } from '../workflow';
  import type { WorkflowInstance, InstanceActions, FormField } from '../workflow.types';
  const props = defineProps<{ open: boolean; instanceId: string; initialDetail?: WorkflowInstance }>();
  const emit = defineEmits(['close', 'processed', 'resubmitted']);
  const repairAssignment = ref<InstanceType<typeof RepairAssignmentModal>>();
  const assignmentError = ref('');
  const mergedApproval = ref(false), candidatesLoading = ref(false), candidatesError = ref('');
  const actionPreparing = ref(false);
  const reviewCandidates = ref<ApprovalCandidates>();
  const reviewChosen = ref<Record<string, string[]>>({});
  let candidateGeneration = 0;
  let reviewModeResolved = false;
  async function loadReviewCandidates() {
    if (candidatesLoading.value || (!confirmOpen.value && !actionPreparing.value)) return;
    const current = ++candidateGeneration;
    candidatesLoading.value = true; candidatesError.value = ''; reviewCandidates.value = undefined;
    const instance = props.instanceId, taskId = pendingTask.value, applicationId = detail.value?.businessId;
    try {
      if (!applicationId || !taskId || !detail.value?.snapshot?.orderId) throw new Error('缺少审批申请或任务信息，请刷新');
      if (!reviewModeResolved) {
        const fresh = await repairDetail(String(detail.value.snapshot.orderId));
        if (current !== candidateGeneration || !props.open || (!confirmOpen.value && !actionPreparing.value) || instance !== props.instanceId) return;
        const app = fresh.applications?.find((a: any) => a.id === applicationId);
        if (!app) throw new Error('未读取到本次申请，请重新加载');
        mergedApproval.value = app.formData?.assignmentMode === 'WITH_APPROVAL';
        reviewModeResolved = true;
      }
      if (mergedApproval.value) {
        const data = await approvalCandidates(applicationId, taskId);
        if (current !== candidateGeneration || !props.open || (!confirmOpen.value && !actionPreparing.value) || instance !== props.instanceId) return;
        reviewCandidates.value = parseApprovalCandidates(data, taskId);
      }
    } catch (e: any) { if (current === candidateGeneration) candidatesError.value = e.message || '候选人员读取失败'; }
    finally { if (current === candidateGeneration) candidatesLoading.value = false; }
  }

  let assignmentContext: { orderId: string; applicationId: string; instanceId: string } | undefined;
  async function continueAssignment() {
    const context = assignmentContext;
    if (!context) return;
    assignmentError.value = '';
    try {
      if (!context.orderId) throw new Error('审批已通过，但未返回维修单编号，请从指定人员待办继续');
      const fresh = await repairDetail(context.orderId);
      if (!props.open || props.instanceId !== context.instanceId) return;
      repairAssignment.value?.openMany(availableRepairAssignments(fresh, context.applicationId, String(useUserStore().getUserInfo.id || '')));
    } catch (e: any) { if (props.instanceId === context.instanceId) assignmentError.value = `审批已通过，无需重复审批。${e.message || '人员信息读取失败'}`; }
  }
  const detail = ref<WorkflowInstance>(),
    actions = ref<InstanceActions>(),
    error = ref(''),
    loading = ref(false),
    busy = ref(false),
    confirmOpen = ref(false),
    comment = ref(''),
    actionError = ref('');
  watch(confirmOpen, (open) => {
    if (!open) {
      candidateGeneration++;
      candidatesLoading.value = false;
      reviewModeResolved = false;
    }
  }, { flush: 'sync' });
  const fields = ref<FormField[]>([]);
  const metadataError = ref('');
  const pendingRequest = ref<Record<string, any>>();
  const pendingAction = ref('APPROVE');
  const targetNode = ref(''),
    targetUsers = ref<string[]>([]),
    editData = ref<Record<string, any>>({}),
    uploading = ref(false);
  const printOpen = ref(false),
    printData = ref<Awaited<ReturnType<typeof printInstance>>>();
  const participantNames = computed(() => {
    const names: Record<string, string> = {};
    if (detail.value?.initiatorId) names[detail.value.initiatorId] = '发起人';
    for (const item of detail.value?.history || []) if (item.actor_id) names[item.actor_id] = item.actor_name || item.actor_id;
    return names;
  });
  const editFields = computed(() =>
    pendingAction.value === 'EDIT_DATA'
      ? fields.value.filter((f) => taskAction(pendingTask.value || '')?.editableFields?.includes(f.key))
      : fields.value
  );
  const editPermissions = computed(() =>
    pendingAction.value === 'EDIT_DATA'
      ? Object.fromEntries(editFields.value.map((f) => [f.key, 'EDITABLE' as const]))
      : detail.value?.fieldPermissions || {}
  );

  const pendingTask = ref<string>();
  let requestId = '',
    generation = 0;
  const taskButtons = [
    { value: 'APPROVE' as const, label: '同意' },
    { value: 'REJECT' as const, label: '驳回' },
    ...Object.entries({
      COMPLETE: '完成任务',
      RETURN: '退回',
      TRANSFER: '转办',
      DELEGATE: '委托',
      RESOLVE: '完成委托',
      ADD_SIGN: '加签',
      REMOVE_SIGN: '减签',
      REASSIGN: '改派',
      EDIT_DATA: '修改表单',
    }).map(([value, label]) => ({ value, label })),
  ];
  const actionLabels: Record<string, string> = {
    APPROVE: '同意',
    REJECT: '驳回',
    WITHDRAW: '撤回',
    START: '发起',
    SUBMIT: '提交',
    COMPLETE: '完成任务',
    RETURN: '退回',
    TRANSFER: '转办',
    DELEGATE: '委托',
    RESOLVE: '完成委托',
    ADD_SIGN: '加签',
    REMOVE_SIGN: '减签',
    REASSIGN: '改派',
    EDIT_DATA: '修改表单',
    RESUBMIT: '修改并重新提交',
    COMMENT: '评论',
    AUTO_APPROVE: '自动通过',
    APPROVAL_REUSED: '已通过（复用一级审批结果）',
  };
  // Resolve metadata paths against nested data, never expose extra snapshot keys.
  function fieldValue(data: unknown, path: string): unknown {
    const [head, ...tail] = path.split('.');
    const array = head.endsWith('[]');
    const key = array ? head.slice(0, -2) : head;
    if (!data || typeof data !== 'object' || !Object.prototype.hasOwnProperty.call(data, key)) return undefined;
    const value = (data as Record<string, unknown>)[key];
    if (array) return Array.isArray(value) ? value.map((item) => (tail.length ? fieldValue(item, tail.join('.')) : item)) : undefined;
    return tail.length ? fieldValue(value, tail.join('.')) : value;
  }
  const visibleSnapshot = computed(() =>
    Object.fromEntries(
      fields.value
        .filter((field) => detail.value?.fieldPermissions?.[field.key] !== 'HIDDEN')
        .map((field) => [field.key, fieldValue(detail.value?.snapshot, field.key)])
    )
  );
  const isRepairQuotation = computed(() => detail.value?.businessType === 'REPAIR_OPS_APPLICATION' && detail.value?.processKey === 'repair_ops_quotation');
  const isRepairCompletion = computed(() => detail.value?.businessType === 'REPAIR_OPS_APPLICATION' && detail.value?.processKey === 'repair_ops_completion');
  const isInternalCollaboration = computed(() => detail.value?.businessType === 'REPAIR_OPS_APPLICATION' && detail.value?.processKey === 'repair_ops_collaboration');
  const isTransferApproval = computed(() => detail.value?.businessType === 'REPAIR_OPS_APPLICATION' && detail.value?.processKey === 'repair_ops_transfer');
  const requestedTransferTarget = computed(() => {
    // Use the ID projection, not the presentation row which may contain a person's name.
    const value = visibleSnapshot.value['form.targetUserId'];
    return typeof value === 'string' ? value : '';
  });
  const isRepairApproval = computed(() => detail.value?.businessType === 'REPAIR_OPS_APPLICATION');
  const linkedRepairId = computed(() => repairApprovalOrderId(detail.value, visibleSnapshot.value));
  watch(() => [props.open, props.instanceId, linkedRepairId.value], () => { repairDetailId.value = ''; });
  const contentRows = computed(() => applicationRows(visibleSnapshot.value, fields.value, detail.value?.fieldPermissions || {},
    detail.value?.businessType === 'REPAIR_OPS_APPLICATION' ? detail.value.processKey : undefined));
  const taskAction = (id: string) => actions.value?.tasks?.find((t) => t.taskId === id);
  const detailTab = ref('application');
  const approvalTaskId = ref<string>();
  function buttonsForTask(task: WorkflowInstance['tasks'][number]) {
    return visibleTaskButtons(taskButtons, task, taskAction(task.id), detail.value?.businessType);
  }
  const approvalTasks = computed(() => (detail.value?.tasks || []).filter(task => buttonsForTask(task).length));
  const selectedApprovalTask = computed(() => approvalTasks.value.find(task => task.id === approvalTaskId.value));
  const selectedTaskButtons = computed(() => selectedApprovalTask.value ? buttonsForTask(selectedApprovalTask.value) : []);
  watch(approvalTasks, tasks => {
    if (!tasks.some(task => task.id === approvalTaskId.value)) approvalTaskId.value = tasks.length === 1 ? tasks[0].id : undefined;
  });
  watch(() => [props.instanceId, props.open], () => { detailTab.value = 'application'; approvalTaskId.value = undefined; });
  const collaborationDepartments = computed(() => repairApplicationDepartments(visibleSnapshot.value));
  async function load(initial?: WorkflowInstance) {
    if (!props.open || !props.instanceId || busy.value || actionPreparing.value) return;
    const current = ++generation;
    loading.value = true;
    completionNoQuotation.value = false;
    error.value = '';
    actions.value = undefined;
    fields.value = [];
    metadataError.value = '';
    try {
      const [data, allowed] = await Promise.all([readInitialDetail(props.instanceId, initial, instanceDetail), instanceActions(props.instanceId)]);
      if (current !== generation) return;
      detail.value = data;
      actions.value = allowed;
      if (data.businessType === 'REPAIR_OPS_APPLICATION' && data.processKey === 'repair_ops_completion' && data.snapshot?.orderId) {
        const repair = await repairDetail(String(data.snapshot.orderId));
        if (current !== generation) return;
        completionNoQuotation.value = repair.order?.quotationRequired === false;
      }
      try {
        const schema = await instanceForm(props.instanceId);
        if (current !== generation) return;
        if (schema.instanceId !== data.id || schema.processKey !== data.processKey || schema.version !== data.version) throw new Error('版本不一致');
        fields.value = schema.fields;
        detail.value.fieldPermissions = schema.fieldPermissions;
        if (data.businessType !== 'PROJECT_CONTRACT' && schema.fields.some((field) => field.type === 'attachment' && fieldValue(data.snapshot, field.key)))
          metadataError.value = '本申请包含附件，本版暂不能查看附件，已暂停办理，请使用支持附件的入口核对后处理。';
      } catch {
        if (current === generation)
          metadataError.value = '实例表单加载失败，已暂停办理。请重新读取；若持续失败，请确认后端已加载 instance/form 新接口。';
      }
    } catch (e) {
      if (current === generation) {
        error.value = (e as Error).message;
        detail.value = undefined;
      }
    } finally {
      if (current === generation) loading.value = false;
    }
  }
  const availableReturnOptions = computed(() => returnOptions(taskAction(pendingTask.value || '')));
  const returnTargetError = computed(() => {
    const task = taskAction(pendingTask.value || '');
    if (!task?.actions?.includes('RETURN')) return '当前任务不允许退回，请刷新状态';
    if (!Array.isArray(task.returnTargetOptions)) return '退回目标信息暂不可用，请刷新后重试';
    return availableReturnOptions.value.length ? '' : '当前没有可选退回目标';
  });
  watch(availableReturnOptions, (options) => {
    if (!options.some((o) => o.value === targetNode.value)) targetNode.value = '';
  });
  async function chooseAction(taskId: string | undefined, action: string) {
    if (busy.value || loading.value || confirmOpen.value || actionPreparing.value) return;
    if (action === 'RETURN') {
      const current = generation;
      busy.value = true;
      error.value = '';
      try {
        const fresh = await instanceActions(props.instanceId);
        if (current !== generation) return;
        actions.value = fresh;
      } catch (e) {
        if (current === generation) {
          actions.value = undefined;
          error.value = (e as Error).message;
        }
        return;
      } finally {
        busy.value = false;
      }
    }
    pendingTask.value = taskId;
    targetNode.value = '';
    targetUsers.value = [];
    editData.value = JSON.parse(JSON.stringify(detail.value?.snapshot || {}));
    pendingAction.value = action;
    comment.value = '';
    actionError.value = '';
    requestId = newId('action');
    pendingRequest.value = undefined;
    candidateGeneration++;
    candidatesLoading.value = false;
    reviewModeResolved = false;
    mergedApproval.value = false; reviewChosen.value = {}; reviewCandidates.value = undefined; candidatesError.value = '';
    transferOptions.value = []; transferTarget.value = '';
    if ((isInternalCollaboration.value && ['APPROVE', 'REJECT'].includes(action)) || (isTransferApproval.value && action === 'APPROVE')) {
      const openingGeneration = generation;
      actionPreparing.value = true;
      try {
        if (isTransferApproval.value) {
          const people = await transferPeople();
          if (openingGeneration !== generation || !props.open) return;
          transferOptions.value = people;
          transferTarget.value = people.some(person => person.value === requestedTransferTarget.value) ? requestedTransferTarget.value : '';
        } else await loadReviewCandidates();
        if (openingGeneration !== generation || !props.open || candidatesError.value) return;
        confirmOpen.value = true;
      } catch (e: any) {
        if (openingGeneration === generation) candidatesError.value = e.message || '接收人读取失败';
      } finally {
        if (openingGeneration === generation) actionPreparing.value = false;
      }
    } else confirmOpen.value = true;
  }
  function openComment() {
    chooseAction(undefined, 'COMMENT');
  }
  async function openPrint() {
    if (actionPreparing.value) return;
    error.value = '';
    busy.value = true;
    try {
      const result = await printInstance(props.instanceId);
      if (result.instance.id !== props.instanceId || result.form.instanceId !== props.instanceId || result.form.version !== result.instance.version)
        throw new Error('打印数据版本不一致');
      printData.value = result;
      printOpen.value = true;
    } catch (e) {
      error.value = (e as Error).message;
    } finally {
      busy.value = false;
    }
  }
  async function submitAction() {
    if (busy.value || uploading.value) return;
    const action = pendingAction.value;
    if (!pendingRequest.value && ['APPROVE', 'REJECT', 'COMPLETE'].includes(action) && !detail.value?.tasks.some(task => task.id === pendingTask.value && task.canHandle)) {
      actionError.value = '当前任务不可由你办理，请刷新';
      return;
    }
    if (!pendingRequest.value && pendingTask.value && !taskAction(pendingTask.value)?.actions.includes(action)) {
      actionError.value = '当前任务不允许此操作，请刷新';
      return;
    }
    if (action === 'REMOVE_SIGN' && targetUsers.value.some((id) => !taskAction(pendingTask.value || '')?.removableUserIds?.includes(id))) {
      actionError.value = '请选择可减签人员';
      return;
    }
    if (action === 'COMMENT' && targetUsers.value.length > 100) {
      actionError.value = '最多提及100人';
      return;
    }
    if (!['APPROVE', 'COMPLETE', 'RESUBMIT'].includes(action) && !comment.value.trim()) {
      actionError.value = '请填写意见或原因';
      return;
    }
    if (action === 'RETURN' && (returnTargetError.value || !availableReturnOptions.value.some((o) => o.value === targetNode.value))) {
      actionError.value = '请选择合法退回目标';
      return;
    }
    if (['TRANSFER', 'DELEGATE', 'REASSIGN'].includes(action) && targetUsers.value.length !== 1) {
      actionError.value = '请选择一名接收人员';
      return;
    }
    if (['ADD_SIGN', 'REMOVE_SIGN'].includes(action) && !targetUsers.value.length) {
      actionError.value = '请选择人员';
      return;
    }
    if (['EDIT_DATA', 'RESUBMIT'].includes(action)) {
      if (detail.value?.businessType === 'PROJECT_CONTRACT') {
        actionError.value = '合同字段只读，请由原发起人在合同页面修改重提';
        return;
      }
      if (action === 'RESUBMIT' && detail.value?.businessType !== 'WORKFLOW_FORM') {
        actionError.value = '请从原业务页面重新提交';
        return;
      }
      if (editFields.value.some((f) => !['string', 'number', 'boolean', 'date', 'attachment'].includes(f.type) || /[.\[\]]/.test(f.key))) {
        actionError.value = '此表单含复杂字段，暂不支持在此修改';
        return;
      }
      const missing = editFields.value.find(
        (f) => f.required && editPermissions.value[f.key] !== 'HIDDEN' && (editData.value[f.key] == null || editData.value[f.key] === '')
      );
      if (missing) {
        actionError.value = `请填写${missing.name}`;
        return;
      }
    }
    if (isInternalCollaboration.value && ['APPROVE', 'REJECT'].includes(action) && !pendingRequest.value) {
      if (action === 'APPROVE' && (candidatesLoading.value || candidatesError.value)) { actionError.value = candidatesError.value || '正在读取审批信息'; return; }
      try { if (mergedApproval.value) approvalAssignments(reviewCandidates.value, reviewChosen.value, action === 'APPROVE'); }
      catch (e: any) { actionError.value = e.message; return; }
    }
    if (isRepairApproval.value && ['APPROVE', 'REJECT'].includes(action) && !pendingRequest.value) {
      if (!props.instanceId || !detail.value?.businessId || !pendingTask.value) {
        actionError.value = '缺少维修申请或审批任务信息，请刷新';
        return;
      }
      if (comment.value.trim().length > 1000) {
        actionError.value = '审批意见最多1000字';
        return;
      }
    }
    const submittedInstanceId = props.instanceId;
    if (isTransferApproval.value && ['APPROVE', 'REJECT'].includes(action) && !pendingRequest.value) {
      try {
        if (!detail.value?.businessId || !pendingTask.value) throw new Error('缺少转单申请或审批任务信息，请刷新');
        transferReviewFields(action === 'APPROVE', transferTarget.value, requestedTransferTarget.value, transferOptions.value);
      } catch (e: any) { actionError.value = e.message; return; }
    }
    const nextAssignment = action === 'APPROVE' && !mergedApproval.value && isInternalCollaboration.value && detail.value
      ? { orderId: String(detail.value.snapshot?.orderId || ''), applicationId: detail.value.businessId, instanceId: submittedInstanceId }
      : undefined;
    busy.value = true;
    actionError.value = '';
    try {
      const base = { instanceId: props.instanceId, requestId, comment: comment.value.trim() };
      if (!pendingRequest.value) {
        if (isInternalCollaboration.value && ['APPROVE', 'REJECT'].includes(action)) pendingRequest.value = { ...base, applicationId: detail.value!.businessId, taskId: pendingTask.value, approve: action === 'APPROVE', ...(mergedApproval.value ? approvalAssignments(reviewCandidates.value, reviewChosen.value, action === 'APPROVE') : {}) };
        else if (isTransferApproval.value && ['APPROVE', 'REJECT'].includes(action)) pendingRequest.value = { ...base, applicationId: detail.value!.businessId, taskId: pendingTask.value, approve: action === 'APPROVE', ...transferReviewFields(action === 'APPROVE', transferTarget.value, requestedTransferTarget.value, transferOptions.value) };
        else if (isRepairApproval.value && ['APPROVE', 'REJECT'].includes(action)) pendingRequest.value = { ...base, applicationId: detail.value!.businessId, taskId: pendingTask.value, approve: action === 'APPROVE' };
        else if (['APPROVE', 'REJECT', 'WITHDRAW', 'COMPLETE'].includes(action)) pendingRequest.value = { ...base, taskId: pendingTask.value, action };
        else if (action === 'COMMENT') pendingRequest.value = { ...base, mentionUserIds: [...targetUsers.value] };
        else if (action === 'RESUBMIT')
          pendingRequest.value = { instanceId: props.instanceId, requestId, data: JSON.parse(JSON.stringify(editData.value)) };
        else if (action === 'EDIT_DATA')
          pendingRequest.value = {
            ...base,
            taskId: pendingTask.value,
            data: Object.fromEntries(editFields.value.map((f) => [f.key, editData.value[f.key]])),
          };
        else
          pendingRequest.value = {
            ...base,
            taskId: pendingTask.value,
            operation: action,
            ...(action === 'RETURN' ? { targetNodeKey: targetNode.value } : { userIds: [...targetUsers.value] }),
          };
      }
      const payload = pendingRequest.value;
      if (['APPROVE', 'REJECT', 'WITHDRAW', 'COMPLETE'].includes(action)) {
        if (isRepairApproval.value && ['APPROVE', 'REJECT'].includes(action)) await reviewCollaboration(payload);
        else await handleInstance(payload as Parameters<typeof handleInstance>[0]);
        if (props.instanceId !== submittedInstanceId || !props.open) return;
        if (nextAssignment) assignmentContext = nextAssignment;
      }
      else if (action === 'COMMENT') await commentInstance(payload as Parameters<typeof commentInstance>[0]);
      else if (action === 'RESUBMIT') {
        const result = await resubmitInstance(payload as Parameters<typeof resubmitInstance>[0]);
        emit('resubmitted', result.id);
      } else if (action === 'EDIT_DATA') await editInstanceData(payload as Parameters<typeof editInstanceData>[0]);
      else await operateTask(payload as Parameters<typeof operateTask>[0]);
      pendingRequest.value = undefined;
      confirmOpen.value = false;
      emit('processed');
    } catch (e) {
      if (isRepairApproval.value && (e as any).definite) { pendingRequest.value = undefined; requestId = newId('action'); }
      actionError.value = (e as Error).message;
    } finally {
      busy.value = false;
    }
    if (!confirmOpen.value || action === 'RETURN') await load();
    if (!confirmOpen.value && action === 'APPROVE' && assignmentContext?.instanceId === props.instanceId) await continueAssignment();
  }
  watch(
    () => [props.open, props.instanceId],
    () => {
      generation++; candidateGeneration++; candidatesLoading.value = false; actionPreparing.value = false; candidatesError.value = '';
      detail.value = undefined;
      actions.value = undefined;
      confirmOpen.value = false;
      printOpen.value = false;
      pendingRequest.value = undefined;
      assignmentError.value = ''; assignmentContext = undefined;
      if (props.open) load(props.initialDetail);
    },
    { immediate: true }
  );
  onBeforeUnmount(() => { generation++; candidateGeneration++; });
</script>
<style scoped>
  .repair-detail-link { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-bottom: 16px; }
  .detail-tabs { margin-top: 20px; }
  .approval-footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0 12px; }
  .approval-footer :deep(.ant-select) { width: 300px; max-width: 100%; }
  .collaboration-department { padding: 12px 0; border-bottom: 1px solid var(--border-color-split, #dcdee7); overflow-wrap: anywhere; }
  .collaboration-department:first-child { padding-top: 0; }
  .collaboration-department:last-child { border-bottom: 0; }
  .collaboration-department p { margin: 6px 0 0; white-space: pre-wrap; line-height: 1.7; }
  h2 {
    font-size: 16px;
    margin: 28px 0 16px;
  }
  .task-section {
    padding: 16px 0;
    border-bottom: 1px solid #eee;
  }
  .task-section strong {
    display: block;
    margin-bottom: 12px;
  }
  .hint {
    color: #595959;
    font-size: 12px;
  }
  .snapshot-value {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .drawer-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
  }
  .task-reason { flex-basis: 100%; margin: 0; }
</style>
