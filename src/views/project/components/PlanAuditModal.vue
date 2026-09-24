<template>
  <BasicModal
    v-bind="$attrs" @register="register" destroyOnClose title="分期计划审批"
    :width="720" :showOkBtn="false" :showCancelBtn="false" @visible-change="handleVisibleChange">
    <a-spin v-if="loading" tip="正在加载项目信息…" />
    <a-alert v-else-if="loadError" type="error" show-icon :message="loadError">
      <template #action><a-button size="small" @click="loadPeriodInfo">重试</a-button></template>
    </a-alert>
    <a-descriptions v-else :column="1" bordered>
      <a-descriptions-item label="项目名称">{{ periodInfo.projectName || '—' }} - {{ periodInfo.periodName || '—' }}</a-descriptions-item>
      <a-descriptions-item label="项目阶段">{{ projectStatusMap[periodInfo.status] || periodInfo.status || '—' }}</a-descriptions-item>
    </a-descriptions>
    <p class="plan-audit-tip">请核对计划详情和本轮提交快照后审批；审批通过后进入筹备中。</p>
    <a-alert v-if="approvalHint && detailReady" type="warning" show-icon :message="approvalHint" />
    <template #footer>
      <div class="plan-audit-footer">
      <PeriodApprovalActions
        v-if="visible" :period-id="periodId" :approval-id="approvalId" allow-approve
        hide-hint :disabled="!detailReady" @hint="approvalHint = $event" @busy="submitting = $event" @changed="handleChanged" />
      <a-button :disabled="!detailReady || submitting" @click="handleViewDetail">查看计划详情</a-button>
      <a-button :disabled="submitting" @click="closeModal">关闭</a-button>
      </div>
    </template>
  </BasicModal>
</template>

<script lang="ts" setup>
  import { ref } from 'vue';
  import { useRouter } from 'vue-router';
  import { BasicModal, useModalInner } from '/@/components/Modal';
  import { projectDetail } from '../Project.api';
  import { projectStatusMap } from '../Project.data';
  import PeriodApprovalActions from '../plan/PeriodApprovalActions.vue';

  const router = useRouter();
  const emit = defineEmits(['register', 'success']);
  const periodId = ref('');
  const approvalId = ref('');
  const approvalHint = ref('');
  const periodInfo = ref<Recordable>({});
  const submitting = ref(false);
  const loading = ref(false);
  const loadError = ref('');
  const detailReady = ref(false);
  const visible = ref(false);
  let detailSequence = 0;
  const [register, { closeModal }] = useModalInner(async (data) => {
    periodId.value = String(data?.periodId || '');
    approvalId.value = String(data?.approvalId || '');
    approvalHint.value = '';
    visible.value = true;
    await loadPeriodInfo();
  });

  function handleVisibleChange(value: boolean) {
    visible.value = value;
    if (!value) { detailSequence += 1; detailReady.value = false; loading.value = false; }
  }
  async function loadPeriodInfo() {
    const sequence = ++detailSequence;
    const id = periodId.value;
    detailReady.value = false;
    loadError.value = '';
    loading.value = true;
    try {
      if (!id) throw new Error('缺少项目分期 ID');
      const result: any = await projectDetail({ periodId: id }, true);
      if (sequence !== detailSequence || id !== periodId.value) return;
      if (String(result?.periodId || '') !== id) throw new Error('返回的项目分期信息不匹配，请重试');
      periodInfo.value = result;
      detailReady.value = true;
    } catch (error: any) {
      if (sequence === detailSequence) loadError.value = error?.message || '项目信息加载失败，请重试';
    } finally { if (sequence === detailSequence) loading.value = false; }
  }
  async function handleChanged() { emit('success'); await loadPeriodInfo(); }
  function handleViewDetail() {
    if (!detailReady.value || submitting.value) return;
    closeModal();
    router.push({ path: '/project/plan', query: { periodId: periodId.value, mode: 'view', audit: '1', ...(approvalId.value ? { approvalId: approvalId.value } : {}) } });
  }
</script>

<style scoped>
  .plan-audit-tip { margin: 16px 0; color: #595959; }
  .plan-audit-footer { display: flex; justify-content: flex-end; align-items: center; flex-wrap: wrap; gap: 8px; }
</style>
