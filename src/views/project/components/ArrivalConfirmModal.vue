<template>
  <BasicModal
    v-bind="$attrs"
    @register="register"
    destroyOnClose
    title="确认到货"
    :width="680"
    :showOkBtn="false"
    :showCancelBtn="false"
    :loading="loading"
  >
    <a-alert type="warning" show-icon class="arrival-confirm__alert">
      <template #message>确认后系统将自动生成到货款计划回款时间，是否确认执行该操作？</template>
    </a-alert>

    <a-descriptions :column="1" bordered size="middle">
      <a-descriptions-item label="项目名称">{{ projectName || '—' }}</a-descriptions-item>
      <a-descriptions-item label="分期名称">{{ periodName || '—' }}</a-descriptions-item>
      <a-descriptions-item label="到货款回款周期">
        {{ arrivalPlan ? `${rollbackDays} 天` : '未配置到货款计划' }}
      </a-descriptions-item>
      <a-descriptions-item label="预计回款时间">
        <strong v-if="arrivalPlan">{{ expectedPaymentDate }}</strong>
        <span v-else>—</span>
      </a-descriptions-item>
      <a-descriptions-item label="合同货物清单">
        <a-button
          v-if="materialFileSource"
          type="link"
          size="small"
          preIcon="ant-design:eye-outlined"
          @click="previewFileInModal(materialFileSource, materialFileName)"
        >
          预览：{{ materialFileName }}
        </a-button>
        <span v-else>暂无合同货物清单</span>
      </a-descriptions-item>
    </a-descriptions>

    <a-alert
      v-if="!loading && !arrivalPlan"
      type="error"
      show-icon
      class="arrival-confirm__missing"
      message="合同中未找到到货款计划，请先完善合同回款计划后再确认到货。"
    />

    <template #footer>
      <a-button :disabled="submitting" @click="closeModal">取消</a-button>
      <a-button type="primary" :loading="submitting" :disabled="loading || !arrivalPlan" @click="handleConfirm"> 确认执行 </a-button>
    </template>
  </BasicModal>
</template>

<script lang="ts" setup>
  import { computed, ref } from 'vue';
  import dayjs from 'dayjs';
  import { BasicModal, useModalInner } from '/@/components/Modal';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { contractDetailByPeriodId } from '/@/views/payment/Payment.api';
  import { previewFileInModal } from '/@/utils/filePreview';
  import { changeArrivalStatus } from '../Project.api';
  import { loadDictOptions } from '../Project.data';

  const emit = defineEmits(['register', 'success']);
  const { createMessage } = useMessage();

  const periodId = ref('');
  const projectName = ref('');
  const periodName = ref('');
  const loading = ref(false);
  const submitting = ref(false);
  const arrivalPlan = ref<Recordable>();
  const materialFile = ref<Recordable>({});
  const contract = ref<Recordable>({});

  const rollbackDays = computed(() => {
    const value = Number(arrivalPlan.value?.rollbackTime ?? 7);
    return Number.isInteger(value) && value >= 0 ? value : 7;
  });
  const expectedPaymentDate = computed(() => dayjs().add(rollbackDays.value, 'day').format('YYYY-MM-DD'));
  const materialFileSource = computed(
    () =>
      materialFile.value?.fileId ||
      materialFile.value?.url ||
      contract.value?.materialFileId ||
      contract.value?.materialListFileId ||
      contract.value?.materialListFilePath ||
      ''
  );
  const materialFileName = computed(
    () =>
      materialFile.value?.fileName ||
      contract.value?.materialFileName ||
      contract.value?.materialListFileName ||
      (materialFileSource.value ? String(materialFileSource.value).split('/').pop() || '合同货物清单' : '')
  );

  const [register, { closeModal }] = useModalInner(async (data) => {
    const record = data?.record || data || {};
    periodId.value = String(data?.periodId || record.periodId || record.id || '');
    projectName.value = record.projectName || '';
    periodName.value = record.periodName || '';
    arrivalPlan.value = undefined;
    materialFile.value = {};
    contract.value = {};
    submitting.value = false;

    if (!periodId.value) {
      createMessage.error('缺少项目分期 ID，无法确认到货');
      return;
    }

    loading.value = true;
    try {
      const [detail, nodeOptions] = await Promise.all([
        contractDetailByPeriodId(periodId.value),
        loadDictOptions('payback_node', [{ label: '到货款', value: '到货款' }]),
      ]);
      contract.value = detail || {};
      materialFile.value = detail?.materialFile || {};
      const arrivalNodeValues = new Set(nodeOptions.filter((item) => String(item.label).trim() === '到货款').map((item) => String(item.value)));
      arrivalNodeValues.add('到货款');
      arrivalPlan.value = (detail?.records || []).find((item: Recordable) => arrivalNodeValues.has(String(item.paymentNode ?? item.node ?? '')));
    } catch (error: any) {
      createMessage.error(error?.message || '合同回款信息加载失败，请稍后重试');
    } finally {
      loading.value = false;
    }
  });

  async function handleConfirm() {
    if (!periodId.value || !arrivalPlan.value || submitting.value) return;
    submitting.value = true;
    try {
      await changeArrivalStatus({ periodId: periodId.value, arrivalStatus: 1 });
      createMessage.success('已确认到货');
      closeModal();
      emit('success');
    } finally {
      submitting.value = false;
    }
  }
</script>

<style lang="less" scoped>
  .arrival-confirm {
    &__alert {
      margin-bottom: 16px;
    }

    &__missing {
      margin-top: 16px;
    }
  }
</style>
