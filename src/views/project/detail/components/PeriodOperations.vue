<template>
  <a-card v-if="hasPrimary || actions.length" title="当前分期办理" size="small" class="period-operations">
    <div class="period-operations__toolbar">
      <div class="period-operations__actions">
      <slot />
      <template v-for="action in primaryActions" :key="action.key">
        <a-popconfirm v-if="action.key === 'complete'" title="确认完结当前分期？" @confirm="finish('complete')">
          <a-button preIcon="ant-design:check-circle-outlined" :loading="busy">{{ action.label }}</a-button>
        </a-popconfirm>
        <a-button v-else :preIcon="actionIcons[action.key]" @click="open(action.key)">{{ action.key === 'supplement' ? '申请补料' : action.label }}</a-button>
      </template>
      </div>
      <a-dropdown v-if="moreActions.length" :trigger="['click']">
        <a-button class="period-operations__more" preIcon="ant-design:more-outlined">更多操作</a-button>
        <template #overlay><a-menu><a-menu-item v-for="action in moreActions" :key="action.key" :danger="action.dangerous" @click="action.key === 'close' ? confirmClose() : open(action.key)">{{ action.label }}</a-menu-item></a-menu></template>
      </a-dropdown>
    </div>
  </a-card>
  <ArrivalConfirmModal @register="registerArrival" @success="changed" />
  <ProcessCompletionDrawer @register="registerProcess" @success="changed" />
  <MaterialSupplementDrawer @register="registerSupplement" @success="changed" />
  <ProjectDelayApply v-model:open="delayOpen" :project="project" :allowed="manager" @success="changed" />
