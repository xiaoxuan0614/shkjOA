<template>
  <BasicModal
    v-bind="$attrs"
    @register="register"
    destroyOnClose
    title="计划审批"
    :width="640"
    :showOkBtn="false"
    :showCancelBtn="false"
    @visible-change="handleVisibleChange"
  >
    <a-spin v-if="loading" tip="正在加载项目信息…" />
    <a-alert v-else-if="loadError" type="error" show-icon :message="loadError">
      <template #action><a-button size="small" @click="loadPeriodInfo">重试</a-button></template>
    </a-alert>
    <a-descriptions v-else :column="1" bordered size="middle">
      <a-descriptions-item label="项目名称">{{ periodInfo.projectName || '—' }}</a-descriptions-item>
      <a-descriptions-item label="分期名称">{{ periodInfo.periodName || '—' }}</a-descriptions-item>
      <a-descriptions-item label="当前状态">
        <a-tag :color="statusColorMap[periodInfo.status] || 'default'">{{ projectStatusMap[periodInfo.status] || periodInfo.status || '—' }}</a-tag>
      </a-descriptions-item>
    </a-descriptions>
    <div class="plan-audit__tip"> 请核对方案文件、用料计划、人员配置、实施计划、位置信息和回款计划后审批。 </div>
    <!-- 驳回原因输入 -->
    <div v-if="rejecting" class="plan-audit__reject">
      <span class="plan-audit__reject-label">驳回原因</span>
      <a-textarea v-model:value="rejectReason" :rows="3" placeholder="请填写驳回原因（必填）" />
    </div>

    <template #footer>
      <template v-if="rejecting && canProcess">
        <a-button @click="rejecting = false">取消驳回</a-button>
        <a-button type="danger" :loading="submitting" @click="handleReject">确认驳回</a-button>
      </template>
      <template v-else-if="canProcess">
        <a-button preIcon="ant-design:eye-outlined" :disabled="!detailReady || submitting" @click="handleViewDetail">查看详情</a-button>
        <a-button danger :disabled="submitting" @click="rejecting = true">驳 回</a-button>
        <a-button type="primary" :loading="submitting" @click="handleApprove">通 过</a-button>
      </template>
      <template v-else>
        <a-button preIcon="ant-design:eye-outlined" :disabled="!detailReady || submitting" @click="handleViewDetail">查看详情</a-button>
      </template>
    </template>
  </BasicModal>
</template>

<script lang="ts" setup>
  import { ref, computed } from 'vue';
  import { useRouter } from 'vue-router';
  import { BasicModal, useModalInner } from '/@/components/Modal';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { changePeriodStatus, projectDetail } from '../Project.api';
  import { projectStatusMap, statusColorMap } from '../Project.data';
  import { APPROVAL_PENDING, getApprovalStatusMeta } from '/@/utils/approvalStatus';

  const { createMessage } = useMessage();
  const router = useRouter();
  const emit = defineEmits(['register', 'success']);

  const periodId = ref('');
  const periodInfo = ref<Recordable>({});
  const rejecting = ref(false);
  const rejectReason = ref('');
  const submitting = ref(false);

  const approvalStatusMeta = computed(() => getApprovalStatusMeta(periodInfo.value.approvalStatus));

  const loading = ref(false);
  const loadError = ref('');
  const detailReady = ref(false);
  let detailSequence = 0;
  const canProcess = computed(
    () => detailReady.value && !loading.value && periodInfo.value.status === 'PENDING_APPROVAL' && approvalStatusMeta.value.pending
  );

  const [register, { closeModal }] = useModalInner(async (data) => {
    periodId.value = String(data?.periodId || '');
    rejecting.value = false;
    rejectReason.value = '';
    await loadPeriodInfo();
  });

  function handleVisibleChange(visible: boolean) {
    if (!visible) {
      detailSequence += 1;
      detailReady.value = false;
      loading.value = false;
    }
  }

  async function loadPeriodInfo() {
    const sequence = ++detailSequence;
    const id = periodId.value;
    periodInfo.value = {};
    detailReady.value = false;
    loadError.value = '';
    if (!id) {
      loadError.value = '缺少项目分期 ID，无法加载项目信息';
      return;
    }
    loading.value = true;
    try {
      const result: any = await projectDetail({ periodId: id }, true);
      if (sequence !== detailSequence || id !== periodId.value) return;
      if (!result || String(result.periodId || '') !== id) throw new Error('返回的项目分期信息不匹配，请重试');
      periodInfo.value = {
        ...result,
        approvalStatus: result.approvalStatus ?? (result.status === 'PENDING_APPROVAL' ? APPROVAL_PENDING : undefined),
      };
      detailReady.value = true;
    } catch (error: any) {
      if (sequence === detailSequence) loadError.value = error?.message || '项目信息加载失败，请重试';
    } finally {
      if (sequence === detailSequence) loading.value = false;
    }
  }

  /** 审批通过 → 项目实施中 */
  async function handleApprove() {
    if (!periodId.value || !canProcess.value || submitting.value) return;
    submitting.value = true;
    try {
      await changePeriodStatus({ periodId: periodId.value, status: 'IMPLEMENTING' });
      createMessage.success('审批通过，项目开始实施');
      closeModal();
      emit('success');
    } finally {
      submitting.value = false;
    }
  }

  function handleViewDetail() {
    if (!detailReady.value || submitting.value) return;
    if (!periodId.value) {
      createMessage.warning('缺少项目分期 ID，无法查看计划方案');
      return;
    }
    closeModal();
    router.push({
      path: '/project/plan',
      query: { periodId: periodId.value, mode: 'view', audit: '1' },
    });
  }

  /** 审批驳回 → 回筹备中(项目经理可修改计划) */
  async function handleReject() {
    if (!periodId.value || !canProcess.value || submitting.value) return;
    if (!rejectReason.value?.trim()) {
      createMessage.warning('请填写驳回原因');
      return;
    }
    submitting.value = true;
    try {
      await changePeriodStatus({ periodId: periodId.value, status: 'PREPARING' });
      createMessage.success('已驳回，项目经理可修改计划');
      closeModal();
      emit('success');
    } finally {
      submitting.value = false;
    }
  }
</script>

<style lang="less" scoped>
  .plan-audit {
    &__tip {
      margin: 12px 0;
      padding: 8px 12px;
      background: #e6f7ff;
      border: 1px solid #91d5ff;
      border-radius: 4px;
      color: #096dd9;
      font-size: 13px;
    }

    &__reject {
      display: flex;
      gap: 12px;
      margin-top: 12px;

      &-label {
        color: #333;
        font-size: 14px;
        flex-shrink: 0;
        line-height: 32px;
      }
    }
  }
</style>
