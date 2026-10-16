<template>
  <a-alert v-if="!allowed" type="warning" show-icon message="仅管理员或财务人员可查看和登记回款、发票。" />
  <div v-else>
    <div v-show="!selected">
      <a-alert v-if="listError" type="error" :message="listError" show-icon><template #action><a-button @click="reload()">重新加载</a-button></template></a-alert>
      <BasicTable @register="registerTable">
        <template #action="{ record }"><a-space :size="0">
          <a-button type="link" @click="selected = record">查看详情</a-button>
          <a-button type="link" @click="entry?.open(record, 'receipt')">添加回款</a-button>
          <a-button type="link" @click="entry?.open(record, 'invoice')">添加发票</a-button>
        </a-space></template>
        <template #bodyCell="{ column, record }">
          <template v-if="amountKeys.includes(column.dataIndex)">{{ record[column.dataIndex] ?? '—' }}</template>
          <template v-else-if="column.dataIndex === 'salesUserName'">{{ record.salesUserName || '—' }}</template>
          <template v-else-if="column.dataIndex === 'receiptStatus'"><DictValue :value="record.receiptStatus" :options="receiptStatusOptions" fallback="—" /></template>
          <template v-else-if="column.dataIndex === 'invoiceStatus'"><DictValue :value="record.invoiceStatus" :options="invoiceStatusOptions" fallback="—" /></template>
        </template>
      </BasicTable>
    </div>
    <FinanceDetail v-if="selected" :period-id="selected.periodId" :context="selected" @back="selected = null" @changed="updateSummary" />
    <FinanceEntryDrawer ref="entry" @saved="refreshRow" />
  </div>
</template>
<script setup lang="ts">
  import { computed, onBeforeUnmount, ref, watch } from 'vue';
  import { BasicTable } from '/@/components/Table';
  import { useListPage } from '/@/hooks/system/useListPage';
  import { useUserStore } from '/@/store/modules/user';
  import { canRequestFinance } from './receiptModel';
  import { financePeriods, type ReceiptSummary } from './Receipt.api';
  import FinanceDetail from './FinanceDetail.vue';
  import FinanceEntryDrawer from './FinanceEntryDrawer.vue';
  import { loadDictOptions } from '/@/views/project/Project.data';
  import DictValue from '/@/components/DictValue.vue';
  const user = useUserStore();
  const allowed = computed(() => !!user.getIdentity.userId && canRequestFinance(user.getIdentity.roleCodes));
  const selected = ref<any>(null), rows = ref<any[]>([]), listError = ref('');
  const entry = ref<InstanceType<typeof FinanceEntryDrawer>>();
  const amountKeys = ['plannedAmount', 'receivedAmount', 'remainingAmount', 'invoicedAmount'];
  const receiptStatusOptions = ref<any[]>([]);
  const invoiceStatusOptions = ref<any[]>([]);
  // 每次挂载加载一次，不随列表分页逐行查询字典。
  Promise.all([loadDictOptions('payment_status'), loadDictOptions('invoice_status')]).then(([receipt, invoice]) => {
    receiptStatusOptions.value = receipt;
    invoiceStatusOptions.value = invoice;
  });
  let sequence = 0;
  const { tableContext } = useListPage({ tableProps: {
    title: '回款管理', rowKey: 'periodId',
    api: async (params) => {
      const seq = ++sequence; listError.value = '';
      if (!allowed.value) return { records: [], total: 0 };
      try {
        const data: any = await financePeriods(params);
        if (seq !== sequence) return { records: [], total: 0 };
        if (!Array.isArray(data?.records)) throw new Error('回款汇总列表格式异常');
        const records = data.records.map(r => ({ ...r, projectLabel: [r.projectName, r.periodName].filter(Boolean).join('-') || '—' }));
        rows.value = records;
        return { ...data, records };
      } catch (e: any) { if (seq === sequence) listError.value = e.message || '列表加载失败'; return { records: [], total: 0 }; }
    },
    columns: [
      { title: '主项目名称-分期名称', dataIndex: 'projectLabel', width: 280 }, { title: '甲方', dataIndex: 'customerName', width: 180 },
      { title: '销售负责人', dataIndex: 'salesUserName', width: 130 },
      { title: '回款状态', dataIndex: 'receiptStatus', width: 110 },
      { title: '开票状态', dataIndex: 'invoiceStatus', width: 110 },
      { title: '计划回款金额', dataIndex: 'plannedAmount', width: 140 }, { title: '已回款金额', dataIndex: 'receivedAmount', width: 130 },
      { title: '剩余应回款', dataIndex: 'remainingAmount', width: 130 }, { title: '已开票金额', dataIndex: 'invoicedAmount', width: 130 },
    ],
    formConfig: {
      schemas: [
        { field: 'keyword', label: '项目名称', component: 'Input', componentProps: { placeholder: '主项目名称-分期名称', allowClear: true, maxlength: 200 } },
        { field: 'customerName', label: '甲方名称', component: 'Input', componentProps: { placeholder: '请输入甲方名称', allowClear: true, maxlength: 200 } },
        { field: 'receiptStatus', label: '回款状态', component: 'JDictSelectTag', componentProps: { dictCode: 'payment_status', placeholder: '全部回款状态', allowClear: true, useDicColor: true } },
        { field: 'invoiceStatus', label: '开票状态', component: 'JDictSelectTag', componentProps: { dictCode: 'invoice_status', placeholder: '全部开票状态', allowClear: true, useDicColor: true } },
      ],
      autoSubmitOnEnter: true,
    },
    actionColumn: { width: 320, fixed: 'right' },
  } });
  const [registerTable, { reload, setTableData }] = tableContext;
  function updateSummary(summary: ReceiptSummary) { const row = rows.value.find(r => r.periodId === summary.periodId); if (row) { for (const key of amountKeys) row[key] = summary[key]; setTableData(rows.value); } refreshRow(summary); }
  async function refreshRow(event: { periodId: string }) {
    const seq = sequence;
    try {
      const data: any = await financePeriods({ periodId: event.periodId, pageNo: 1, pageSize: 1 });
      if (seq !== sequence) return;
      const latest = data.records?.find(r => r.periodId === event.periodId);
      if (!latest) throw new Error('未返回分期财务汇总');
      const row = rows.value.find(r => r.periodId === event.periodId);
      if (row) { Object.assign(row, latest); setTableData(rows.value); }
    }
    catch { listError.value = '登记成功，但汇总刷新失败，请刷新列表核对，勿重复登记。'; }
  }
  watch(() => user.getIdentity.userId, () => { sequence++; selected.value = null; rows.value = []; });
  onBeforeUnmount(() => { sequence++; });
</script>
