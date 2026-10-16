<template>
  <a-card :bordered="false" class="finance-detail" :class="{ 'finance-detail--embedded': embedded }">
    <div class="section-title finance-header">
      <div class="finance-header__left">
        <a-button v-if="!embedded" type="link" preIcon="ant-design:arrow-left-outlined" @click="$emit('back')">返回</a-button>
        <h2>回款详情</h2>
      </div>
      <a-button v-if="!embedded && allowed && summary" @click="contractOpen = true">查看合同详情</a-button>
    </div>
    <a-alert v-if="!allowed" type="warning" message="仅管理员或财务人员可查看和登记回款、发票。" />
    <a-spin v-else :spinning="loading">
      <a-alert v-if="error" type="error" :message="error" show-icon><template #action><a-button @click="load">重新加载</a-button></template></a-alert>
      <template v-else-if="summary">
        <a-alert v-if="contractError" type="warning" show-icon :message="contractError" style="margin-bottom: 16px" />
        <a-descriptions v-if="embedded" :column="{ xs: 1, md: 2, xl: 3 }" bordered size="small">
          <a-descriptions-item label="合同金额">{{ financialOverview?.projectAmount ?? '—' }}</a-descriptions-item>
          <a-descriptions-item label="已回款金额">{{ financialOverview?.receivedAmount ?? '—' }}</a-descriptions-item>
          <a-descriptions-item label="剩余回款金额">{{ financialOverview?.remainingAmount ?? '—' }}</a-descriptions-item>
          <a-descriptions-item label="回款状态"><DictValue :value="financialOverview?.receiptStatus" :options="receiptStatusOptions" fallback="—" /></a-descriptions-item>
          <a-descriptions-item label="开票状态"><DictValue :value="financialOverview?.invoiceStatus" :options="invoiceStatusOptions" fallback="—" /></a-descriptions-item>
        </a-descriptions>
        <a-descriptions v-else :column="{ xs: 1, md: 2, xl: 3 }" bordered size="small">
          <a-descriptions-item label="项目名称" :span="3">{{ [period.projectName, period.periodName].filter(Boolean).join('-') || '—' }}</a-descriptions-item>
          <a-descriptions-item label="甲方">{{ period.customerName || '—' }}</a-descriptions-item>
          <a-descriptions-item label="项目经理">{{ period.projectManagerName || contract.projectManagerUserName || '—' }}</a-descriptions-item>
          <a-descriptions-item label="合同编号">{{ contract.contractNo || '—' }}</a-descriptions-item>
          <a-descriptions-item label="合同签订日期">{{ contract.contractSignedDate || '—' }}</a-descriptions-item>
          <a-descriptions-item label="合同金额">{{ contract.contractAmount ?? '—' }}</a-descriptions-item>
          <a-descriptions-item label="计划回款金额">{{ summary.plannedAmount }}</a-descriptions-item>
          <a-descriptions-item label="累计已回款">{{ summary.receivedAmount }}</a-descriptions-item>
          <a-descriptions-item label="剩余应回款">{{ summary.remainingAmount }}</a-descriptions-item>
          <a-descriptions-item label="累计已开票">{{ summary.invoicedAmount }}</a-descriptions-item>
        </a-descriptions>
        <p v-if="summary.remainingAmount < 0">剩余应回款为负数表示超额回款。</p>
        <div class="section-title"><h3>回款记录</h3><a-button type="primary" preIcon="ant-design:plus-outlined" @click="entry?.open(period, 'receipt')">添加回款</a-button></div>
        <a-alert v-if="receiptError" type="error" :message="receiptError"><template #action><a-button @click="loadReceipts">重试</a-button></template></a-alert>
        <a-table row-key="rowKey" :columns="receiptColumns" :data-source="groupedRows" :pagination="false" :loading="receiptLoading" :scroll="{ x: 1050 }" bordered size="small">
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'paymentNode'"><DictValue :value="record.paymentNode" :options="dict" /></template>
            <template v-else-if="column.dataIndex === 'receiptDate'">{{ record.receiptDate || '—' }}</template>
            <template v-else-if="column.dataIndex === 'sourceType'">{{ record.sourceType === 'LEGACY' ? '历史汇总（只读）' : record.sourceType === 'MANUAL' ? '手工登记' : '—' }}</template>
            <template v-else-if="column.dataIndex === 'fileIds'"><a-button v-for="(file, i) in record.fileIds || []" :key="file" type="link" size="small" @click="previewFileInModal(file)">附件{{ i + 1 }}</a-button></template>
          </template>
        </a-table>
        <BasicPagination class="pagination" :current="receiptPage" :total="receiptTotal" :page-size="10" :show-size-changer="false" @change="changeReceiptPage" />
        <div class="section-title"><h3>发票信息</h3><a-button type="primary" preIcon="ant-design:plus-outlined" @click="entry?.open(period, 'invoice')">添加发票</a-button></div>
        <a-alert v-if="invoiceError" type="error" :message="invoiceError"><template #action><a-button @click="loadInvoices">重试</a-button></template></a-alert>
        <a-table row-key="id" :columns="invoiceColumns" :data-source="invoices" :pagination="false" :loading="invoiceLoading" :scroll="{ x: 900 }" bordered size="small">
          <template #bodyCell="{ column, record }"><template v-if="column.dataIndex === 'fileIds'"><a-button v-for="(file, i) in record.fileIds || []" :key="file" type="link" size="small" @click="previewFileInModal(file)">附件{{ i + 1 }}</a-button></template></template>
        </a-table>
        <BasicPagination class="pagination" :current="invoicePage" :total="invoiceTotal" :page-size="10" :show-size-changer="false" @change="changeInvoicePage" />
      </template>
    </a-spin>
    <FinanceEntryDrawer ref="entry" @saved="saved" />
    <a-drawer v-if="!embedded" :open="contractOpen" title="合同详情" width="min(1200px, 96vw)" @close="contractOpen = false">
      <DetailContract v-if="contractOpen && allowed" :project-id="periodId" :project="period" />
    </a-drawer>
  </a-card>
