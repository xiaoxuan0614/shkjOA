<template>
  <BasicModal v-bind="$attrs" @register="register" title="采购入库" :width="880" :ok-text="allCompleted ? '入库完成' : '确认'" :ok-button-props="{ disabled: !ready || !items.length }" :confirm-loading="submitting" @ok="handleSubmit">
    <a-descriptions :column="2" size="small" bordered class="stockin-desc">
      <a-descriptions-item label="采购单号">{{ record.orderNo || '—' }}</a-descriptions-item>
      <a-descriptions-item label="供应商">{{ record.supplierName || '—' }}</a-descriptions-item>
    </a-descriptions>

    <!-- 入库明细：仅可改「实际入库数量」，提交走采购入库接口 POST /project/purchaseOrder/inbound
         （{orderId, items:[{itemId, inboundQty}]}，按到货数量生成库存入库台账，后端统一算库存/金额）
         单价/型号等变更字段采购入库接口不接收，不再逐条手动台账，避免与采购明细脱节 -->
    <a-table :columns="columns" :scroll="{ x: 'max-content' }" :data-source="items" :row-key="(r) => r._key" :pagination="false" size="small" bordered>
      <template #bodyCell="{ column, record: it }">
        <template v-if="column.key === 'inQty'">
          <a-input-number :precision="2" v-model:value="it.inQty" :min="0" :max="Number(it.remainingQty)" :disabled="submitting || Number(it.remainingQty) === 0" placeholder="实际入库数" style="width: 100%" />
        </template>
      </template>
    </a-table>
  </BasicModal>
</template>

<script lang="ts" setup>
  import { unifyMaterialColumns } from '/@/views/material/materialTableColumns';
  import { computed, ref } from 'vue';
  import { BasicModal, useModalInner } from '/@/components/Modal';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { purchaseInbound, queryOrderById, changeStatus } from '../Purchase.api';

  const { createMessage } = useMessage();
  const emit = defineEmits(['register', 'success']);

  const record = ref<any>({});
  const items = ref<any[]>([]);
  const ready = ref(false);
  const submitting = ref(false);
  const allCompleted = computed(() => ready.value && items.value.length > 0 && items.value.every(it => Number(it.remainingQty) === 0));

  const columns = unifyMaterialColumns([
    { title: '物料名称', dataIndex: 'materialName', key: 'materialName', width: 130 },
    { title: '型号', dataIndex: 'model', key: 'model', width: 100 },
    { title: '单位', dataIndex: 'unit', key: 'unit', width: 70 },
    { title: '采购数量', dataIndex: 'quantity', key: 'quantity', width: 85 },
    { title: '已入库数', dataIndex: 'inboundQty', key: 'inboundQty', width: 85 },
    { title: '未入库数', dataIndex: 'remainingQty', key: 'remainingQty', width: 85 },
    { title: '*操作入库', key: 'inQty', width: 95 },
  ], { source: 'detail', nameField: 'materialName' });

  const [register, { closeModal, setModalProps }] = useModalInner(async (data) => {
    ready.value = false;
    record.value = data.record || {};
    items.value = [];
    setModalProps({ loading: true });
    try {
      const detail: any = await queryOrderById({ id: record.value.id });
      if (!Array.isArray(detail?.itemList) || detail.itemList.some(it => it.remainingQty == null || it.remainingQty === '' || !Number.isFinite(Number(it.remainingQty)) || Number(it.remainingQty) < 0)) {
        throw new Error('采购入库明细不完整，请关闭后重试');
      }
      items.value = (detail.itemList || []).map((it: any, i: number) => ({
        _key: i,
        id: it.id, // 采购明细ID(采购入库接口 itemId)
        materialId: it.materialId,
        materialCode: it.materialCode,
        brand: it.brand,
        materialName: it.materialName,
        model: it.model || '',
        unit: it.unit || it.unitName,
        quantity: it.quantity,
        inboundQty: it.inboundQty ?? 0, // 已入库数量默认=0，可修改
        remainingQty: it.remainingQty ?? 0, // 未入库数量默认=采购数量，可修改
        inQty: it.remainingQty ?? 0, // 实际入库数量默认为 未入库数量默认，可修改
      }));
      ready.value = true;
    } catch (error: any) {
      createMessage.error(error?.message || '采购入库明细加载失败');
    } finally {
      setModalProps({ loading: false });
    }
  });

  /** 确认入库：调采购入库接口 POST /project/purchaseOrder/inbound 一次提交整单，按实际入库数量生成台账；
   *  状态保持「入库中」(4)，全部入库完成后再点「入库完成」置「已完成」(5) */
  async function handleSubmit() {
    if (!ready.value || submitting.value || !items.value.length) return;
    submitting.value = true;
    try {
      if (allCompleted.value) {
        await changeStatus({ orderId: record.value.id, status: '5' });
      } else {
        const invalid = items.value.some(it => it.inQty == null || it.inQty === '' || !Number.isFinite(Number(it.inQty)) || Number(it.inQty) < 0 || Number(it.inQty) > Number(it.remainingQty));
        if (invalid) { createMessage.warning('请填写正确入库数量，不能超过未入库数'); return; }
        const selected = items.value.filter(it => Number(it.inQty) > 0);
        if (!selected.length) { createMessage.warning('请至少填写一项大于0的入库数量'); return; }
        await purchaseInbound({ orderId: record.value.id, items: selected.map(it => ({ itemId: it.id, actualQty: Number(it.inQty) })) });
      }
      createMessage.success(allCompleted.value ? '入库完成' : '入库成功');
      closeModal();
      emit('success');
    } finally {
      submitting.value = false;
    }
  }
</script>

<style lang="less" scoped>
  .stockin-desc {
    margin-bottom: 16px;
  }
</style>
