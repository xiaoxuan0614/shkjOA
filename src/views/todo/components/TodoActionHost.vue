<template>
  <MaterialSupplementDrawer @register="registerSupplementDrawer" @success="handleProcessed" />
  <ProjectBasicDrawer @register="registerProjectDrawer" @invitation-processed="handleProcessed" />
  <ApproveModal @register="registerStockApproveModal" @success="handleProcessed" />
  <StockExecuteModal @register="registerStockExecuteModal" @success="handleProcessed" />
  <PlanAuditModal @register="registerPlanAuditModal" @success="handleProcessed" />
  <DelayApprovalModal @register="registerDelayApprovalModal" @success="handleProcessed" />
  <AcceptanceModal @register="registerAcceptanceModal" @success="handleProcessed" />
  <a-modal v-model:open="failureOpen" title="验收驳回提醒" :footer="null">
    <a-spin :spinning="failureLoading">
      <a-alert v-if="failureError" type="error" :message="failureError" />
      <a-descriptions v-else :column="1" bordered>
        <a-descriptions-item label="项目名称">{{ failureContext.name || '—' }}</a-descriptions-item>
        <a-descriptions-item label="验收类型">{{ failureRecord.acceptType === 'INTERNAL' ? '内部验收' : failureRecord.acceptType === 'CUSTOMER' ? '外部验收' : '—' }}</a-descriptions-item>
        <a-descriptions-item label="验收结果">{{ failureRecord.result === 'FAILED' ? '不通过' : '状态已变化，请查看最新验收' }}</a-descriptions-item>
        <a-descriptions-item label="验收负责人">{{ failureRecord.acceptLeaderName || '—' }}</a-descriptions-item>
        <a-descriptions-item label="验收日期">{{ failureRecord.acceptEndDate || failureRecord.acceptDate || '—' }}</a-descriptions-item>
        <a-descriptions-item label="驳回原因"><span style="white-space: pre-wrap">{{ failureRecord.remark || '—' }}</span></a-descriptions-item>
      </a-descriptions>
    </a-spin>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
      <a-button @click="failureOpen = false">确认</a-button>
      <a-button type="primary" :disabled="failureLoading || !!failureError || failureRecord.result !== 'FAILED' || !hasPermission('project:acceptance:submit')" @click="requestRecheck">申请复验</a-button>
    </div>
  </a-modal>
</template>

