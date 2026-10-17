<template>
  <DutyRosterEditor v-if="editingMonth" :key="editingMonth" :month="editingMonth" @back="backToList" />
  <div v-else class="roster-list">
    <header class="list-heading">
      <div><h1>运维值班表</h1><p>按月管理排班，支持规则生成、人工调整与导出。</p></div>
      <a-button v-if="canAdd" type="primary" @click="showCreate = true"
        ><template #icon><Icon icon="ant-design:plus-outlined" /></template>新增排班</a-button
      >
    </header>
    <a-alert type="info" show-icon message="更新时间、创建人、更新人待接口补充。" class="mock-note" />
    <section class="list-panel">
      <div class="filters">
        <div
          ><label for="roster-month">月份</label
          ><a-date-picker id="roster-month" v-model:value="month" picker="month" :allow-clear="false" format="YYYY年MM月"
        /></div>
        <a-button type="primary" :loading="loading" @click="search">查询</a-button><a-button @click="reset">重置</a-button>
      </div>
      <a-alert v-if="error" type="error" show-icon :message="error" />
      <a-table
        :columns="columns"
        :data-source="rows"
        row-key="month"
        :loading="loading"
        :scroll="{ x: 760 }"
        :pagination="{ current: currentPage, pageSize, showSizeChanger: true, showTotal: (total) => `共 ${total} 个月` }"
        :locale="{ emptyText: '暂无排班，点击上方新增排班创建' }"
        @change="onPageChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'month'"
            ><strong>{{ dayjs(record.month).format('YYYY年MM月') }}</strong></template
          >
          <template v-else-if="['updatedAt', 'createdBy', 'updatedBy'].includes(column.dataIndex)">—</template>
          <template v-else-if="column.key === 'action'">
            <a-space
              ><a-button type="link" @click="editingMonth = record.month">{{ canEdit ? '编辑' : '查看' }}</a-button>
              <a-button v-if="canExport" type="link" :loading="exporting === record.month" :disabled="!!exporting" @click="exportMonth(record.month)"
                >导出</a-button
              ></a-space
            >
          </template>
        </template>
      </a-table>
    </section>
    <a-modal v-model:visible="showCreate" title="新增月度排班" ok-text="创建排班" cancel-text="取消" :confirm-loading="creating" @ok="createRoster">
      <label for="create-month" class="create-label">排班月份</label>
      <a-date-picker id="create-month" v-model:value="newMonth" picker="month" :allow-clear="false" format="YYYY年MM月" style="width: 100%" />
      <p class="create-hint">已有排班的月份将直接进入编辑，保存后出现在列表中。</p>
    </a-modal>
  </div>
</template>
<script setup lang="ts">
  import { onMounted, ref } from 'vue';
  import dayjs, { type Dayjs } from 'dayjs';
  import { Icon } from '/@/components/Icon';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { useDutyRosterPermissions } from './dutyRoster.permissions';
  import DutyRosterEditor from './DutyRosterEditor.vue';
  import { listDutyRosters } from './dutyRoster.api';
  import type { DutyRosterResult } from './dutyRoster.store';
  import { exportDutyRosterExcel } from './dutyRosterExcel';
  defineOptions({ name: 'OperationDutyRoster' });
  const { createMessage } = useMessage();
  const month = ref<Dayjs>(dayjs());
  const rows = ref<DutyRosterResult[]>([]);
  const editingMonth = ref('');
  const loading = ref(false);
  const { canAdd, canEdit, canExport } = useDutyRosterPermissions();
  let requestId = 0;
  const error = ref('');
  const showCreate = ref(false);
  const creating = ref(false);
  const newMonth = ref<Dayjs>(dayjs());
  const exporting = ref('');
  const currentPage = ref(1);
  const pageSize = ref(10);
  let appliedMonth = dayjs().format('YYYY-MM');
  const columns = [
    { title: '月份', dataIndex: 'month', width: 160 },
    { title: '更新时间', dataIndex: 'updatedAt', width: 210 },
    { title: '创建人', dataIndex: 'createdBy', width: 150 },
    { title: '更新人', dataIndex: 'updatedBy', width: 150 },
    { title: '操作', key: 'action', width: 160 },
  ];
  async function load() {
    const request = ++requestId;
    loading.value = true;
    error.value = '';
    try {
      const result = await listDutyRosters(appliedMonth);
      if (request === requestId) rows.value = result;
    } catch (e) {
      if (request !== requestId) return;
      error.value = (e as Error).message;
      rows.value = [];
    } finally {
      if (request === requestId) loading.value = false;
    }
  }
  function search() {
    appliedMonth = month.value.format('YYYY-MM');
    currentPage.value = 1;
    void load();
  }
  function reset() {
    month.value = dayjs();
    search();
  }
  function backToList() {
    editingMonth.value = '';
    void load();
  }
  function createRoster() {
    if (!canAdd.value) return;
    if (!newMonth.value) {
      createMessage.warning('请选择排班月份');
      return;
    }
    editingMonth.value = newMonth.value.format('YYYY-MM');
    showCreate.value = false;
  }
  function onPageChange(page: { current?: number; pageSize?: number }) {
    currentPage.value = page.current || 1;
    pageSize.value = page.pageSize || 10;
  }
  async function exportMonth(value: string) {
    if (!canExport.value) return;
    exporting.value = value;
    try {
      await exportDutyRosterExcel(value);
    } catch (e) {
      createMessage.error((e as Error).message);
    } finally {
      exporting.value = '';
    }
  }
  onMounted(load);
</script>
<style scoped lang="less">
  .roster-list {
    padding: 24px;
    color: #25364e;
  }
  .list-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 20px;
  }
  h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
  }
  .list-heading p {
    margin: 8px 0 0;
    color: #596a80;
  }
  .mock-note {
    margin-bottom: 16px;
  }
  .list-panel {
    background: #fff;
    border: 1px solid #e5eaf0;
    border-radius: 12px;
    overflow: hidden;
  }
  .filters {
    display: flex;
    align-items: end;
    gap: 12px;
    padding: 24px;
    flex-wrap: wrap;
  }
  .filters label,
  .create-label {
    display: block;
    margin-bottom: 8px;
    color: #34445a;
  }
  .filters :deep(.ant-picker),
  .filters :deep(.ant-select) {
    width: 180px;
  }
  .create-hint {
    margin-top: 12px;
    color: #596a80;
  }
  :deep(.ant-table-thead > tr > th) {
    background: #f7f9fc;
    color: #4b5b70;
  }
  :deep(.ant-table-pagination) {
    margin: 16px 24px;
  }
  :deep(:focus-visible) {
    outline: 2px solid #1677ff;
    outline-offset: 2px;
  }
  @media (max-width: 640px) {
    .roster-list {
      padding: 14px;
    }
    .filters {
      padding: 16px;
    }
    .list-heading {
      align-items: flex-start;
      flex-wrap: wrap;
    }
  }
</style>
