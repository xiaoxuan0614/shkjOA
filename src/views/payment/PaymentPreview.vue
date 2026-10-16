<template>
  <div>
    <a-alert v-show="!selected" type="warning" show-icon message="本地模拟数据 · 仅供页面预览，不是真实合同或回款" description="按当前账号可见分期生成样例，金额、日期和回款状态均为虚构；不写入后端。" />
    <div v-show="!selected">
    <BasicTable @register="registerTable">
      <template #action="{ record }">
        <a-space :size="0">
          <a-button type="link" @click="selected = cached(record)">查看详情</a-button>
          <a-button type="link" @click="actions?.open(cached(record), 'payment')">添加回款</a-button>
          <a-button type="link" @click="actions?.open(cached(record), 'invoice')">添加发票</a-button>
        </a-space>
      </template>
    </BasicTable>
    </div>
    <a-card v-if="selected" class="payment-detail" :bordered="false">
      <div class="detail-header">
        <h2>回款详情</h2>
        <a-button @click="selected = null">返回列表</a-button>
      </div>
      <template v-if="selected">
        <a-alert type="warning" show-icon message="以下均为模拟数据，刷新或离开预览后重置，不修改真实回款。" />
        <a-descriptions :column="2" bordered size="small" style="margin: 16px 0">
          <a-descriptions-item label="项目名称" :span="2">{{ selected.projectLabel }}</a-descriptions-item>
          <a-descriptions-item label="合同编号" :span="2">{{ selected.contractNo }}</a-descriptions-item>
          <a-descriptions-item label="合同类型">{{ selected.contractType }}</a-descriptions-item>
          <a-descriptions-item label="甲方">{{ selected.customerName }}</a-descriptions-item>
          <a-descriptions-item label="负责人">{{ selected.owner }}</a-descriptions-item>
          <a-descriptions-item label="模拟签订日期">{{ selected.signDate }}</a-descriptions-item>
          <a-descriptions-item label="模拟合同金额">{{ selected.contractAmount }}</a-descriptions-item>
          <a-descriptions-item label="回款状态">{{ selected.paymentStatus }}</a-descriptions-item>
          <a-descriptions-item label="已回款金额">{{ selected.receivedAmount }}</a-descriptions-item>
          <a-descriptions-item label="未回款金额">{{ selected.unpaidAmount }}</a-descriptions-item>
        </a-descriptions>
        <div class="section-title"><h3>回款记录</h3><a-button type="primary" @click="actions?.open(selected, 'payment')">添加回款</a-button></div>
        <a-table row-key="id" :columns="recordColumns" :data-source="paymentRows" :pagination="false" :scroll="{ x: 900 }" bordered size="small" />
        <div class="section-title"><h3>发票信息</h3><a-button @click="actions?.open(selected, 'invoice')">添加发票</a-button></div>
        <a-table row-key="id" :columns="invoiceColumns" :data-source="selected.invoices" :pagination="false" :scroll="{ x: 800 }" bordered size="small" />
      </template>
    </a-card>
    <PaymentPreviewActions ref="actions" @saved="onSaved" />
  </div>
</template>
<script setup lang="ts">
  import { computed, reactive, ref } from 'vue';
  import { BasicTable } from '/@/components/Table';
  import { useListPage } from '/@/hooks/system/useListPage';
  import { projectList } from '/@/views/project/Project.api';
  import { makePaymentPreview } from './paymentPreview';
  import PaymentPreviewActions from './PaymentPreviewActions.vue';
  import { useMessage } from '/@/hooks/web/useMessage';

  const actions = ref<InstanceType<typeof PaymentPreviewActions>>();
  const cache = reactive(new Map<string, ReturnType<typeof makePaymentPreview>>());
  let pageIds: string[] = [];
  const cached = (row) => cache.get(row.periodId)!;
  const { createMessage } = useMessage();
  function onSaved() {
    setTableData(pageIds.map((id) => cache.get(id)!));
    createMessage.success('已模拟保存，仅当前预览有效');
  }

  const selected = ref<ReturnType<typeof makePaymentPreview> | null>(null);
  const paymentRows = computed(() => selected.value?.records.flatMap((plan) => {
    const payments = plan.payments.length ? plan.payments : [{ id: 'empty', date: '—', amount: null, remark: '暂无回款记录' }];
    return payments.map((payment, index) => ({ ...plan, id: `${plan.id}-${payment.id}`, paymentDate: payment.date, paymentAmount: payment.amount, remark: payment.remark, span: index === 0 ? payments.length : 0 }));
  }) || []);
  const merged = (record) => ({ rowSpan: record.span });
  const recordColumns = [
    { title: '回款类型', dataIndex: 'type', width: 100 },
    { title: '计划回款金额', dataIndex: 'planAmount', width: 120 },
    { title: '已回款金额', dataIndex: 'paidAmount', width: 110 },
    { title: '未回款金额', dataIndex: 'unpaidAmount', width: 110 },
    { title: '计划回款日期', dataIndex: 'planDate', width: 120 },
  ].map((column) => ({ ...column, customCell: merged })).concat([
    { title: '回款信息', children: [
      { title: '回款日期', dataIndex: 'paymentDate', width: 120 },
      { title: '本次回款金额', dataIndex: 'paymentAmount', width: 130, customRender: ({ text }) => text ?? '—' },
      { title: '回款说明', dataIndex: 'remark', width: 220 },
    ] },
  ] as any);
  const invoiceColumns = [
    { title: '发票类型', dataIndex: 'type', width: 100 }, { title: '开票金额', dataIndex: 'amount', width: 120 },
    { title: '发票号', dataIndex: 'number', width: 160 }, { title: '开票日期', dataIndex: 'date', width: 120 },
    { title: '备注', dataIndex: 'remark', width: 180 },
    { title: '本地附件', dataIndex: 'files', width: 180, customRender: ({ record }) => record.files.map((file) => file.name).join('、') || '—' },
  ];
  const { tableContext } = useListPage({ tableProps: {
    title: '分期回款模拟预览',
    api: async (params) => {
      if (!import.meta.env.DEV) throw new Error('模拟数据仅限本地开发环境');
      selected.value = null;
      const result: any = await projectList(params);
      if (!Array.isArray(result?.records)) throw new Error('分期列表格式异常');
      const rows = result.records.map((period) => {
        const id = String(period.periodId);
        if (!cache.has(id)) cache.set(id, makePaymentPreview(period));
        return cache.get(id)!;
      });
      pageIds = rows.map((row) => row.periodId);
      return { ...result, records: rows };
    },
    columns: [
      { title: '主项目名称-分期名称', dataIndex: 'projectLabel', width: 260 },
      { title: '模拟合同金额', dataIndex: 'contractAmount', width: 140 },
      { title: '已回款金额', dataIndex: 'receivedAmount', width: 130 },
      { title: '未回款金额', dataIndex: 'unpaidAmount', width: 130 },
      { title: '回款状态', dataIndex: 'paymentStatus', width: 110 },
    ],
    formConfig: { schemas: [{ field: 'keyword', label: '项目名称', component: 'Input', componentProps: { placeholder: '主项目名称或分期名称', allowClear: true } }], autoSubmitOnEnter: true },
    actionColumn: { width: 320, fixed: 'right' },
  } });
  const [registerTable, { setTableData }] = tableContext;
</script>
<style scoped>
  .payment-detail { margin: 12px; }
  .detail-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
  .detail-header h2 { margin: 0; font-size: 20px; font-weight: 600; }
  .section-title { display: flex; align-items: center; justify-content: space-between; margin: 24px 0 12px; }
  .section-title h3 { margin: 0; }
</style>
