<template>
  <section class="plan-history">
    <div class="plan-history__heading">
      <h3>计划审批记录</h3>
      <a-space><span>项目状态</span><a-tag v-if="!loading && !error && state" :color="statusColorMap[state.status] || 'default'">{{ projectStatusMap[state.status] || '—' }}</a-tag><span v-else>—</span><a-button :loading="loading" preIcon="ant-design:reload-outlined" @click="load">刷新</a-button></a-space>
    </div>
    <a-alert v-if="error" type="error" show-icon :message="error" />
    <template v-else>
      <a-table :columns="columns" :data-source="pageRows" row-key="id" :loading="loading" :pagination="false" :scroll="{ x: 1080 }" size="middle">
        <template #emptyText><a-empty description="暂无计划审批记录" /></template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'round'"><a-space>第 {{ record.roundNo }} 轮<a-tag v-if="record.id === rows[0]?.id" color="blue">最新</a-tag></a-space></template>
          <template v-else-if="column.key === 'status'"><a-tag :color="getApprovalStatusMeta(record.approvalStatus).color">{{ getApprovalStatusMeta(record.approvalStatus).text }}</a-tag></template>
          <template v-else-if="column.key === 'action'"><a-button type="link" @click="viewDetail(record)">查看详情</a-button></template>
          <template v-else>{{ record[column.dataIndex] || '—' }}</template>
        </template>
      </a-table>
      <BasicPagination v-if="rows.length" class="plan-history__pagination" :current="page" :page-size="10" :total="rows.length" :show-size-changer="false" @change="page = $event" />
    </template>
  </section>
</template>

<script setup lang="ts">
  import { computed, ref, watch, onBeforeUnmount } from 'vue';
  import { useRouter } from 'vue-router';
  import { useUserStore } from '/@/store/modules/user';
  import { getApprovalStatusMeta } from '/@/utils/approvalStatus';
  import { projectStatusMap, statusColorMap } from '../../Project.data';
  import { getPeriodApprovalHistory, getPeriodApprovalState } from '../../plan/PeriodApproval.api';
  import { type PeriodApprovalRecord } from '../../plan/periodApproval';
  const props = defineProps<{ periodId: string }>();
  const user = useUserStore();
  const rows = ref<PeriodApprovalRecord[]>([]), state = ref<Recordable>();
  const router = useRouter();
  function viewDetail(record: PeriodApprovalRecord) {
    router.push({ path: '/project/plan', query: { periodId: props.periodId, approvalId: record.id, mode: 'view', history: '1', from: 'periodDetail' } });
  }
  const loading = ref(false), error = ref(''), page = ref(1);
  let sequence = 0;
  const pageRows = computed(() => rows.value.slice((page.value - 1) * 10, page.value * 10));
  const columns = [
    { title: '提交轮次', key: 'round', width: 160 }, { title: '提交人', dataIndex: 'submitUserName', width: 110 },
    { title: '提交时间', dataIndex: 'submitTime', width: 180 }, { title: '审批状态', key: 'status', width: 110 },
    { title: '审批人', dataIndex: 'approvalUserName', width: 110 }, { title: '审批时间', dataIndex: 'approvalTime', width: 180 },
    { title: '审批意见', dataIndex: 'approvalReason', width: 220 }, { title: '操作', key: 'action', width: 100, fixed: 'right' as const },
  ];
  async function load() {
    const request = ++sequence;
    rows.value = []; state.value = undefined; page.value = 1; error.value = '';
    if (!props.periodId || !user.getToken) { loading.value = false; return; }
    loading.value = true;
    try {
      const [current, history] = await Promise.all([getPeriodApprovalState(props.periodId), getPeriodApprovalHistory(props.periodId)]);
      if (request !== sequence) return;
      state.value = current;
      rows.value = [...history].sort((a, b) => Number(b.roundNo) - Number(a.roundNo));
    } catch (e: any) { if (request === sequence) error.value = e?.message || '计划审批记录加载失败，请重试'; }
    finally { if (request === sequence) loading.value = false; }
  }
  watch(() => [props.periodId, user.getToken], load, { immediate: true });
  onBeforeUnmount(() => { sequence++; });
</script>

<style scoped lang="less">
  .plan-history__heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
  .plan-history h3 { font-size: 16px; font-weight: 600; margin: 0; }
  .plan-history__pagination { margin-top: 16px; }
</style>
