<template>
  <div class="purchase-page">
    <!-- 采购订单列表 -->
    <BasicTable @register="registerTable">
      <template #tableTitle>
        <a-button type="primary" preIcon="ant-design:plus-outlined" @click="handleAdd">新增采购单</a-button>
      </template>
      <template #action="{ record }">
        <TableAction :actions="getTableAction(record)" :dropDownActions="getDropDownAction(record)" />
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'status'">
          <a-tag :color="statusMap[record.status]?.color || undefined">{{ record.status ? (statusMap[record.status]?.text || record.status) : '—' }}</a-tag>
        </template>
      </template>
    </BasicTable>

    <!-- 新增采购订单(待采购可修改) -->
    <PurchaseModal @register="registerPurchaseModal" @success="reload" />
    <!-- 入库弹窗(可改实际入库信息) -->
    <StockInModal @register="registerStockInModal" @success="reload" />
    <!-- 关闭采购单弹窗(未入库可关闭填原因) -->
    <CloseModal @register="registerCloseModal" @success="reload" />
    <!-- 采购订单明细抽屉 -->
    <PurchaseDetailDrawer @register="registerDetailDrawer" />
  </div>
</template>

<script lang="ts" name="mtl-purchase" setup>
  import { BasicTable, TableAction } from '/@/components/Table';
  import { useModal } from '/@/components/Modal';
  import { useDrawer } from '/@/components/Drawer';
  import { ref, onMounted } from 'vue';
  import { useDebounceFn } from '@vueuse/core';
  import { useListPage } from '/@/hooks/system/useListPage';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { purchaseColumns, searchFormSchema } from './Purchase.data';
  import { list, listPeriod, changeStatus, getSuppliers, searchProjectPeriod } from './Purchase.api';
  import { loadDictMap } from '../material.util';
  import { ensureSupplierOptions, ensurePeriodOptions } from '../material.options';
  import PurchaseModal from './PurchaseModal.vue';
  import StockInModal from './components/StockInModal.vue';
  import CloseModal from './components/CloseModal.vue';
  import PurchaseDetailDrawer from './components/PurchaseDetailDrawer.vue';

  const { createConfirm } = useMessage();

  // 采购订单状态(后台数据字典，改后重新登录生效)
  const statusMap = ref<Record<string, { text: string; color: string }>>({});
  onMounted(async () => {
    statusMap.value = await loadDictMap('purchase_order_status');
    // 弹窗下拉数据在页面渲染时就预载(第 1 页 10 条)，打开「新增采购订单」弹窗直接展示，不再请求
    ensureSupplierOptions();
    ensurePeriodOptions();
    // 搜索表单下拉注入(供应商/分期项目)：预载首页展示 + 输入后服务端模糊查询
    supplierSearchOptions.value = await ensureSupplierOptions();
    periodSearchOptions.value = (await ensurePeriodOptions()).map((o) => ({ label: o.label, value: o.periodName || o.label }));
    getForm()?.updateSchema([
      {
        field: 'supplierName',
        componentProps: { options: supplierSearchOptions, onSearch: onSupplierSearch },
      },
      {
        field: 'periodName',
        componentProps: { options: periodSearchOptions, onSearch: onPeriodSearch },
      },
    ]);
  });

  // 搜索表单「供应商」下拉(远程模糊查询 /project/supplier/list，防抖 300ms)
  const supplierSearchOptions = ref<any[]>([]);
  const onSupplierSearch = useDebounceFn(async (keyword: string) => {
    if (!keyword) {
      // 空关键词回到预载的供应商首页
      supplierSearchOptions.value = await ensureSupplierOptions();
      return;
    }
    const data: any = await getSuppliers({ pageNo: 1, pageSize: 10, supplierName: keyword });
    const list = data?.records || (Array.isArray(data) ? data : []);
    supplierSearchOptions.value = list.map((s: any) => ({ label: s.supplierName, value: s.supplierName }));
  }, 300);

  // 搜索表单「分期项目」下拉(远程模糊查询 /project/period/searchByName，防抖 300ms)
  const periodSearchOptions = ref<any[]>([]);
  const onPeriodSearch = useDebounceFn(async (keyword: string) => {
    if (!keyword) {
      periodSearchOptions.value = (await ensurePeriodOptions()).map((o) => ({ label: o.label, value: o.periodName || o.label }));
      return;
    }
    const data: any = await searchProjectPeriod({ keyword, pageNo: 1, pageSize: 20 });
    periodSearchOptions.value = (data?.records || data || []).map((r: any) => ({ label: r.periodName, value: r.periodName }));
  }, 300);

  const [registerPurchaseModal, { openModal: openPurchaseModal }] = useModal();
  const [registerStockInModal, { openModal: openStockInModal }] = useModal();
  const [registerCloseModal, { openModal: openCloseModal }] = useModal();
  const [registerDetailDrawer, { openDrawer: openDetailDrawer }] = useDrawer();

  // 分期映射：列表 periodId → periodName 解析（后端列表/详情只回 periodId 时兜底）
  const periodMap = ref<Record<string, string>>({});
  let periodMapLoaded = false;
  async function ensurePeriodMap() {
    if (periodMapLoaded) return;
    periodMapLoaded = true;
    try {
      const res: any = await listPeriod({ pageNo: 1, pageSize: 1000 });
      const recs = res?.records || res || [];
      periodMap.value = Object.fromEntries(recs.map((p: any) => [p.periodId || p.id, p.periodName]));
    } catch (e) {
      // 失败不阻塞列表，仅 periodName 留空
    }
  }

  /** 列表包装：查询后按 periodMap 补 periodName */
  async function listWithPeriod(params: any) {
    await ensurePeriodMap();
    const res: any = await list(params);
    const records = res?.records || (Array.isArray(res) ? res : []);
    (records || []).forEach((r: any) => {
      if (!r.periodName) r.periodName = periodMap.value[r.periodId] || '';
    });
    return res;
  }

  const { tableContext } = useListPage({
    tableProps: {
      title: '采购入库',
      api: listWithPeriod,
      columns: purchaseColumns,
      canResize: true,
      // 列表筛选：采购单号/供应商/分期项目/状态
      formConfig: {
        schemas: searchFormSchema,
        autoSubmitOnEnter: true,
        showAdvancedButton: true,
        fieldMapToNumber: [],
        fieldMapToTime: [],
      },
      actionColumn: { width: 240, fixed: 'right' },
    },
  });
  const [registerTable, { reload, getForm }] = tableContext;

  /** 新增采购单 */
  function handleAdd() {
    openPurchaseModal(true, {});
  }

  /** 修改采购单(仅待采购)：打开编辑弹窗，回填订单头+明细 */
  function handleEdit(record: Recordable) {
    openPurchaseModal(true, { record, isUpdate: true });
  }

  /** 关闭采购单(状态 1/2/3 可关闭，终止流程→0)：打开关闭弹窗 */
  function handleClose(record: Recordable) {
    openCloseModal(true, { record });
  }

  /** 确认采购：待采购(1) → 采购中(2) */
  function handleConfirm(record: Recordable) {
    createConfirm({
      iconType: 'warning',
      title: '确认采购',
      content: `确认开始采购「${record.orderNo}」？`,
      onOk: () => changeStatus({ orderId: record.id, status: '2' }).then(reload),
    });
  }

  /** 采购完成：采购中(2) → 已到货(3) */
  function handleComplete(record: Recordable) {
    createConfirm({
      iconType: 'warning',
      title: '采购完成',
      content: `确认采购完成「${record.orderNo}」？状态将变为「已到货」。`,
      onOk: () => changeStatus({ orderId: record.id, status: '3' }).then(reload),
    });
  }

  /** 开始入库：已到货(3) → 入库中(4) */
  function handleStartInbound(record: Recordable) {
    createConfirm({
      iconType: 'warning',
      title: '开始入库',
      content: `确认开始入库「${record.orderNo}」？状态将变为「入库中」，可逐物料登记实际入库数量。`,
      onOk: () => changeStatus({ orderId: record.id, status: '4' }).then(reload),
    });
  }

  /** 入库：入库中(4) 打开入库弹窗(逐物料填实际入库数量，调 /project/purchaseOrder/inbound) */
  function handleStockIn(record: Recordable) {
    openStockInModal(true, { record });
  }

  /** 入库完成：入库中(4) → 已完成(5)，所有物料入库完成后点击（后端校验） */
  function handleInboundComplete(record: Recordable) {
    createConfirm({
      iconType: 'warning',
      title: '入库完成',
      content: `确认「${record.orderNo}」全部物料已入库完成？状态将变为「已完成」。`,
      onOk: () => changeStatus({ orderId: record.id, status: '5' }).then(reload),
    });
  }

  /** 查看采购订单明细(调详情接口 queryById) */
  function handleDetail(record: Recordable) {
    openDetailDrawer(true, { record });
  }

  /** 行操作(按订单状态)：1待采购→确认采购；2采购中→采购完成；3已到货→开始入库；4入库中→入库/入库完成；1/2/3 可关闭 */
  function getTableAction(record) {
    const status = record.status;
    const actions: any[] = [];
    if (status === '1') {
      actions.push({ label: '修改', onClick: handleEdit.bind(null, record) });
      actions.push({ label: '确认采购', onClick: handleConfirm.bind(null, record) });
    } else if (status === '2') {
      actions.push({ label: '采购完成', onClick: handleComplete.bind(null, record) });
    } else if (status === '3') {
      actions.push({ label: '开始入库', onClick: handleStartInbound.bind(null, record) });
    } else if (status === '4') {
      actions.push({ label: '入库', onClick: handleStockIn.bind(null, record) });
      actions.push({ label: '入库完成', onClick: handleInboundComplete.bind(null, record) });
    }
    // 开始入库前(待采购/采购中/已到货)可关闭，终止流程→0
    if (['1', '2', '3'].includes(status)) {
      actions.push({ label: '关闭', onClick: handleClose.bind(null, record) });
    }
    return actions;
  }

  /** 下拉操作(查看明细) */
  function getDropDownAction(record) {
    return [{ label: '查看明细', onClick: handleDetail.bind(null, record) }];
  }
</script>

<style lang="less" scoped>
  .purchase-page {
    padding: 4px;
  }
</style>