</template>
<script setup lang="ts">
  import { computed, ref } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { usePermissionStore } from '/@/store/modules/permission';
  import { projectMaterialOperations } from '../materialOperations';
  import ProjectDelayApply from './ProjectDelayApply.vue';
  import { useModal } from '/@/components/Modal';
  import { useDrawer } from '/@/components/Drawer';
  import { usePermission } from '/@/hooks/web/usePermission';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { projectDetail, changePeriodStatus } from '../../Project.api';
  import { refreshTodos } from '/@/views/todo/useTodoCenter';
  import { canApplySupplement, resolvePeriodOperations } from '../periodOperations';
  import ArrivalConfirmModal from '../../components/ArrivalConfirmModal.vue';
  import ProcessCompletionDrawer from '../../components/ProcessCompletionDrawer.vue';
  import MaterialSupplementDrawer from '../../components/MaterialSupplementDrawer.vue';
  const props = defineProps<{ project: Record<string, any>; manager: boolean; participant: boolean; materialVisible: boolean; typeNames: Record<string, string>; hasPrimary: boolean; acceptanceVisible: boolean }>();
  const emit = defineEmits(['changed', 'acceptance', 'material']);
  const router = useRouter(), route = useRoute(), permissions = usePermissionStore();
  const delayOpen = ref(false);
  const { hasPermission } = usePermission();
  const { createMessage, createConfirm } = useMessage();
  const busy = ref(false);
  const actionIcons: Record<string, string> = {
    arrival: 'ant-design:inbox-outlined',
    process: 'ant-design:solution-outlined',
    supplement: 'ant-design:appstore-add-outlined',
    acceptance: 'ant-design:check-square-outlined',
    pick: 'ant-design:export-outlined',
    return: 'ant-design:import-outlined',
  };
  const actions = computed(() => {
    const result = resolvePeriodOperations(props.project, { manager: props.manager, typeNames: props.typeNames, hasPermission })
      .filter(action => action.key !== 'acceptance' || props.acceptanceVisible);
    result.push(...projectMaterialOperations(props.project, props.participant, permissions.getBackMenuList));
    if (props.materialVisible) result.push({ key: 'material', label: '用料记录' });
    if (props.manager && ['IMPLEMENTING', 'DEBUGGING', 'DEBUG_COMPLETED', 'REWORKING'].includes(props.project.status)) result.push({ key: 'delay', label: '申请延期' });
    return result;
  });
  function isMoreAction(item: { key: string; dangerous?: boolean }) {
    return !!item.dangerous || ['material', 'delay'].includes(item.key) ||
      (item.key === 'supplement' && !canApplySupplement(props.project.status, props.manager));
  }
  const primaryActions = computed(() => actions.value.filter(item => !isMoreAction(item)));
  const moreActions = computed(() => actions.value.filter(isMoreAction));
  const [registerArrival, { openModal: openArrival }] = useModal();
  const [registerProcess, { openDrawer: openProcess }] = useDrawer();
  const [registerSupplement, { openDrawer: openSupplement }] = useDrawer();
  function open(key: string) {
    if (!actions.value.some(action => action.key === key)) return;
    const record = props.project;
    if (key === 'arrival') openArrival(true, { record });
    if (key === 'process') openProcess(true, { record, periodId: record.periodId });
    if (key === 'supplement') openSupplement(true, { record, allowCreate: canApplySupplement(record.status, props.manager), initialTab: props.manager ? 'mine' : 'pending' });
    if (key === 'acceptance') emit('acceptance');
    if (key === 'material') emit('material');
    if (key === 'delay') delayOpen.value = true;
    if (key === 'pick' || key === 'return') void router.push({ path: `/material/${key}`, query: { periodId: String(record.periodId), from: route.fullPath,
      ...(key === 'pick' && record.status === 'REWORKING' && record.currentReworkId ? { reworkId: String(record.currentReworkId) } : {}) } });
  }
  function confirmClose() {
    const id = String(props.project.periodId);
    createConfirm({ iconType: 'warning', title: '关闭项目', content: '关闭后未完成的项目领料会同步终止，当前系统暂不支持重新开启。是否确认关闭当前分期？', onOk: () => {
      if (id === String(props.project.periodId)) return finish('close');
    } });
  }
  async function finish(key: 'close' | 'complete') {
    if (busy.value || !actions.value.some(action => action.key === key)) return;
    const periodId = String(props.project.periodId);
    busy.value = true;
    try {
      const latest = await projectDetail({ periodId }, true);
      if (periodId !== String(props.project.periodId) || String(latest?.periodId) !== periodId) throw new Error('项目上下文已变化，请重新打开');
      if (!resolvePeriodOperations(latest, { manager: props.manager, typeNames: props.typeNames, hasPermission }).some(action => action.key === key)) throw new Error('项目状态或权限已变化，请刷新后重试');
      await changePeriodStatus({ periodId, status: key === 'close' ? 'CLOSED' : 'COMPLETED' });
      createMessage.success(key === 'close' ? '项目已关闭' : '项目已完结');
      changed();
    } catch (error: any) { createMessage.error(error?.message || '操作失败，请重试'); }
    finally { busy.value = false; }
  }
  function changed() { emit('changed'); refreshTodos(true).catch(() => undefined); }
</script>
<style scoped lang="less">
  .period-operations {
    margin-bottom: 16px;
    border-radius: 8px;

    :deep(.ant-card-head) {
      min-height: 48px;
      padding: 0 20px;
    }

    :deep(.ant-card-head-title) {
      padding: 14px 0;
      font-size: 15px;
      font-weight: 600;
    }

    :deep(.ant-card-body) {
      padding: 16px 20px;
    }

    &__toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px 24px;
    }

    &__actions {
      display: flex;
      flex: 1 1 auto;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    :deep(.ant-btn) {
      height: auto;
      min-height: 36px;
      padding: 6px 16px;
      border-radius: 6px;
      line-height: 22px;
      white-space: normal;
    }

    &__more {
      flex: 0 0 auto;
      margin-left: auto;
    }
  }

  @media (max-width: 576px) {
    .period-operations {
      :deep(.ant-card-head) { padding: 0 16px; }
      :deep(.ant-card-body) { padding: 12px 16px; }
      :deep(.ant-btn) { min-height: 44px; }
      &__actions { flex-basis: 100%; gap: 8px; }
    }
  }
</style>