</template>
<script setup lang="ts">
  import { computed, onBeforeUnmount, ref, watch } from 'vue';
  import { useUserStore } from '/@/store/modules/user';
  import { previewFileInModal } from '/@/utils/filePreview';
  import { contractDetail } from './Payment.api';
  import { loadDictOptions } from '/@/views/project/Project.data';
  import { financePeriod, financePeriods, invoiceList, receiptList, receiptSummary, type FinanceEntry, type ReceiptSummary } from './Receipt.api';
  import { canRequestFinance } from './receiptModel';
  import FinanceEntryDrawer from './FinanceEntryDrawer.vue';
  import DictValue from '/@/components/DictValue.vue';
  import DetailContract from '/@/views/project/detail/components/DetailContract.vue';
  import { groupReceiptRows } from './receiptRows';
  const props = defineProps<{ periodId: string; context?: Record<string, any>; embedded?: boolean }>();
  const emit = defineEmits(['back', 'changed']);
  const user = useUserStore();
  const allowed = computed(() => !!user.getIdentity.userId && canRequestFinance(user.getIdentity.roleCodes));
  const entry = ref<InstanceType<typeof FinanceEntryDrawer>>();
  const contractOpen = ref(false);
  const financialOverview = ref<Record<string, any> | null>(null);
  const receiptStatusOptions = ref<any[]>([]), invoiceStatusOptions = ref<any[]>([]);
  async function readFinancialOverview() {
    if (!props.embedded) return null;
    const periodId = props.periodId;
    const result: any = await financePeriods({ periodId, pageNo: 1, pageSize: 1 });
    const row = result?.records?.find(item => String(item.periodId) === periodId);
    if (!row) throw new Error('未获取到当前分期财务汇总，请重新加载');
    return row;
  }
  const period = ref<any>({}), contract = ref<any>({}), summary = ref<ReceiptSummary | null>(null), dict = ref<any[]>([]);
  const loading = ref(false), error = ref(''), contractError = ref(''), receiptLoading = ref(false), invoiceLoading = ref(false), receiptError = ref(''), invoiceError = ref('');
  const receipts = ref<FinanceEntry[]>([]), invoices = ref<FinanceEntry[]>([]);
  const receiptPage = ref(1), invoicePage = ref(1), receiptTotal = ref(0), invoiceTotal = ref(0);
  let generation = 0, receiptSeq = 0, invoiceSeq = 0;
  const groupedRows = computed(() => groupReceiptRows(receipts.value, summary.value?.plans || []));
  const receiptColumns: any[] = [
    { title: '回款类型', dataIndex: 'paymentNode', width: 110 }, { title: '计划回款金额', dataIndex: 'plannedAmount', width: 130 },
    { title: '已回款金额', dataIndex: 'actualAmount', width: 120 }, { title: '计划回款日期', dataIndex: 'plannedDate', width: 120 },
  ].map(c => ({ ...c, customCell: (record) => ({ rowSpan: record.span }) }));
  receiptColumns.push({ title: '回款信息', children: [
    { title: '回款日期', dataIndex: 'receiptDate', width: 120 }, { title: '本次回款金额', dataIndex: 'amount', width: 130, customRender: ({ text }) => text ?? '—' },
    // { title: '来源', dataIndex: 'sourceType', width: 140 },
     { title: '说明', dataIndex: 'remark', width: 220 },
    //  { title: '附件', dataIndex: 'fileIds', width: 150 },
  ] });
  const invoiceColumns = [{ title: '发票号', dataIndex: 'invoiceNo', width: 180 }, { title: '开票金额', dataIndex: 'amount', width: 120 }, { title: '开票日期', dataIndex: 'invoiceDate', width: 120 }, { title: '备注', dataIndex: 'remark', width: 220 }, { title: '附件', dataIndex: 'fileIds', width: 160 }];
  async function loadReceipts() {
    const seq = ++receiptSeq, gen = generation;
    receiptLoading.value = true; receiptError.value = ''; receipts.value = [];
    try { const data = await receiptList({ periodId: props.periodId, pageNo: receiptPage.value, pageSize: 10 }); if (gen === generation && seq === receiptSeq) { receipts.value = data.records; receiptTotal.value = data.total; } }
    catch (e: any) { if (gen === generation && seq === receiptSeq) receiptError.value = e.message || '回款记录加载失败'; }
    finally { if (gen === generation && seq === receiptSeq) receiptLoading.value = false; }
  }
  async function loadInvoices() {
    const seq = ++invoiceSeq, gen = generation;
    invoiceLoading.value = true; invoiceError.value = ''; invoices.value = [];
    try { const data = await invoiceList({ periodId: props.periodId, pageNo: invoicePage.value, pageSize: 10 }); if (gen === generation && seq === invoiceSeq) { invoices.value = data.records; invoiceTotal.value = data.total; } }
    catch (e: any) { if (gen === generation && seq === invoiceSeq) invoiceError.value = e.message || '发票加载失败'; }
    finally { if (gen === generation && seq === invoiceSeq) invoiceLoading.value = false; }
  }
  async function load() {
    const gen = ++generation;
    contractOpen.value = false;
    summary.value = null; financialOverview.value = null; contract.value = {}; period.value = {}; receipts.value = []; invoices.value = []; error.value = ''; contractError.value = '';
    if (!allowed.value || !props.periodId) return;
    loading.value = true;
    try {
      const [totals, overview, statusOptions] = await Promise.all([
        receiptSummary(props.periodId), readFinancialOverview(),
        props.embedded ? Promise.all([loadDictOptions('payment_status'), loadDictOptions('invoice_status')]) : Promise.resolve([[], []]),
      ]);
      if (gen !== generation) return;
      const [info, project, options] = await Promise.all([props.embedded ? Promise.resolve(null) : contractDetail({ periodId: props.periodId }, true).catch(e => ({ _loadError: e.message || '合同信息加载失败' })), props.context || financePeriod(props.periodId), loadDictOptions('payback_node')]);
      if (gen !== generation) return;
      summary.value = totals; contract.value = info || {}; contractError.value = info?._loadError || ''; period.value = { ...project, periodId: props.periodId }; dict.value = options;
      financialOverview.value = overview; [receiptStatusOptions.value, invoiceStatusOptions.value] = statusOptions;
      await Promise.all([loadReceipts(), loadInvoices()]);
    } catch (e: any) { if (gen === generation) error.value = e.message || '详情加载失败'; }
    finally { if (gen === generation) loading.value = false; }
  }
  function changeReceiptPage(page: number) { receiptPage.value = page; loadReceipts(); }
  function changeInvoicePage(page: number) { invoicePage.value = page; loadInvoices(); }
  async function saved(event: { kind: string }) {
    const gen = generation;
    try { const [totals, overview] = await Promise.all([receiptSummary(props.periodId), readFinancialOverview()]); if (gen !== generation) return; summary.value = totals; financialOverview.value = overview; emit('changed', totals); }
    catch { error.value = '登记已成功，但汇总刷新失败，请重新加载，勿重复登记。'; }
    if (event.kind === 'receipt') { receiptPage.value = 1; await loadReceipts(); } else { invoicePage.value = 1; await loadInvoices(); }
  }
  watch(() => [props.periodId, user.getIdentity.userId, allowed.value], () => { receiptPage.value = 1; invoicePage.value = 1; load(); }, { immediate: true });
  onBeforeUnmount(() => { generation++; receiptSeq++; invoiceSeq++; });
</script>
<style scoped>
  .finance-detail { margin: 12px; }
  .section-title { display: flex; align-items: center; justify-content: space-between; margin: 20px 0 12px; }
  .section-title h2, .section-title h3 { margin: 0; }
  .finance-header { gap: 16px; flex-wrap: wrap; margin: 8px 0 24px; }
  .finance-header__left { display: flex; align-items: center; gap: 16px; }
  .pagination { margin-top: 16px; text-align: right; }
  .finance-detail--embedded { margin: 0; }
  .finance-detail--embedded :deep(> .ant-card-body) { padding: 0; }
  .finance-detail--embedded .section-title { margin: 16px 0 8px; }
  .finance-detail--embedded .finance-header { margin: 0 0 12px; }
  .finance-detail--embedded .section-title h2,
  .finance-detail--embedded .section-title h3 { font-size: 16px; line-height: 24px; font-weight: 600; }
  .finance-detail--embedded .pagination { margin-top: 12px; }
</style>
