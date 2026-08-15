<template>
  <BasicDrawer v-bind="$attrs" @register="register" title="采购订单明细" :width="820">
    <div v-if="detail.orderNo" class="purchase-detail">
      <!-- 订单头信息 -->
      <a-descriptions :column="2" size="small" bordered>
        <a-descriptions-item label="采购单号">{{ detail.orderNo || '—' }}</a-descriptions-item>
        <a-descriptions-item label="状态">
          <a-tag :color="statusMap[detail.status]?.color || undefined">{{ detail.status ? (statusMap[detail.status]?.text || detail.status) : '—' }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="供应商">{{ detail.supplierName || '—' }}</a-descriptions-item>
        <a-descriptions-item label="分期项目">{{ detail.periodName || detail.periodId || '—' }}</a-descriptions-item>
        <a-descriptions-item label="下单日期">{{ detail.orderDate || '—' }}</a-descriptions-item>
        <a-descriptions-item label="预计到货">{{ detail.expectedArrivalDate || '—' }}</a-descriptions-item>
        <a-descriptions-item label="总金额">￥{{ detail.totalAmount ?? '—' }}</a-descriptions-item>
        <a-descriptions-item label="创建人">{{ detail.createBy || '—' }}</a-descriptions-item>
        <a-descriptions-item label="创建时间" :span="2">{{ detail.createTime || '—' }}</a-descriptions-item>
      </a-descriptions>

      <!-- 订单明细 -->
      <div class="purchase-detail__title">采购明细</div>
      <a-table
        :columns="columns"
        :data-source="detail.itemList || []"
        :row-key="(r) => r.id || r.materialId"
        :pagination="false"
        size="small"
        bordered
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'amount'">
            {{ formatAmount(record) }}
          </template>
        </template>
      </a-table>

      <div v-if="detail.remark" class="purchase-detail__remark">
        <b>备注：</b>{{ detail.remark }}
      </div>
    </div>
    <div v-else class="purchase-detail__empty">未获取到订单明细</div>
  </BasicDrawer>
</template>

<script lang="ts" setup>
  import { ref } from 'vue';
  import { BasicDrawer, useDrawerInner } from '/@/components/Drawer';
  import { queryOrderById } from '../Purchase.api';
  import { loadDictMap } from '../../material.util';

  defineEmits(['register']);

  const detail = ref<any>({});
  // 采购订单状态(后台数据字典)
  const statusMap = ref<Record<string, { text: string; color: string }>>({});

  const [register, { setDrawerProps }] = useDrawerInner(async (data) => {
    detail.value = {};
    const id = data?.record?.id;
    if (!id) return;
    setDrawerProps({ loading: true });
    try {
      const res: any = await queryOrderById({ id });
      // 详情字段缺失(如 periodName)时，用列表行数据兜底
      detail.value = { ...(data.record || {}), ...(res || {}) };
    } finally {
      setDrawerProps({ loading: false });
    }
  });

  // 打开时加载状态字典
  loadDictMap('purchase_order_status').then((m) => (statusMap.value = m));

  const columns = [
    { title: '物料名称', dataIndex: 'materialName', key: 'materialName', width: 160 },
    { title: '类别', dataIndex: 'materialCategory', key: 'materialCategory', width: 110 },
    { title: '型号', dataIndex: 'model', key: 'model', width: 120 },
    { title: '单位', dataIndex: 'unit', key: 'unit', width: 80 },
    { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 90 },
    { title: '单价', dataIndex: 'unitPrice', key: 'unitPrice', width: 100 },
    { title: '金额', key: 'amount', width: 110 },
  ];

  function formatAmount(record: any): string {
    const qty = Number(record.quantity || 0);
    const price = Number(record.unitPrice || 0);
    return qty && price ? (qty * price).toFixed(2) : '—';
  }
</script>

<style lang="less" scoped>
  .purchase-detail {
    &__title {
      font-weight: 600;
      font-size: 15px;
      color: #333;
      margin: 16px 0 12px;
    }

    &__remark {
      margin-top: 12px;
      color: #555;
    }

    &__empty {
      color: #999;
      text-align: center;
      padding: 40px 0;
    }
  }
</style>
