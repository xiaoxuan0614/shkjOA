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
  import { useListPage } from '/@/hooks/system/useListPage';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { purchaseColumns } from './Purchase.data';
  import { list, editOrder, listPeriod, purchaseArrival, queryOrderById } from './Purchase.api';
  import { loadDictMap } from '../material.util';
  import PurchaseModal from './PurchaseModal.vue';
  import StockInModal from './components/StockInModal.vue';
  import CloseModal from './components/CloseModal.vue';
  import PurchaseDetailDrawer from './components/PurchaseDetailDrawer.vue';

  const { createConfirm } = useMessage();

  // 采购订单状态(后台数据字典，改后重新登录生效)
  const statusMap = ref<Record<string, { text: string; color: string }>>({});
  onMounted(async () => {
    statusMap.value = await loadDictMap('purchase_order_status');
  });

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
      actionColumn: { width: 240, fixed: 'right' },
    },
  });
  const [registerTable, { reload }] = tableContext;

  /** 新增采购单 */
  function handleAdd() {
    openPurchaseModal(true, {});
  }

  /** 修改采购单(仅待采购)：打开编辑弹窗，回填订单头+明细 */
  function handleEdit(record: Recordable) {
    openPurchaseModal(true, { record, isUpdate: true });
  }

  /** 关闭采购单(未入库可关闭，填原因)：打开关闭弹窗 */
  function handleClose(record: Recordable) {
    openCloseModal(true, { record });
  }

  /** 确认采购：待采购(1) → 采购中(2) */
  function handleConfirm(record: Recordable) {
    createConfirm({
      iconType: 'warning',
      title: '确认采购',
      content: `确认开始采购「${record.orderNo}」？`,
      onOk: () => editOrder({ id: record.id, orderNo: record.orderNo, status: '2', periodId: record.periodId }).then(reload),
    });
  }

  /** 采购完成：采购中(2) → 已到货(3)（先登记到货数量 arrival，再置状态；入库时按到货数量生成台账） */
  function handleComplete(record: Recordable) {
    createConfirm({
      iconType: 'warning',
      title: '采购完成',
      content: `确认采购完成「${record.orderNo}」？状态将变为「已到货」，登记到货数量后可进行入库。`,
      onOk: async () => {
        try {
          // 登记采购到货数量：POST /project/purchaseOrder/arrival（不生成台账）
          const detail: any = await queryOrderById({ id: record.id }).catch(() => null);
          const itemList = detail?.itemList || [];
          if (itemList.length) {
            await purchaseArrival({
              orderId: record.id,
              items: itemList
                .filter((it: any) => Number(it.quantity) > 0)
                .map((it: any) => ({ itemId: it.id, arrivalQty: it.quantity })),
            });
          }
        } catch (e) {
          // 到货登记失败不阻塞状态流转，用户可在入库时手动修正实际入库数量
        }
        await editOrder({ id: record.id, orderNo: record.orderNo, status: '3', periodId: record.periodId });
        reload();
      },
    });
  }

  /** 入库：已到货 → 已入库(可改实际入库信息) */
  function handleStockIn(record: Recordable) {
    openStockInModal(true, { record });
  }

  /** 查看采购订单明细(调详情接口 queryById) */
  function handleDetail(record: Recordable) {
    openDetailDrawer(true, { record });
  }

  /** 行操作(按订单状态)：待采购(1)可修改/确认；采购中(2)完成；已到货(3)入库；未入库均可关闭 */
  function getTableAction(record) {
    const status = record.status;
    const actions: any[] = [];
    if (status === '1') {
      actions.push({ label: '修改', onClick: handleEdit.bind(null, record) });
      actions.push({ label: '确认采购', onClick: handleConfirm.bind(null, record) });
    } else if (status === '2') {
      actions.push({ label: '采购完成', onClick: handleComplete.bind(null, record) });
    } else if (status === '3') {
      actions.push({ label: '入库', onClick: handleStockIn.bind(null, record) });
    }
    // 未入库(待采购/采购中/已到货)可关闭，关闭需填原因
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
