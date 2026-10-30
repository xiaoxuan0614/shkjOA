<template>
  <div class="roster-list">
    <a-drawer v-model:open="showRest" title="休息与转派" width="min(1100px, 100vw)" :destroy-on-close="true" :closable="!restLocked" :mask-closable="false" :keyboard="false"><RestAssignment @lock-change="restLocked=$event" /></a-drawer>
    <BasicTable @register="registerTable" :row-selection="null">
      <template #tableTitle>
        <a-button v-if="restAccess" class="mr-2" @click="showRest = true">休息与转派</a-button>
        <a-button v-if="canAdd" type="primary" preIcon="ant-design:plus-outlined" @click="showCreate = true">新增</a-button>
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'month'"
          ><span>{{ dayjs(record.month).format('YYYY年MM月') }}</span></template
        >
        <template v-else-if="column.dataIndex === 'updateTime'">{{ record.updateTime || '—' }}</template>
        <template v-else-if="column.dataIndex === 'createByName'">{{ record.createByName || record.createBy || '—' }}</template>
        <template v-else-if="column.dataIndex === 'updateByName'">{{ record.updateByName || record.updateBy || '—' }}</template>
        <template v-else-if="column.key === 'action'">
          <a-space
            ><a-button type="link" @click="openDetail(record.month)">{{ canEdit ? '编辑' : '查看' }}</a-button>
            <a-button v-if="canExport" type="link" :loading="exporting === record.month" :disabled="!!exporting" @click="exportMonth(record.month)"
              >导出</a-button
            ></a-space
          >
        </template>
      </template>
    </BasicTable>
    <a-modal v-model:open="showCreate" title="新增月度排班" ok-text="创建排班" cancel-text="取消" :confirm-loading="creating" @ok="createRoster">
      <label for="create-month" class="create-label">排班月份</label>
      <a-date-picker id="create-month" v-model:value="newMonth" picker="month" :allow-clear="false" format="YYYY年MM月" style="width: 100%" />
    </a-modal>
  </div>
</template>
<script setup lang="ts">
  import RestAssignment from '../rest-assignment/RestAssignment.vue';
  import { ref, onMounted } from 'vue';
  import { restApi } from '../rest-assignment/restAssignment.api';
  const restAccess=ref(false),restLocked=ref(false);
  onMounted(async()=>{try{restAccess.value=(await restApi('GET','/repair/rest/options')).canManage===true;}catch{restAccess.value=false;}});
  import { useRouter } from 'vue-router';
  import dayjs, { type Dayjs } from 'dayjs';
  import { BasicTable, type BasicColumn } from '/@/components/Table';
  import { type FormSchema } from '/@/components/Form';
  import { useListPage } from '/@/hooks/system/useListPage';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { useDutyRosterPermissions } from './dutyRoster.permissions';
  import { listDutyRosters } from './dutyRoster.api';
  import { exportDutyRosterExcel } from './dutyRosterExcel';
  defineOptions({ name: 'OperationDutyRoster' });
  const { createMessage } = useMessage();
  const searchSchemas: FormSchema[] = [
    {
      field: 'month',
      label: '月份',
      component: 'DatePicker',
      componentProps: { picker: 'month', format: 'YYYY年MM月', allowClear: true, placeholder: '全部月份' },
      colProps: { span: 8 },
    },
  ];
  const router = useRouter();
  const { canAdd, canEdit, canExport } = useDutyRosterPermissions();
  const showRest = ref(false);
  const showCreate = ref(false);
  const creating = ref(false);
  const newMonth = ref<Dayjs>(dayjs());
  const exporting = ref('');
  const columns: BasicColumn[] = [
    { title: '月份', dataIndex: 'month', width: 160 },
    { title: '更新时间', dataIndex: 'updateTime', width: 210 },
    { title: '创建人', dataIndex: 'createByName', width: 150 },
    { title: '更新人', dataIndex: 'updateByName', width: 150 },
    { title: '操作', key: 'action', width: 160 },
  ];
  const { tableContext } = useListPage({
    tableProps: {
      immediate: true,
      rowKey: 'id',
      columns,
      showIndexColumn: false,
      showActionColumn: false,
      canResize: true,
      api: (params) => listDutyRosters(params.month ? dayjs(params.month).format('YYYY-MM') : undefined, params.pageNo, params.pageSize),
      formConfig: { schemas: searchSchemas, labelWidth: 80, showAdvancedButton: false, autoSubmitOnEnter: true },
      scroll: { x: 760 },
    },
  });
  const [registerTable] = tableContext;
  function openDetail(month: string) {
    return router.push({ path: '/operation/detail', query: { month } });
  }
  function createRoster() {
    if (!canAdd.value) return;
    if (!newMonth.value) {
      createMessage.warning('请选择排班月份');
      return;
    }
    void openDetail(newMonth.value.format('YYYY-MM'));
    showCreate.value = false;
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
</script>
<style scoped lang="less">
  .create-label {
    display: block;
    margin-bottom: 8px;
  }
  .create-hint {
    margin-top: 12px;
    color: @text-color-secondary;
  }
</style>
