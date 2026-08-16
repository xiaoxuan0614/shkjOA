<template>
  <BasicModal v-bind="$attrs" @register="register" title="库管审批" :width="880" @ok="handleSubmit" :okText="'提交审批'">
    <!-- 申请信息(只读) -->
    <a-descriptions :column="3" size="small" bordered class="approve-desc">
      <a-descriptions-item label="申请单号">{{ record.applyNo || '—' }}</a-descriptions-item>
      <a-descriptions-item label="申请人">{{ record.applyUserName || '—' }}</a-descriptions-item>
      <a-descriptions-item label="类型">{{ typeText }}</a-descriptions-item>
      <a-descriptions-item label="项目">{{ record.projectName || record.projectNo || '—' }}</a-descriptions-item>
      <a-descriptions-item label="申请备注">{{ record.remark || '—' }}</a-descriptions-item>
    </a-descriptions>

    <!-- 申请明细(只读参考，整单审批) -->
    <div class="approve-title">申请明细（整单审批：通过=整单通过，驳回=整单驳回）</div>
    <a-table :columns="columns" :data-source="rows" :row-key="(r) => r._key" :pagination="false" size="small" bordered />

    <!-- 整单审批结果：整单通过 / 整单驳回（驳回必填原因） -->
    <div class="approve-result">
      <span class="approve-result__label">审批结果：</span>
      <a-radio-group v-model:value="result" size="small">
        <a-radio value="AGREE">整单通过</a-radio>
        <a-radio value="REJECT">整单驳回</a-radio>
      </a-radio-group>
    </div>
    <a-input v-model:value="comment" placeholder="审批备注（驳回时必填，填写驳回原因）" />

    <div v-if="loadError" class="approve-error">{{ loadError }}</div>
  </BasicModal>
</template>

<script lang="ts" setup>
  import { ref, computed } from 'vue';
  import { BasicModal, useModalInner } from '/@/components/Modal';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { queryItems, approveApply, rejectApply } from '../StockApply.api';
  import { loadDictMap, getCurrentUser } from '../../material.util';

  const { createMessage } = useMessage();
  const emit = defineEmits(['register', 'success']);

  const record = ref<any>({});
  const rows = ref<any[]>([]);
  const loadError = ref('');
  const result = ref('AGREE'); // 整单审批结果(默认通过)
  const comment = ref(''); // 审批备注(驳回必填)

  // 方向字典(英文码→中文/颜色)
  const typeMap = ref<Record<string, { text: string; color: string }>>({});
  loadDictMap('stock_apply_type').then((m) => (typeMap.value = m));

  // 明细只读列(整单审批，无需每行结果/备注)
  const columns = [
    { title: '物料名称', dataIndex: 'materialName', key: 'materialName', width: 150 },
    { title: '品牌', dataIndex: 'brand', key: 'brand', width: 90 },
    { title: '型号', dataIndex: 'model', key: 'model', width: 110 },
    { title: '申请数量', dataIndex: 'applyQty', key: 'applyQty', width: 80 },
    { title: '单位', dataIndex: 'unitName', key: 'unitName', width: 60 },
  ];

  const typeText = computed(() => typeMap.value[record.value.applyType]?.text || record.value.applyType || '—');

  const [register, { closeModal, setModalProps }] = useModalInner(async (data) => {
    record.value = data.record || {};
    rows.value = [];
    loadError.value = '';
    result.value = 'AGREE';
    comment.value = '';
    const id = record.value.id;
    if (!id) return;
    setModalProps({ loading: true });
    try {
      // 明细走分页接口 /stock/apply/items(只读展示申请了什么物料)
      const itemRes: any = await queryItems({ applyId: id, pageNo: 1, pageSize: 500 });
      const items = itemRes?.records || itemRes || [];
      rows.value = items.map((it: any, i: number) => ({
        _key: i,
        materialName: it.materialName,
        brand: it.brand,
        model: it.model,
        unitName: it.unitName,
        applyQty: it.unitQty ?? it.applyQty ?? 0,
      }));
      if (!rows.value.length) loadError.value = '未获取到申请明细';
    } catch (e) {
      loadError.value = '明细加载失败，请稍后重试';
      rows.value = [];
    } finally {
      setModalProps({ loading: false });
    }
  });

  /**
   * 提交审批：整单审批（无逐条概念）。整单通过 → approve，整单驳回 → reject（驳回必填原因）。
   * 全局规定：审批传当前操作人id(approvalUserId)
   */
  async function handleSubmit() {
    if (loadError.value || !rows.value.length) {
      createMessage.warning('无明细可审批');
      return;
    }
    if (result.value === 'REJECT' && !comment.value?.trim()) {
      createMessage.warning('驳回时必须填写审批备注（驳回原因）');
      return;
    }
    const params = {
      applyId: record.value.id,
      approvalUserId: getCurrentUser().applyUserId,
      approvalResult: result.value,
      approvalComment: comment.value,
    };
    if (result.value === 'AGREE') await approveApply(params);
    else await rejectApply(params);
    closeModal();
    emit('success');
  }
</script>

<style lang="less" scoped>
  .approve-desc {
    margin-bottom: 14px;
  }

  .approve-title {
    font-weight: 600;
    font-size: 14px;
    color: #333;
    margin: 14px 0 10px;
  }

  .approve-result {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 14px 0 10px;

    &__label {
      font-weight: 600;
      font-size: 14px;
      color: #333;
    }
  }

  .approve-error {
    color: #f5222d;
    font-size: 12px;
    margin-top: 4px;
  }
</style>
