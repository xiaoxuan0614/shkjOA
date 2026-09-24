<template>
  <BasicModal
    v-bind="$attrs"
    @register="register"
    title="验收"
    :width="1000"
    destroyOnClose
    :showOkBtn="false"
    :showCancelBtn="false"
    :maskClosable="false"
    :closable="!busy"
    :keyboard="!busy"
    :loading="loading"
    @visible-change="handleVisibleChange"
  >
    <a-alert v-if="error" type="warning" show-icon :message="error">
      <template #action><a-button size="small" @click="loadProject">重新加载</a-button></template>
    </a-alert>
    <template v-else-if="project && !loading">
      <a-alert v-if="refreshError" type="warning" show-icon :message="refreshError">
        <template #action><a-button @click="refreshProjectContext">重试</a-button></template>
      </a-alert>
      <DetailAcceptance ref="acceptanceRef" :key="periodId" :project-id="periodId" :project="project" :initial-apply="initialApply" :initial-recheck-type="initialRecheckType" :initial-acceptance-id="initialAcceptanceId" footer-actions @busy-change="busy = $event" @changed="handleSuccess" />
    </template>
    <template #footer>
      <div v-if="!error && project && acceptanceRef" class="acceptance-modal__footer">
        <a-button
          v-for="action in acceptanceRef.secondaryActions"
          :key="action.key"
          :disabled="action.disabled"
          :danger="action.danger"
          :loading="action.loading"
          @click="action.onClick()"
          >{{ action.label }}</a-button
        >
        <a-button
          v-for="action in acceptanceRef.submitActions"
          :key="action.type"
          type="primary"
          :disabled="acceptanceRef.submitDisabled"
          :loading="action.loading"
          @click="acceptanceRef.submit(action.type)"
          >{{ action.label }}</a-button
        >
      </div>
    </template>
  </BasicModal>
</template>

<script lang="ts" setup>
  import { ref } from 'vue';
  import { BasicModal, useModalInner } from '/@/components/Modal';
  import { useAcceptanceAccess } from '../useAcceptanceAccess';
  import { usePermission } from '/@/hooks/web/usePermission';
  import { projectDetail } from '../Project.api';
  import DetailAcceptance from '../detail/components/DetailAcceptance.vue';

  const emit = defineEmits(['register', 'success']);
  const { canViewAcceptanceEntry } = useAcceptanceAccess();
  const { hasPermission } = usePermission();
  const fromTodo = ref(false);
  const initialRecheckType = ref(''), initialAcceptanceId = ref('');
  const canOpen = () => canViewAcceptanceEntry() || (initialApply.value && hasPermission('project:acceptance:submit')) ||
    (fromTodo.value && ['project:acceptance:submit', 'project:internalAccept', 'project:accept'].some((code) => hasPermission(code)));
  const periodId = ref('');
  const project = ref<Recordable>();
  const error = ref('');
  const refreshError = ref('');
  const loading = ref(false);
  const busy = ref(false);
  const initialApply = ref(false);
  const acceptanceRef = ref<InstanceType<typeof DetailAcceptance>>();
  let requestId = 0;

  const [register, { closeModal }] = useModalInner(async (data) => {
    periodId.value = String(data?.periodId || '');
    initialApply.value = Boolean(data?.apply);
    fromTodo.value = Boolean(data?.fromTodo);
    initialRecheckType.value = String(data?.recheckType || '');
    initialAcceptanceId.value = String(data?.acceptanceId || '');
    busy.value = false;
    refreshError.value = '';
    project.value = undefined;
    await loadProject();
  });

  async function loadProject() {
    const request = ++requestId;
    const id = periodId.value;
    error.value = '';
    loading.value = true;
    try {
      if (!canOpen()) throw new Error('当前账号无验收入口权限');
      if (!periodId.value) throw new Error('缺少项目分期信息');
      const detail = await projectDetail({ periodId: id }, true);
      if (request !== requestId || id !== periodId.value) return;
      if (!detail || String(detail.periodId || '') !== id || !detail.status) throw new Error('返回的项目分期信息不完整或不匹配，请重试');
      if (!canOpen()) throw new Error('当前账号无验收入口权限');
      project.value = detail;
    } catch (e: any) {
      if (request === requestId) error.value = e?.message || '项目信息加载失败，请重试';
    } finally {
      if (request === requestId) loading.value = false;
    }
  }

  function handleVisibleChange(visible: boolean) {
    if (!visible) {
      requestId++;
      project.value = undefined;
    }
  }

  function handleSuccess(action?: 'completed') {
    if (action === 'completed') closeModal();
    else void refreshProjectContext();
    emit('success');
  }

  // 申请验收后保留刚返回的记录和已填写表单，仅刷新项目生命周期。
  async function refreshProjectContext() {
    const request = ++requestId;
    const id = periodId.value;
    refreshError.value = '';
    if (!project.value) return;
    project.value = { ...project.value, status: '' };
    try {
      const detail = await projectDetail({ periodId: id }, true);
      if (request !== requestId || id !== periodId.value) return;
      if (!canOpen() || !detail || String(detail.periodId || '') !== id || !detail.status) throw new Error('项目状态校验失败');
      project.value = detail;
    } catch (e: any) {
      if (request === requestId) refreshError.value = `${e?.message || '项目状态刷新失败'}，填写内容已保留，请重试后继续办理`;
    }
  }
</script>

<style scoped>
  .acceptance-modal__footer {
    display: flex;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 8px;
  }
</style>
