<template>
  <div>
    <a-alert v-if="loadError" type="error" :message="loadError" show-icon class="mb-3">
      <template #action><a-button size="small" @click="reload()">重试</a-button></template>
    </a-alert>
    <BasicTable @register="registerTable">
      <template #action="{ record }">
        <TableAction :actions="[{ label: '查看详情', disabled: !record.id, onClick: () => handleView(record) }]" />
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'status'">
          <a-tag :color="quotationListStatusMap[record.status]?.color || 'default'">
            {{ quotationListStatusMap[record.status]?.text || record.status || '—' }}
          </a-tag>
        </template>
        <template v-else-if="column.dataIndex === 'adopted'">
          <a-tag :color="isQuotationAdopted(record) ? 'success' : 'default'">{{ isQuotationAdopted(record) ? '已采用' : '未采用' }}</a-tag>
        </template>
      </template>
    </BasicTable>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import { useRouter } from 'vue-router';
  import { BasicTable, TableAction, useTable } from '/@/components/Table';
  import { quotationList, isQuotationAdopted } from '/@/views/plan/Plan.api';
  import { quotationColumns, quotationListStatusMap } from '/@/views/plan/Plan.data';

  const props = defineProps<{ periodId: string }>();
  const router = useRouter();
  function handleView(record: Recordable) {
    if (!record.id || !props.periodId.trim()) return;
    router.push({
      path: '/plan/material-draft/editor',
      query: {
        mode: 'view', from: 'project-detail', periodId: props.periodId, candidateId: String(record.id),
        candidateName: record.candidateName, status: record.status, version: record.version,
        adopted: record.adopted, priced: record.priced, createBy: record.createBy,
      },
    });
  }
  const loadError = ref('');
  const [registerTable, { reload }] = useTable({
    title: '报价信息',
    rowKey: 'id',
    actionColumn: { title: '操作', dataIndex: 'action', width: 120, fixed: 'right', slots: { customRender: 'action' } },
    api: async (params) => {
      loadError.value = '';
      // list 不传 periodId 会查询全部报价，详情页必须限制为当前分期。
      if (!props.periodId.trim()) return { records: [], total: 0 };
      try {
        return await quotationList({ ...params, periodId: props.periodId });
      } catch (error) {
        loadError.value = '报价信息加载失败，请重试';
        throw error;
      }
    },
    columns: quotationColumns.filter((column) => !['projectName', 'periodName'].includes(String(column.dataIndex))),
    useSearchForm: false,
    showTableSetting: false,
    canResize: false,
    pagination: { pageSize: 10 },
  });
</script>
