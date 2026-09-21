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
      <template #message>确认本分期已到货；若合同配置了到货款，系统将同步计算计划回款时间。</template>
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
      <a-descriptions-item label="合同附件">
        <a-space v-if="contractAttachments.length" direction="vertical" size="small">
          <a-button
            v-for="file in contractAttachments"
            :key="file.fileId"
            type="link"
            size="small"
            preIcon="ant-design:eye-outlined"
            @click="previewFileInModal(file.fileId, file.fileName)"
          >
            预览：{{ file.fileName }}
          </a-button>
        </a-space>
        <span v-else>暂无合同附件</span>
      </a-descriptions-item>
    </a-descriptions>

    <a-alert v-if="!loading && !arrivalPlan" type="info" show-icon class="arrival-confirm__missing" message="此合同未配置到货款，仍需确认到货。" />

    <template #footer>
      <a-button :disabled="submitting" @click="closeModal">取消</a-button>
      <a-button type="primary" :loading="submitting" :disabled="loading" @click="handleConfirm"> 确认执行 </a-button>
    </template>
  </BasicModal>
</template>

<script lang="ts" setup>
  import { expandContractAttachments } from '../contract/contractAttachments';
  import { computed, ref } from 'vue';
  import dayjs from 'dayjs';
  import { BasicModal, useModalInner } from '/@/components/Modal';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { contractDetailByPeriodId } from '/@/views/payment/Payment.api';
  import { previewFileInModal } from '/@/utils/filePreview';
  import { changeArrivalStatus, projectDetail } from '../Project.api';
  import { getFiles } from '../detail/ProjectDetail.api';
  import { findArrivalPayment, isArrivalStage, isPhysicalProject } from '../arrivalPayment';
  import { loadProjectTypeMap } from '../Project.data';
  import { readProjectMembership } from '../projectMembership';
  import { useUserStore } from '/@/store/modules/user';
  import { usePermission } from '/@/hooks/web/usePermission';

  const userStore = useUserStore();
  const { hasPermission } = usePermission();
  const emit = defineEmits(['register', 'success']);
  const { createMessage } = useMessage();

  const periodId = ref('');
  const projectName = ref('');
  const periodName = ref('');
  const loading = ref(false);
  const submitting = ref(false);
  const arrivalPlan = ref<Recordable>();
  const contract = ref<Recordable>({});
  const contractAttachments = ref<Recordable[]>([]);

  const rollbackDays = computed(() => {
    const value = Number(arrivalPlan.value?.rollbackTime ?? 7);
    return Number.isInteger(value) && value >= 0 ? value : 7;
  });
  const expectedPaymentDate = computed(() => dayjs().add(rollbackDays.value, 'day').format('YYYY-MM-DD'));
  const [register, { closeModal }] = useModalInner(async (data) => {
    const record = data?.record || data || {};
    periodId.value = String(data?.periodId || record.periodId || record.id || '');
    projectName.value = record.projectName || '';
    periodName.value = record.periodName || '';
    arrivalPlan.value = undefined;
    contract.value = {};
    contractAttachments.value = [];
    submitting.value = false;

    if (!periodId.value) {
      createMessage.error('缺少项目分期 ID，无法确认到货');
      return;
    }

    loading.value = true;
    try {
      const [detail, filePage]: any[] = await Promise.all([
        contractDetailByPeriodId(periodId.value),
        getFiles({ periodId: periodId.value, pageNo: 1, pageSize: 100 }).catch(() => undefined),
      ]);
      contract.value = detail || {};
      const attachmentRecords = (Array.isArray(filePage) ? filePage : filePage?.records || []).filter(
        (item: Recordable) => String(item.fileType || '') === 'CONTRACT_ATTACHMENT' && item.fileId
      );
      contractAttachments.value = expandContractAttachments(
        attachmentRecords.length && !detail?.contractFileId
          ? attachmentRecords
          : [
              {
                fileId: detail?.contractFileId || detail?.contractFile?.fileId,
                fileName: detail?.contractFile?.fileName || detail?.contractFileName,
              },
              {
                fileId: detail?.materialFile?.fileId || detail?.materialFileId,
                fileName: detail?.materialFile?.fileName || detail?.materialFileName,
              },
            ]
              .filter((item) => item.fileId)
              .map((item) => ({ ...item, fileName: item.fileName || String(item.fileId).split('/').pop() || '合同附件' }))
      );
      arrivalPlan.value = findArrivalPayment(detail?.records);
    } catch (error: any) {
      createMessage.error(error?.message || '合同回款信息加载失败，请稍后重试');
    } finally {
      loading.value = false;
    }
  });

  async function handleConfirm() {
    if (!periodId.value || loading.value || submitting.value || !hasPermission('project:arrival:confirm')) return;
    submitting.value = true;
    try {
      const [latest, typeNames, membership] = await Promise.all([
        projectDetail({ periodId: periodId.value }),
        loadProjectTypeMap(),
        readProjectMembership(periodId.value, String(userStore.getUserInfo?.id || '')),
      ]);
      if (!isArrivalStage(latest || {}) || !isPhysicalProject(latest || {}, typeNames) || !membership.manager) {
        createMessage.warning('当前项目阶段、类型或项目经理身份不符合确认到货条件，请刷新后操作');
        closeModal();
        emit('success');
        return;
      }
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
