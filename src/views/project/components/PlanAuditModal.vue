<template>
  <BasicModal v-bind="$attrs" @register="register" destroyOnClose title="计划审批" :width="640" :showOkBtn="false" :showCancelBtn="false">
    <a-descriptions :column="1" bordered size="middle">
      <a-descriptions-item label="项目名称">{{ periodInfo.projectName || '—' }}</a-descriptions-item>
      <a-descriptions-item label="分期名称">{{ periodInfo.periodName || '—' }}</a-descriptions-item>
      <a-descriptions-item label="当前状态">
        <a-tag :color="statusColor">{{ statusText }}</a-tag>
      </a-descriptions-item>
    </a-descriptions>
    <div class="plan-audit__tip">
      请先到「计划方案」详情核对计划用料清单 / 实施计划 / 实施位置 / 参与人员，确认后审批。
    </div>

    <!-- 驳回原因输入 -->
    <div v-if="rejecting" class="plan-audit__reject">
      <span class="plan-audit__label">驳回原因</span>
      <a-textarea v-model:value="rejectReason" :rows="3" placeholder="请填写驳回原因（必填）" />
    </div>

    <template #footer>
      <template v-if="rejecting">
        <a-button @click="rejecting = false">取消驳回</a-button>
        <a-button type="danger" :loading="submitting" @click="handleReject">确认驳回</a-button>
      </template>
      <template v-else>
        <a-button @click="closeModal">关 闭</a-button>
        <a-button danger @click="rejecting = true">驳 回</a-button>
        <a-button type="primary" :loading="submitting" @click="handleApprove">通 过</a-button>
      </template>
    </template>
  </BasicModal>
</template>

<script lang="ts" setup>
  import { ref, computed } from 'vue';
  import { BasicModal, useModalInner } from '/@/components/Modal';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { changePeriodStatus } from '../Project.api';
  import { loadProjectStatusMap, projectStatusMap, statusColorMap } from '../Project.data';

  const { createMessage } = useMessage();
  const emit = defineEmits(['register', 'success']);

  const periodId = ref('');
  const periodInfo = ref<Recordable>({});
  const statusMeta = ref<Recordable>({});
  const rejecting = ref(false);
  const rejectReason = ref('');
  const submitting = ref(false);

  const statusText = computed(() => statusMeta.value[periodInfo.value.status]?.text || projectStatusMap[periodInfo.value.status] || periodInfo.value.status || '—');
  const statusColor = computed(() => statusMeta.value[periodInfo.value.status]?.color || statusColorMap[periodInfo.value.status] || 'default');

  const [register, { closeModal }] = useModalInner(async (data) => {
    periodId.value = data?.periodId || '';
    rejecting.value = false;
    rejectReason.value = '';
    periodInfo.value = {
      projectName: data?.projectName || data?.record?.projectName || '',
      periodName: data?.periodName || data?.record?.periodName || '',
      status: data?.status || data?.record?.status || 'PENDING_APPROVAL',
    };
    statusMeta.value = await loadProjectStatusMap();
  });

  /** 审批通过 → 项目实施中 */
  async function handleApprove() {
    if (!periodId.value) return;
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

  /** 审批驳回 → 回筹备中(项目经理可修改计划) */
  async function handleReject() {
    if (!periodId.value) return;
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
