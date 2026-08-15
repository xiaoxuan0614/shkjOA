<template>
  <BasicModal v-bind="$attrs" @register="register" title="盘存" :width="460" @ok="handleSubmit">
    <a-descriptions :column="1" size="small" bordered class="stocktake-desc">
      <a-descriptions-item label="物料编码">{{ record.materialCode || '—' }}</a-descriptions-item>
      <a-descriptions-item label="物料名称">{{ record.materialName || '—' }}</a-descriptions-item>
      <a-descriptions-item label="当前库存">{{ record.stockQty }} {{ record.unit || '' }}</a-descriptions-item>
    </a-descriptions>

    <a-form layout="vertical">
      <a-form-item label="盘点后数量" required>
        <a-input-number v-model:value="afterQty" :min="0" style="width: 100%" />
      </a-form-item>
      <a-form-item label="差异">
        <span :class="{ 'text-danger': diff < 0 }">{{ diff >= 0 ? '+' : '' }}{{ diff }} {{ record.unit || '' }}</span>
      </a-form-item>
      <a-form-item label="备注">
        <a-textarea v-model:value="remark" :rows="2" placeholder="盘存备注" />
      </a-form-item>
    </a-form>
  </BasicModal>
</template>

<script lang="ts" setup>
  import { ref, computed } from 'vue';
  import { BasicModal, useModalInner } from '/@/components/Modal';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { defHttp } from '/@/utils/http/axios';

  const { createMessage } = useMessage();
  const emit = defineEmits(['register', 'success']);

  const record = ref<any>({});
  const afterQty = ref<number>(0);
  const remark = ref('');

  // 差异 = 盘点后 - 当前
  const diff = computed(() => Number(afterQty.value || 0) - Number(record.value.stockQty || 0));

  const [register, { closeModal }] = useModalInner(async (data) => {
    record.value = data.record || {};
    afterQty.value = Number(data.record?.stockQty || 0);
    remark.value = '';
  });

  /**
   * 提交盘存：调盘存接口 POST /stock/ioRecord/takeStock
   * 传盘点实际库存 actualQty，后端按「实际库存 vs 系统实时库存」差异生成盘盈/盘亏台账；
   * takeNo 为空时后端自动生成盘存单号(生成后写入台账 sourceNo)。
   */
  async function handleSubmit() {
    if (afterQty.value == null || afterQty.value < 0) {
      createMessage.warning('请输入盘点后数量');
      return;
    }
    const params = {
      materialId: record.value.id,
      actualQty: afterQty.value,
      // takeNo: 不传，后端自动生成盘存单号
      remark: remark.value,
    };
    await defHttp.post({ url: '/stock/ioRecord/takeStock', params }, { successMessageMode: 'success' });
    closeModal();
    emit('success');
  }
</script>

<style lang="less" scoped>
  .stocktake-desc {
    margin-bottom: 16px;
  }

  .text-danger {
    color: #f5222d;
  }
</style>
