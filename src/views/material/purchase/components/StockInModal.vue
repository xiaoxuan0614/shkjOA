<template>
  <BasicModal v-bind="$attrs" @register="register" title="采购入库" :width="880" @ok="handleSubmit">
    <a-descriptions :column="2" size="small" bordered class="stockin-desc">
      <a-descriptions-item label="采购单号">{{ record.orderNo || '—' }}</a-descriptions-item>
      <a-descriptions-item label="供应商">{{ record.supplierName || '—' }}</a-descriptions-item>
    </a-descriptions>

    <!-- 入库明细：仅可改「实际入库数量」，提交走采购入库接口 POST /project/purchaseOrder/inbound
         （{orderId, items:[{itemId, inboundQty}]}，按到货数量生成库存入库台账，后端统一算库存/金额）
         单价/型号等变更字段采购入库接口不接收，不再逐条手动台账，避免与采购明细脱节 -->
    <a-table :columns="columns" :data-source="items" :row-key="(r) => r._key" :pagination="false" size="small" bordered>
      <template #bodyCell="{ column, record: it }">
        <template v-if="column.key === 'inQty'">
          <a-input-number v-model:value="it.inQty" :min="0" placeholder="实际入库数" style="width: 100%" />
        </template>
      </template>
    </a-table>
  </BasicModal>
</template>

<script lang="ts" setup>
  import { ref } from 'vue';
  import { BasicModal, useModalInner } from '/@/components/Modal';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { purchaseInbound, editOrder, queryOrderById } from '../Purchase.api';

  const { createMessage } = useMessage();
  const emit = defineEmits(['register', 'success']);

  const record = ref<any>({});
  const items = ref<any[]>([]);

  const columns = [
    { title: '物料名称', dataIndex: 'materialName', key: 'materialName', width: 130 },
    { title: '型号', dataIndex: 'model', key: 'model', width: 100 },
    { title: '单位', dataIndex: 'unit', key: 'unit', width: 70 },
    { title: '采购数量', dataIndex: 'quantity', key: 'quantity', width: 85 },
    { title: '到货数量', dataIndex: 'arrivalQty', key: 'arrivalQty', width: 85 },
    { title: '*实际入库', key: 'inQty', width: 95 },
  ];

  const [register, { closeModal, setModalProps }] = useModalInner(async (data) => {
    record.value = data.record || {};
    items.value = [];
    setModalProps({ loading: true });
    try {
      // 详情接口取明细 itemList(优先)，退回列表行数据
      const detail: any = (await queryOrderById({ id: record.value.id }).catch(() => null)) || record.value;
      items.value = (detail.itemList || []).map((it: any, i: number) => ({
        _key: i,
        id: it.id, // 采购明细ID(采购入库接口 itemId)
        materialId: it.materialId,
        materialName: it.materialName,
        model: it.model || '',
        unit: it.unit || it.unitName,
        quantity: it.quantity,
        arrivalQty: it.arrivalQty ?? 0, // 到货数量(采购完成时已登记)
        inQty: it.arrivalQty ?? it.quantity ?? 0, // 默认按到货数量入库(无到货记录退回采购数量)
      }));
    } finally {
      setModalProps({ loading: false });
    }
  });

  /** 确认入库：调采购入库接口 POST /project/purchaseOrder/inbound 一次提交整单，按到货数量生成台账 */
  async function handleSubmit() {
    const invalid = items.value.find((it) => it.inQty <= 0);
    if (invalid) {
      createMessage.warning('请填写大于 0 的实际入库数量');
      return;
    }
    await purchaseInbound({
      orderId: record.value.id,
      items: items.value.map((it) => ({ itemId: it.id, inboundQty: it.inQty })),
    });
    // 状态置「已入库」(字典码4)；补带 orderNo/periodId，防止后端 edit 缺单号重生成
    await editOrder({ id: record.value.id, orderNo: record.value.orderNo, status: '4', periodId: record.value.periodId });
    createMessage.success('入库完成');
    closeModal();
    emit('success');
  }
</script>

<style lang="less" scoped>
  .stockin-desc {
    margin-bottom: 16px;
  }
</style>
