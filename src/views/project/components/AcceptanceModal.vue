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
    <template v-else-if="project">
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
  const loading = ref(false);
  const busy = ref(false);
  const initialApply = ref(false);
  const acceptanceRef = ref<InstanceType<typeof DetailAcceptance>>();
  let requestId = 0;

  const [register] = useModalInner(async (data) => {
    periodId.value = String(data?.periodId || '');
    initialApply.value = Boolean(data?.apply);
    fromTodo.value = Boolean(data?.fromTodo);
    initialRecheckType.value = String(data?.recheckType || '');
    initialAcceptanceId.value = String(data?.acceptanceId || '');
    busy.value = false;
    project.value = { ...(data?.project || {}), id: periodId.value };
    await loadProject();
  });

  async function loadProject() {
    const request = ++requestId;
    error.value = '';
    loading.value = true;
    try {
      if (!canOpen()) throw new Error('当前账号无验收入口权限');
      if (!periodId.value) throw new Error('缺少项目分期信息');
      const detail = project.value;
      if (request !== requestId) return;
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

  function handleSuccess() {
    emit('success');
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
