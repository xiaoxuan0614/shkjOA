<template>
  <div class="submission-detail">
    <header class="submission-detail__header">
      <a-space wrap>
        <a-button type="link" preIcon="ant-design:arrow-left-outlined" @click="back">返回</a-button>
        <h2>计划方案详情</h2>
        <template v-if="record"><span>第 {{ record.roundNo }} 轮</span><a-tag :color="getApprovalStatusMeta(record.approvalStatus).color">{{ getApprovalStatusMeta(record.approvalStatus).text }}</a-tag></template>
      </a-space>
      <a-tag>提交版本 · 只读</a-tag>
    </header>
    <a-spin :spinning="loading">
      <section class="submission-detail__content">
        <a-alert v-if="error" type="error" show-icon :message="error"><template #action><a-button size="small" @click="load">重试</a-button></template></a-alert>
        <template v-else-if="record">
          <a-descriptions :column="{ xs: 1, sm: 2, lg: 3 }" size="small">
            <a-descriptions-item label="提交人">{{ record.submitUserName || '—' }}</a-descriptions-item>
            <a-descriptions-item label="提交时间">{{ record.submitTime || '—' }}</a-descriptions-item>
            <a-descriptions-item label="审批人">{{ record.approvalUserName || '—' }}</a-descriptions-item>
            <a-descriptions-item label="审批时间">{{ record.approvalTime || '—' }}</a-descriptions-item>
            <a-descriptions-item label="审批意见 / 驳回原因">{{ record.approvalReason || '—' }}</a-descriptions-item>
            <a-descriptions-item v-if="String(record.approvalStatus) === '3'" label="撤回信息">{{ record.withdrawUserName || '—' }} / {{ record.withdrawTime || '—' }} {{ record.withdrawReason || '' }}</a-descriptions-item>
          </a-descriptions>
          <a-alert v-if="!snapshot" type="warning" show-icon message="本轮提交快照缺失或格式不支持，无法展示提交内容。" />
          <template v-else>
            <p class="submission-detail__note">以下为本轮提交时保存的方案，不代表当前最新计划。历史快照未保存用料、人员、位置和回款明细。</p>
            <a-tabs v-model:activeKey="activeTab">
              <a-tab-pane key="file" tab="方案文件">
                <a-table :columns="fileColumns" :data-source="snapshot.plans" :pagination="false" :scroll="{ x: 720 }" size="middle">
                  <template #bodyCell="{ column, record: item }"><template v-if="column.key === 'file'"><a-button v-if="item.planFileId || item.fileId" type="link" @click="previewFileInModal(String(item.planFileId || item.fileId), String(item.fileName || item.planName || '方案文件'))">预览文件</a-button><span v-else>—</span></template><template v-else>{{ item[column.dataIndex] || '—' }}</template></template>
                </a-table>
              </a-tab-pane>
              <a-tab-pane key="implement" tab="实施计划">
                <a-descriptions v-for="(item, index) in snapshot.period" :key="index" bordered size="small" :column="{ xs: 1, sm: 2 }">
                  <a-descriptions-item label="计划验收日期">{{ formatDate(item.plannedAcceptanceDate) }}</a-descriptions-item>
                  <a-descriptions-item label="验收标准">{{ item.acceptanceStandard || '—' }}</a-descriptions-item>
                </a-descriptions>
                <h3>施工工序</h3>
                <a-table :columns="processColumns" :data-source="displayProcesses" :pagination="false" :scroll="{ x: 760 }" size="middle">
                  <template #bodyCell="{ column, record: item }"><DictValue v-if="column.dataIndex === 'processName'" code="work_type" :value="item.processName" /><template v-else-if="column.dataIndex === 'plannedStartTime' || column.dataIndex === 'plannedEndTime'">{{ formatDate(item[column.dataIndex]) }}</template><template v-else>{{ item[column.dataIndex] || '未记录' }}</template></template>
                </a-table>
              </a-tab-pane>
            </a-tabs>
          </template>
        </template>
      </section>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, watch, onBeforeUnmount } from 'vue';
  import { useRouter } from 'vue-router';
  import dayjs from 'dayjs';
  import DictValue from '/@/components/DictValue.vue';
  import { useTabs } from '/@/hooks/web/useTabs';
  import { useUserStore } from '/@/store/modules/user';
  import { getApprovalStatusMeta } from '/@/utils/approvalStatus';
  import { previewFileInModal } from '/@/utils/filePreview';
  import { getPeriodApprovalHistory, getSnapshotLeaderNames } from './PeriodApproval.api';
  import { parseApprovalSnapshot, type PeriodApprovalRecord } from './periodApproval';
  const props = defineProps<{ periodId: string; approvalId: string }>();
  const router = useRouter(), user = useUserStore();
  const { setTitle } = useTabs();
  void setTitle('计划方案详情');
  function formatDate(value: unknown) {
    if (value == null || value === '') return '—';
    const date = dayjs(typeof value === 'number' ? value : String(value));
    return date.isValid() ? date.format('YYYY-MM-DD') : '—';
  }
  const record = ref<PeriodApprovalRecord>(), loading = ref(false), error = ref(''), activeTab = ref('file');
  let sequence = 0;
  const leaderNames = ref<Record<string, string>>({});
  const displayProcesses = computed(() => (snapshot.value?.processes || []).map(row => ({
    ...row,
    siteLeaderName: row.siteLeaderName || leaderNames.value[String(row.siteLeaderId)] || (row.siteLeaderId ? `姓名未获取（${row.siteLeaderId}）` : '未记录'),
  })));
  const snapshot = computed(() => {
    const value = parseApprovalSnapshot(record.value?.submittedSnapshot);
    if (!value || !Object.values(value).every(rows => Array.isArray(rows) && rows.every(row => row && typeof row === 'object' && !Array.isArray(row)))) return null;
    const normalize = (rows: Record<string, unknown>[]) => rows.map(row => Object.fromEntries(Object.entries(row).map(([key, field]) => [key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()), field])));
    return { period: normalize(value.period), plans: normalize(value.plans), processes: normalize(value.processes) };
  });
  const fileColumns = [{ title: '方案名称', dataIndex: 'planName', width: 260 }, { title: '方案文件', key: 'file', width: 140 }, { title: '备注', dataIndex: 'remark' }];
  const processColumns = [{ title: '工序名称', dataIndex: 'processName', width: 220 }, { title: '计划开始时间', dataIndex: 'plannedStartTime', width: 180 }, { title: '计划结束时间', dataIndex: 'plannedEndTime', width: 180 }, { title: '现场负责人', dataIndex: 'siteLeaderName', width: 180 }];
  function back() { router.push({ path: `/project/detail/${props.periodId}`, query: { tab: 'plan' } }); }
  async function load() {
    const request = ++sequence;
    record.value = undefined; leaderNames.value = {}; error.value = ''; activeTab.value = 'file'; loading.value = false;
    if (!props.periodId || !props.approvalId) { error.value = '缺少分期或提交记录编号，请返回重新选择'; return; }
    if (!user.getToken) { error.value = '登录状态已失效，请重新登录'; return; }
    loading.value = true;
    try {
      const rows = await getPeriodApprovalHistory(props.periodId);
      if (request !== sequence) return;
      record.value = rows.find(row => String(row.id) === props.approvalId && String(row.periodId) === props.periodId);
      if (!record.value) error.value = '未找到该轮提交记录，请返回审批记录重新选择';
      const ids = [...new Set((snapshot.value?.processes || []).filter(row => !row.siteLeaderName && row.siteLeaderId).map(row => String(row.siteLeaderId)))];
      if (ids.length) {
        try {
          const names = await getSnapshotLeaderNames(ids, props.periodId);
          if (request === sequence) leaderNames.value = names;
        } catch { /* 姓名不可见或查询失败时保留快照ID，不能误显示为未设置负责人。 */ }
      }
    } catch (e: any) { if (request === sequence) error.value = e?.message || '计划方案详情加载失败，请重试'; }
    finally { if (request === sequence) loading.value = false; }
  }
  watch(() => [props.periodId, props.approvalId, user.getToken], load, { immediate: true });
  onBeforeUnmount(() => { sequence++; });
</script>

<style scoped lang="less">
  .submission-detail { padding: 16px; }
  .submission-detail__header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; padding: 16px; margin-bottom: 16px; background: @component-background; }
  .submission-detail h2, .submission-detail h3 { font-size: 16px; font-weight: 600; margin: 0; }
  .submission-detail h3 { margin: 24px 0 12px; }
  .submission-detail__content { padding: 20px; min-height: 240px; background: @component-background; overflow-wrap: anywhere; }
  .submission-detail__note { margin: 16px 0; color: @text-color-secondary; }
</style>