<script lang="ts" setup>
  import { ref } from 'vue';
  import { usePermission } from '/@/hooks/web/usePermission';
  import AcceptanceModal from '/@/views/project/components/AcceptanceModal.vue';
  import { getAcceptanceById } from '/@/views/project/detail/ProjectDetail.api';
  import ApproveModal from '/@/views/material/record/components/ApproveModal.vue';
  import StockExecuteModal from '/@/views/material/record/components/StockExecuteModal.vue';
  import { queryById } from '/@/views/material/record/StockApply.api';
  import { useStockAccess } from '/@/views/material/record/stockAccess';
  import { useRouter } from 'vue-router';
  import { useDrawer } from '/@/components/Drawer';
  import { useModal } from '/@/components/Modal';
  import { useMessage } from '/@/hooks/web/useMessage';
  import MaterialSupplementDrawer from '/@/views/project/components/MaterialSupplementDrawer.vue';
  import ProjectBasicDrawer from '/@/views/project/components/ProjectBasicDrawer.vue';
  import PlanAuditModal from '/@/views/project/components/PlanAuditModal.vue';
  import DelayApprovalModal from '/@/views/project/components/DelayApprovalModal.vue';
  import { parseTodoActionParams, SystemTodo } from '../useTodoCenter';

  const { prepareApprovalAccess, canApprove, canExecute } = useStockAccess();
  const [registerStockApproveModal, { openModal: openStockApproveModal }] = useModal();
  const [registerStockExecuteModal, { openModal: openStockExecuteModal }] = useModal();
  const emit = defineEmits(['processed']);
  const router = useRouter();
  const { createMessage } = useMessage();
  const { hasPermission } = usePermission();
  const [registerAcceptanceModal, { openModal: openAcceptanceModal }] = useModal();
  const failureOpen = ref(false), failureLoading = ref(false), failureError = ref('');
  const failureRecord = ref<Recordable>({}), failureContext = ref<Recordable>({});
  let failureSequence = 0;
  async function openFailure(todo: SystemTodo, periodId: string, acceptanceId: string) {
    const sequence = ++failureSequence;
    failureContext.value = { periodId, name: todo.summary || todo.projectName || todo.title };
    failureRecord.value = {};
    failureError.value = '';
    failureOpen.value = true;
    failureLoading.value = true;
    try {
      const record = await getAcceptanceById(acceptanceId);
      if (sequence !== failureSequence) return;
      if (!record?.id || String(record.periodId) !== periodId) throw new Error('验收记录不存在或不属于当前分期');
      failureRecord.value = record;
    } catch (error: any) {
      if (sequence === failureSequence) failureError.value = error?.message || '验收详情加载失败，请重新打开';
    } finally { if (sequence === failureSequence) failureLoading.value = false; }
  }
  function requestRecheck() {
    if (failureLoading.value || failureError.value || failureRecord.value.result !== 'FAILED' || !hasPermission('project:acceptance:submit')) return;
    failureOpen.value = false;
    openAcceptanceModal(true, { periodId: failureContext.value.periodId, fromTodo: true,
      recheckType: failureRecord.value.acceptType, acceptanceId: failureRecord.value.id });
  }
  const [registerSupplementDrawer, { openDrawer: openSupplementDrawer }] = useDrawer();
  const [registerProjectDrawer, { openDrawer: openProjectDrawer }] = useDrawer();
  const [registerPlanAuditModal, { openModal: openPlanAuditModal }] = useModal();
  const [registerDelayApprovalModal, { openModal: openDelayApprovalModal }] = useModal();

  function resolvePeriodId(todo: SystemTodo, params: Recordable) {
    return String(params.periodId || params.projectPeriodId || todo.bizSubId || todo.periodId || '');
  }

  function matchesTodo(todo: SystemTodo, pattern: RegExp) {
    return pattern.test([todo.todoType, todo.actionKey, todo.title].filter(Boolean).join('|'));
  }

  function openPlanApproval(periodId: string, approvalId = '') {
    if (!periodId) {
      createMessage.error('计划审批待办缺少项目分期 ID，无法打开');
      return;
    }
    openPlanAuditModal(true, { periodId, approvalId });
  }

  async function openTodo(todo: SystemTodo) {
    if ([todo.todoType, todo.actionKey].includes('PROJECT_DELAY_APPROVAL')) {
      openDelayApprovalModal(true, { id: todo.bizId, projectName: todo.projectName, periodName: todo.periodName });
      return;
    }
    const params = parseTodoActionParams(todo.actionParams);
    if ([todo.todoType, todo.actionKey].includes('PROJECT_ADD_MATERIAL_APPLY_APPROVAL')) {
      const applyId = String(params.applyId || todo.bizId || '');
      if (!applyId) return createMessage.error('补料审批待办缺少申请单 ID');
      openSupplementDrawer(true, {
        targetBizId: applyId,
        targetOnly: true,
        periodId: params.periodId || todo.periodId,
        projectName: params.projectName || todo.projectName,
        periodName: params.periodName || todo.periodName,
        allowCreate: false,
      });
      return;
    }
    const periodId = resolvePeriodId(todo, params);
    const actionIdentity = [todo.actionKey, todo.todoType].filter(Boolean).join('|');
    const acceptanceKeys = [todo.actionKey, todo.todoType];
    if (acceptanceKeys.some((key) => ['PROJECT_ACCEPTANCE_FAILED', 'PROJECT_ACCEPTANCE_FAILED_HANDLE', 'PROJECT_ACCEPTANCE_PENDING', 'PROJECT_ACCEPTANCE_HANDLE'].includes(key))) {
      if (!periodId) return createMessage.error('验收待办缺少项目分期 ID');
      const failed = acceptanceKeys.some((key) => ['PROJECT_ACCEPTANCE_FAILED', 'PROJECT_ACCEPTANCE_FAILED_HANDLE'].includes(key));
      if (failed) {
        const acceptanceId = String(params.acceptanceId || params.sourceAcceptanceId || todo.bizId || '');
        if (!acceptanceId) return createMessage.error('验收待办缺少验收记录 ID');
        await openFailure(todo, periodId, acceptanceId);
      } else openAcceptanceModal(true, { periodId, fromTodo: true });
      return;
    }
    const stockAction = [todo.actionKey, todo.todoType].find((key) =>
      ['STOCK_IN_APPROVAL', 'STOCK_OUT_APPROVAL', 'STOCK_IN_EXECUTE', 'STOCK_OUT_EXECUTE', 'PROJECT_MATERIAL_APPLY_APPROVAL'].includes(String(key))
    );
    if (stockAction) {
      const applyId = params.applyId || (stockAction === 'PROJECT_MATERIAL_APPLY_APPROVAL' ? todo.bizId : '');
      if (!applyId) return createMessage.error('物料待办缺少申请 ID');
      try {
        const record: any = await queryById({ id: applyId });
        if (!record?.id || String(record.id) !== String(applyId)) return createMessage.error('返回的申请单信息不匹配，请刷新待办');
        const execution = ['STOCK_IN_EXECUTE', 'STOCK_OUT_EXECUTE'].includes(stockAction);
        const expectedType = stockAction.startsWith('STOCK_IN_') ? 'IN' : stockAction.startsWith('STOCK_OUT_') ? 'OUT' : '';
        if (expectedType && record.applyType !== expectedType) return createMessage.error('待办与申请单出入库类型不一致，请刷新待办');
        if (!execution) await prepareApprovalAccess([record]);
        if (!execution && canApprove(record)) openStockApproveModal(true, { record });
        else if (execution && canExecute(record)) openStockExecuteModal(true, { record });
        else createMessage.warning('当前申请状态已变化或您无权办理');
      } catch {
        createMessage.error('物料申请加载失败，请重试');
      }
      return;
    }
    if ([todo.todoType, todo.actionKey].includes('PROJECT_CANDIDATE_APPROVAL')) {
      const candidateId = String(params.candidateId || todo.bizId || '');
      if (!periodId || !candidateId) return createMessage.error('报价审批待办缺少分期或报价 ID');
      router.push({ path: '/plan/material-draft/editor', query: { mode: 'view', audit: '1', periodId, candidateId } });
      return;
    }
    if ([todo.todoType, todo.actionKey].includes('PROJECT_PERIOD_APPROVAL')) {
      // 当前契约明确该类型 bizId 就是分期 ID，其他待办不使用此兜底。
      openPlanApproval(periodId || String(todo.bizId || ''), String(params.approvalId || ''));
      return;
    }
    if (/PROJECT_REWORK|REWORK.*APPROVAL/i.test(actionIdentity) || matchesTodo(todo, /返工审批/i)) {
      if (!periodId) {
        createMessage.error('返工待办缺少项目分期 ID，无法打开办理页面');
        return;
      }
      router.push({ path: `/project/detail/${periodId}`, query: { tab: 'acceptance', reworkId: todo.bizId || params.reworkId } });
      return;
    }
    if (/PROJECT_(INTERNAL|EXTERNAL|CUSTOMER)_ACCEPTANCE|ACCEPTANCE/i.test(actionIdentity) || matchesTodo(todo, /内部验收|外部验收|客户验收/i)) {
      if (!periodId) {
        createMessage.error('验收待办缺少项目分期 ID，无法打开办理页面');
        return;
      }
      const identity = actionIdentity.toUpperCase();
      const acceptType = String(params.acceptType || (identity.includes('INTERNAL') ? 'INTERNAL' : 'CUSTOMER')).toUpperCase();
      router.push({
        path: `/project/detail/${periodId}`,
        query: {
          tab: 'acceptance',
          acceptType,
          ...(params.reworkId ? { reworkId: String(params.reworkId) } : {}),
        },
      });
      return;
    }
    if (/MATERIAL.*APPLY|MATERIAL_APPLY/i.test(actionIdentity) || matchesTodo(todo, /补料/i)) {
      openSupplementDrawer(true, {
        record: todo,
        periodId,
        targetBizId: todo.bizId,
        projectName: params.projectName || todo.title,
        periodName: params.periodName,
        initialTab: 'pending',
        allowCreate: false,
      });
      return;
    }
    if (/MEMBER.*INVIT|PROJECT_MEMBER/i.test(actionIdentity) || matchesTodo(todo, /成员邀请/i)) {
      openProjectDrawer(true, {
        record: { ...params, periodId },
        invitation: { ...params, id: todo.bizId || params.memberId, periodId },
      });
      return;
    }
    if (/CONTRACT/i.test(actionIdentity) || matchesTodo(todo, /合同审批/i)) {
      router.push({ path: '/project/contract', query: { mode: 'view', periodId, projectId: params.projectId } });
      return;
    }
    if (/PLAN.*APPROVAL/i.test(actionIdentity) || matchesTodo(todo, /计划审批/i)) {
      openPlanApproval(periodId);
      return;
    }
    const targetPath = params.path || params.routePath || params.url;
    if (targetPath && String(targetPath).startsWith('/')) {
      router.push(String(targetPath));
      return;
    }
    createMessage.warning(`待办“${todo.title || todo.todoType || '未命名'}”暂未配置办理页面`);
  }

  function handleProcessed() {
    emit('processed');
  }

  defineExpose({ openTodo });
</script>
