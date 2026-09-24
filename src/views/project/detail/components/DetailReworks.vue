<template>
  <div>
    <div style="display: flex; justify-content: flex-end; margin-bottom: 12px">
      <a-button size="small" :loading="loading" @click="load">刷新</a-button>
    </div>
    <a-alert v-if="error" type="warning" :message="error" show-icon />
    <a-table
      v-else
      :columns="columns"
      :data-source="rows"
      row-key="id"
      :loading="loading"
      :pagination="{ current: page, pageSize: 10, total, showSizeChanger: false }"
      :scroll="{ x: 900 }"
      @change="changePage"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'approvalStatus'">{{ getApprovalStatusMeta(record.approvalStatus).text }}</template>
        <template v-else-if="column.key === 'executionStatus'">{{ executionText(record) }}</template>
        <template v-else-if="column.key === 'action'">
          <a-button type="link" @click="$emit('open', record.id)">查看详情</a-button>
          <a-button v-if="canApprove(record)" type="link" @click="$emit('open', record.id)">审批</a-button>
        </template>
      </template>
    </a-table>
  </div>
</template>
<script setup lang="ts">
  import { ref, watch } from 'vue';
  import { getProjectReworks } from '../ProjectDetail.api';
  import { getApprovalStatusMeta, isApprovalPending } from '/@/utils/approvalStatus';
  import { usePermission } from '/@/hooks/web/usePermission';
  const { hasPermission } = usePermission();
  const canApprove = (record: any) => hasPermission('project:rework:approve') && isApprovalPending(record.approvalStatus);
  const props = defineProps<{ periodId: string }>();
  defineEmits(['open']);
  const rows = ref<any[]>([]),
    page = ref(1),
    total = ref(0),
    loading = ref(false),
    error = ref('');
  let request = 0;
  const columns = [
    { title: '返工单号', dataIndex: 'reworkNo' },
    { title: '申请人', dataIndex: 'applyUserName' },
    { title: '返工原因', dataIndex: 'reason', ellipsis: true },
    { title: '提交时间', dataIndex: 'submitTime' },
    { title: '审批状态', key: 'approvalStatus' },
    { title: '实施状态', key: 'executionStatus' },
    { title: '审批人', dataIndex: 'approvalUserName' },
    { title: '审批意见', dataIndex: 'approvalReason', ellipsis: true },
    { title: '操作', key: 'action', width: 180, fixed: 'right' },
  ];
  const executionText = (row: any) =>
    String(row.approvalStatus) !== '1'
      ? '尚未进入实施'
      : { NOT_STARTED: '未开始', IN_PROGRESS: '返工中', COMPLETED: '已完成' }[row.executionStatus] || '—';
  async function load() {
    const current = ++request;
    loading.value = true;
    error.value = '';
    try {
      const result: any = await getProjectReworks({ periodId: props.periodId, pageNo: page.value, pageSize: 10 });
      if (current !== request) return;
      rows.value = result?.records || [];
      total.value = Number(result?.total || 0);
    } catch (e: any) {
      if (current === request) {
        rows.value = [];
        error.value = e?.message || '返工记录加载失败，请刷新重试';
      }
    } finally {
      if (current === request) loading.value = false;
    }
  }
  function changePage(pagination: any) {
    page.value = pagination.current;
    void load();
  }
  watch(
    () => props.periodId,
    () => {
      page.value = 1;
      rows.value = [];
      void load();
    },
    { immediate: true }
  );
  defineExpose({ load });
</script>
