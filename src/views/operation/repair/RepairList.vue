<template>
  <div>
    <BasicTable @register="registerTable" :row-selection="null">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'"><a-button type="link" @click="selectedId = String(record.id)">查看详情</a-button></template>
        <template v-else-if="column.dataIndex === 'projectName'">{{ projectName(record) }}</template>
        <template v-else-if="column.dataIndex === 'workStatus'"><a-tag>{{ workStates[record.workStatus] || display(record.workStatus) }}</a-tag></template>
        <template v-else-if="column.dataIndex === 'quotationStatus'"><DictValue code="repair_quotation_status" :value="record.quotationStatus" /></template>
        <template v-else>{{ display(record[column.dataIndex]) }}</template>
      </template>
    </BasicTable>
    <RepairDetail :id="selectedId" @close="selectedId = ''" />
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { BasicTable, type BasicColumn } from '/@/components/Table';
import { useListPage } from '/@/hooks/system/useListPage';
import { type FormSchema } from '/@/components/Form';
import { display, projectName, listRepairs, workStates } from './repair.api';
import DictValue from '/@/components/DictValue.vue';
import RepairDetail from './RepairDetail.vue';
const props = defineProps<{ reports?: boolean }>();
const selectedId = ref('');
const columns: BasicColumn[] = [
  { title: '工单编号', dataIndex: 'orderNo', width: 200 },
  { title: '客户', dataIndex: 'customerNameSnapshot', width: 180 },
  { title: '项目 / 分期', dataIndex: 'projectName', width: 220 },
  { title: '故障现象', dataIndex: 'faultDescription', width: 240 },
  { title: '状态', dataIndex: 'workStatus', width: 110 },
  { title: '当前负责人', dataIndex: 'responsibleUserName', width: 130 },
  { title: '报修人', dataIndex: 'reporterName', width: 120 },
  { title: '报修时间', dataIndex: 'reportTime', width: 190 },
  { title: '报价状态', dataIndex: 'quotationStatus', width: 130 },
  { title: '操作', key: 'action', width: 100, fixed: 'right' },
];
const schemas: FormSchema[] = [
  { field: 'scope', label: '记录范围', component: 'Select', defaultValue: props.reports ? 'REPORTED' : 'ALL', componentProps: { allowClear: false, options: [{ value: 'ALL', label: '全部可见' }, { value: 'REPORTED', label: '本人报修' }, { value: 'RESPONSIBLE', label: '本人负责' }, { value: 'HELPING', label: '本人内协' }, { value: 'HISTORY', label: '历史负责' }] }, colProps: { span: 8 } },
  { field: 'workStatus', label: '维修状态', component: 'Select', componentProps: { allowClear: true, options: Object.entries(workStates).map(([value, label]) => ({ value, label })) }, colProps: { span: 8 } },
];
const { tableContext } = useListPage({ tableProps: {
  title: props.reports ? '报修记录' : '维修记录', rowKey: 'id', columns, showIndexColumn: false, showActionColumn: false,
  api: params => listRepairs(params, props.reports ? 'REPORTED' : 'ALL'),
  formConfig: { schemas, labelWidth: 80, showAdvancedButton: false }, scroll: { x: 1620 },
} });
const [registerTable] = tableContext;
</script>
