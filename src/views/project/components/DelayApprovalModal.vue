<template>
  <BasicModal
    @register="registerModal" title="项目延期审批" :width="680" :showOkBtn="false" :showCancelBtn="false"
    :maskClosable="false" :closable="!submitting" :keyboard="!submitting" @visible-change="onVisibleChange">
    <a-spin :spinning="loading">
      <a-alert v-if="loadError" type="error" :message="loadError" show-icon>
        <template #action><a-button @click="load">重新加载</a-button></template>
      </a-alert>
      <template v-else-if="record">
        <a-descriptions bordered :column="2" :colon="false" class="delay-details">
          <a-descriptions-item label="项目名称" :span="2">{{ projectLabel || '项目名称暂未获取' }}</a-descriptions-item>
          <a-descriptions-item label="申请单号">{{ record.applyNo || '—' }}</a-descriptions-item>
          <a-descriptions-item label="审批状态">{{ statusText }}</a-descriptions-item>
          <a-descriptions-item label="申请人">{{ record.applyUserName || '—' }}</a-descriptions-item>
          <a-descriptions-item label="申请时间">{{ record.applyTime || '—' }}</a-descriptions-item>
          <a-descriptions-item label="原计划完成日期">{{ record.originalEndTime || '—' }}</a-descriptions-item>
          <a-descriptions-item label="申请延期至">{{ record.expectedEndTime || '—' }}</a-descriptions-item>
          <a-descriptions-item label="延期天数" :span="2">{{ record.delayDays == null ? '—' : `${record.delayDays} 天` }}</a-descriptions-item>
          <a-descriptions-item label="延期原因" :span="2">{{ record.delayReason || '—' }}</a-descriptions-item>
          <a-descriptions-item v-if="record.remark" label="备注" :span="2">{{ record.remark }}</a-descriptions-item>
          <a-descriptions-item v-if="record.approvalUserName" label="审批人" :span="2">{{ record.approvalUserName }}</a-descriptions-item>
          <a-descriptions-item v-if="record.approvalTime" label="审批时间" :span="2">{{ record.approvalTime }}</a-descriptions-item>
          <a-descriptions-item v-if="record.approvalReason" label="审批意见" :span="2">{{ record.approvalReason }}</a-descriptions-item>
        </a-descriptions>
        <a-alert v-if="pending && !canApprove" class="delay-notice" type="info" message="暂无延期审批权限，仅可查看。" show-icon />
        <a-form v-if="mode === 'reject'" layout="vertical" class="delay-notice">
          <a-form-item label="驳回原因" required>
            <a-textarea v-model:value="reason" :rows="3" :disabled="submitting" placeholder="请填写驳回原因" />
          </a-form-item>
        </a-form>
        <a-alert v-if="mode === 'approve'" class="delay-notice" type="info" message="确认通过此延期申请？通过后将更新对应工序的计划完成日期。" show-icon />
        <a-alert v-if="actionError" class="delay-notice" type="error" :message="actionError" show-icon />
      </template>
    </a-spin>
    <template #footer>
      <template v-if="record && !loading && !loadError && canApprove">
        <a-button :danger="!mode" :disabled="submitting" @click="setMode(mode ? '' : 'reject')">{{ mode ? '取消' : '驳回' }}</a-button>
        <a-button type="primary" :danger="mode === 'reject'" :loading="submitting" :disabled="submitting" @click="primary">{{ mode === 'reject' ? '确认驳回' : mode === 'approve' ? '确认通过' : '通过' }}</a-button>
      </template>
      <a-button v-else :disabled="submitting" @click="closeModal">关闭</a-button>
    </template>
  </BasicModal>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue';
  import { BasicModal, useModalInner } from '/@/components/Modal';
  import { usePermission } from '/@/hooks/web/usePermission';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { getApprovalStatusMeta } from '/@/utils/approvalStatus';
  import { approveDelay, delayDetail, rejectDelay, type DelayApprovalRecord } from '../Delay.api';
  import { projectDetail } from '../Project.api';

  const emit = defineEmits(['register', 'success']);
  const { hasPermission } = usePermission();
  const { createMessage } = useMessage();
  const record = ref<DelayApprovalRecord | null>(null);
  const id = ref('');
  const projectLabel = ref('');
  const loading = ref(false);
  const submitting = ref(false);
  const loadError = ref('');
  const actionError = ref('');
  const reason = ref('');
  const mode = ref<'' | 'approve' | 'reject'>('');
  let sequence = 0;
  const pending = computed(() => String(record.value?.status) === '2');
  const canApprove = computed(() => pending.value && hasPermission('project:delay:approve'));
  const statusText = computed(() => ['0', '1', '2', '3'].includes(String(record.value?.status)) ? getApprovalStatusMeta(record.value?.status).text : '未知状态');
  const [registerModal, { closeModal }] = useModalInner((data) => {
    id.value = String(data.id || '');
    projectLabel.value = [data.projectName, data.periodName].filter(Boolean).join('－');
    reason.value = '';
    mode.value = '';
    actionError.value = '';
    void load();
  });
  function onVisibleChange(visible: boolean) { if (!visible) sequence++; }
  function setMode(value: '' | 'approve' | 'reject') {
    if (submitting.value) return;
    mode.value = value;
    actionError.value = '';
  }
  async function load() {
    const current = ++sequence;
    loading.value = true;
    loadError.value = '';
    record.value = null;
    try {
      if (!id.value) throw new Error('待办缺少延期申请 ID，请刷新待办');
      const detail = await delayDetail(id.value);
      if (!detail?.id || String(detail.id) !== id.value) throw new Error('未找到对应延期申请');
      let name = '';
      if (detail.periodId) {
        try {
          const project = await projectDetail({ periodId: detail.periodId }, true);
          name = [project?.projectName, project?.periodName].filter(Boolean).join('－');
        } catch { /* 名称查询失败不影响申请详情回显。 */ }
      }
      if (current !== sequence) return;
      record.value = detail;
      if (name) projectLabel.value = name;
    } catch (error: any) {
      if (current === sequence) loadError.value = error?.message || '延期申请加载失败，请重试';
    } finally { if (current === sequence) loading.value = false; }
  }
  async function primary() {
    if (submitting.value || !canApprove.value) return;
    if (!mode.value) return setMode('approve');
    if (mode.value === 'reject' && !reason.value.trim()) {
      actionError.value = '请填写驳回原因';
      return;
    }
    submitting.value = true;
    actionError.value = '';
    try {
      const latest = await delayDetail(id.value);
      if (!latest?.id || String(latest.id) !== id.value) throw new Error('未找到对应延期申请');
      record.value = latest;
      if (!pending.value) {
        mode.value = '';
        emit('success');
        throw new Error('申请状态已变化，请查看最新审批结果');
      }
      if (!canApprove.value) throw new Error('暂无延期审批权限');
      if (mode.value === 'reject') await rejectDelay(id.value, reason.value.trim());
      else await approveDelay(id.value);
      closeModal();
      emit('success');
      createMessage.success('审批已完成');
    } catch (error: any) { actionError.value = error?.message || '审批失败，请重试'; }
    finally { submitting.value = false; }
  }
</script>

<style scoped>
  .delay-details { white-space: pre-wrap; overflow-wrap: anywhere; }
  .delay-notice { margin-top: 16px; }
</style>
