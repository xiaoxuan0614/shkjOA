<template>
  <BasicTable @register="registerTable">
    <template #action="{ record }"><slot name="action" :record="record" /></template>
    <template #bodyCell="{ column, record }"><slot name="bodyCell" :column="column" :record="record" /></template>
  </BasicTable>
</template>

<script lang="ts" setup>
  import { BasicTable, useTable } from '/@/components/Table';
  import { quotationList } from '../Plan.api';
  import { quotationColumns } from '../Plan.data';

  const props = defineProps<{ periodId: string }>();
  const [registerTable] = useTable({
    api: (params) => quotationList({ ...params, periodId: props.periodId }),
    rowKey: 'id',
    columns: quotationColumns.filter((column) => !['projectName', 'periodName'].includes(String(column.dataIndex))),
    useSearchForm: false,
    showTableSetting: false,
    canResize: false,
    pagination: { pageSize: 10 },
    actionColumn: { width: 390, fixed: 'right', title: '操作', dataIndex: 'action', slots: { customRender: 'action' } },
  });
</script>
