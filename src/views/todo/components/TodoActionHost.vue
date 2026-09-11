<template>
  <MaterialSupplementDrawer @register="registerSupplementDrawer" @success="handleProcessed" />
  <ProjectBasicDrawer @register="registerProjectDrawer" @invitation-processed="handleProcessed" />
  <ApproveModal @register="registerStockApproveModal" @success="handleProcessed" />
  <StockExecuteModal @register="registerStockExecuteModal" @success="handleProcessed" />
  <PlanAuditModal @register="registerPlanAuditModal" @success="handleProcessed" />
  <DelayApprovalModal @register="registerDelayApprovalModal" @success="handleProcessed" />
</template>

<script lang="ts" setup>
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

  const { canApprove, canExecute } = useStockAccess();
  const [registerStockApproveModal, { openModal: openStockApproveModal }] = useModal();
  const [registerStockExecuteModal, { openModal: openStockExecuteModal }] = useModal();
  const emit = defineEmits(['processed']);
  const router = useRouter();
  const { createMessage } = useMessage();
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

  function openPlanApproval(periodId: string) {
    if (!periodId) {
      createMessage.error('计划审批待办缺少项目分期 ID，无法打开');
      return;
    }
    openPlanAuditModal(true, { periodId });
  }

  async function openTodo(todo: SystemTodo) {
    if ([todo.todoType, todo.actionKey].includes('PROJECT_DELAY_APPROVAL')) {
      openDelayApprovalModal(true, { id: todo.bizId, projectName: todo.projectName, periodName: todo.periodName });
      return;
    }
    const params = parseTodoActionParams(todo.actionParams);
    const periodId = resolvePeriodId(todo, params);
    const actionIdentity = [todo.actionKey, todo.todoType].filter(Boolean).join('|');
    const stockAction = [todo.actionKey, todo.todoType].find((key) => ['STOCK_OUT_APPROVAL', 'STOCK_OUT_EXECUTE'].includes(String(key)));
    if (stockAction) {
      if (!params.applyId) return createMessage.error('出库待办缺少申请 ID');
      try {
        const record: any = await queryById({ id: params.applyId });
        if (stockAction === 'STOCK_OUT_APPROVAL' && canApprove(record)) openStockApproveModal(true, { record });
        else if (stockAction === 'STOCK_OUT_EXECUTE' && canExecute(record)) openStockExecuteModal(true, { record });
        else createMessage.warning('当前申请状态已变化或您无权办理');
      } catch {
        createMessage.error('出库申请加载失败，请重试');
      }
      return;
    }
    if ([todo.todoType, todo.actionKey].includes('PROJECT_PERIOD_APPROVAL')) {
      // 当前契约明确该类型 bizId 就是分期 ID，其他待办不使用此兜底。
      openPlanApproval(periodId || String(todo.bizId || ''));
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
