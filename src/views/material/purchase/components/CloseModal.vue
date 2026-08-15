<template>
  <BasicModal v-bind="$attrs" @register="register" title="关闭采购单" :width="440" @ok="handleSubmit">
    <a-descriptions :column="1" size="small" bordered class="close-desc">
      <a-descriptions-item label="采购单号">{{ record.orderNo || '—' }}</a-descriptions-item>
      <a-descriptions-item label="供应商">{{ record.supplierName || '—' }}</a-descriptions-item>
    </a-descriptions>
    <a-form layout="vertical" class="close-form">
      <a-form-item label="关闭原因" required>
        <a-textarea v-model:value="reason" :rows="3" placeholder="请输入关闭原因（关闭后不可继续采购/入库）" />
      </a-form-item>
    </a-form>
  </BasicModal>
</template>

<script lang="ts" setup>
  import { ref } from 'vue';
  import { BasicModal, useModalInner } from '/@/components/Modal';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { editOrder } from '../Purchase.api';

  const { createMessage } = useMessage();
  const emit = defineEmits(['register', 'success']);

  const record = ref<any>({});
  const reason = ref('');

  const [register, { closeModal }] = useModalInner(async (data) => {
    record.value = data.record || {};
    reason.value = '';
  });

  /** 关闭采购单：status=已关闭(字典码0) + closeReason；补带 orderNo 防止后端重生成单号 */
  async function handleSubmit() {
    if (!reason.value.trim()) {
      createMessage.warning('请填写关闭原因');
      return;
    }
    await editOrder({ id: record.value.id, orderNo: record.value.orderNo, status: '0', closeReason: reason.value.trim(), periodId: record.value.periodId });
    createMessage.success('采购单已关闭');
    closeModal();
    emit('success');
  }
</script>

<style lang="less" scoped>
  .close-desc {
    margin-bottom: 16px;
  }
</style>
