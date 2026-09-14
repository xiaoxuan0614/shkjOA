<template>
  <BasicModal
    v-bind="$attrs"
    @register="register"
    title="项目验收"
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
      <a-descriptions :column="2" size="small">
        <a-descriptions-item label="项目名称">{{ project.projectName || '—' }}</a-descriptions-item>
        <a-descriptions-item label="分期名称">{{ project.periodName || '—' }}</a-descriptions-item>
      </a-descriptions>
      <DetailAcceptance
        :key="periodId"
        :project-id="periodId"
        :project="project"
        operation-only
        @busy-change="busy = $event"
        @changed="handleSuccess"
      />
    </template>
  </BasicModal>
</template>

<script lang="ts" setup>
  import { ref } from 'vue';
  import { BasicModal, useModalInner } from '/@/components/Modal';
  import { useAcceptanceAccess } from '../useAcceptanceAccess';
  import { projectDetail } from '../Project.api';
  import DetailAcceptance from '../detail/components/DetailAcceptance.vue';

  const emit = defineEmits(['register', 'success']);
  const { canOperateAcceptance, canViewAcceptanceEntry } = useAcceptanceAccess();
  const periodId = ref('');
  const project = ref<Recordable>();
  const error = ref('');
  const loading = ref(false);
  const busy = ref(false);
  let requestId = 0;

  const [register, { closeModal }] = useModalInner(async (data) => {
    periodId.value = String(data?.periodId || '');
    busy.value = false;
    await loadProject();
  });

  async function loadProject() {
    const request = ++requestId;
    project.value = undefined;
    error.value = '';
    loading.value = true;
    try {
      if (!canViewAcceptanceEntry()) throw new Error('当前账号无验收入口权限');
      if (!periodId.value) throw new Error('缺少项目分期信息');
      const detail = await projectDetail({ periodId: periodId.value }, true);
      if (request !== requestId) return;
      if (!canViewAcceptanceEntry()) throw new Error('当前账号无验收入口权限');
      if (detail?.status !== 'ACCEPTING') throw new Error('项目已不在验收中，请刷新列表后查看');
      const managerId = detail.projectManagerUserId || detail.projectManagerId;
      if (!canOperateAcceptance('INTERNAL', managerId) && !canOperateAcceptance('CUSTOMER', managerId)) {
        throw new Error('当前账号无本项目验收办理权限；外部验收须由本项目项目经理办理');
      }
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
    closeModal();
    emit('success');
  }
</script>
