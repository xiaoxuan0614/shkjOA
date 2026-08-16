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

    <!-- 明细审批：整条申请单一起审批；每行默认「通过」，驳回手动选并填备注 -->
    <div class="approve-title">申请明细（每行默认「通过」；需驳回的行手动选「驳回」并填写审批备注；提交=整单所有物料审批结果一起提交）</div>
    <a-table :columns="columns" :data-source="rows" :row-key="(r) => r._key" :pagination="false" size="small" bordered>
      <template #bodyCell="{ column, record: row }">
        <template v-if="column.key === 'result'">
          <a-tag v-if="row.approved" :color="itemStatusMap[row.approve ? 'APPROVED' : 'REJECTED']?.color">
            {{ itemStatusMap[row.approve ? 'APPROVED' : 'REJECTED']?.text || (row.approve ? '已通过' : '已驳回') }}
          </a-tag>
          <a-radio-group v-else v-model:value="row.result" size="small">
            <a-radio value="agree">通过</a-radio>
            <a-radio value="reject">驳回</a-radio>
          </a-radio-group>
        </template>
        <template v-else-if="column.key === 'comment'">
          <span v-if="row.approved">{{ row.comment || '—' }}</span>
          <a-input v-else v-model:value="row.itemRemark" size="small" placeholder="明细备注(选填)" />
        </template>
      </template>
    </a-table>

    <div v-if="loadError" class="approve-error">{{ loadError }}</div>
  </BasicModal>
</template>

<script lang="ts" setup>
  import { ref, computed } from 'vue';
  import { BasicModal, useModalInner } from '/@/components/Modal';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { queryItems, queryApprovals, approveApply } from '../StockApply.api';
  import { calcItemApproval, loadDictMap, getCurrentUser } from '../../material.util';

  const { createMessage } = useMessage();
  const emit = defineEmits(['register', 'success']);

  const record = ref<any>({});
  const rows = ref<any[]>([]);
  const loadError = ref('');

  // 方向/明细审批状态字典(英文码→中文/颜色)
  const typeMap = ref<Record<string, { text: string; color: string }>>({});
  const itemStatusMap = ref<Record<string, { text: string; color: string }>>({});
  loadDictMap('stock_apply_type').then((m) => (typeMap.value = m));
  loadDictMap('stock_item_status').then((m) => (itemStatusMap.value = m));

  const columns = [
    { title: '物料名称', dataIndex: 'materialName', key: 'materialName', width: 150 },
    { title: '品牌', dataIndex: 'brand', key: 'brand', width: 90 },
    { title: '型号', dataIndex: 'model', key: 'model', width: 110 },
    { title: '申请数量', dataIndex: 'applyQty', key: 'applyQty', width: 80 },
    { title: '单位', dataIndex: 'unitName', key: 'unitName', width: 60 },
    { title: '审批结果', key: 'result', width: 210 },
    { title: '审批备注', key: 'comment', width: 180 },
  ];

  const typeText = computed(() => typeMap.value[record.value.applyType]?.text || record.value.applyType || '—');

  const [register, { closeModal, setModalProps }] = useModalInner(async (data) => {
    record.value = data.record || {};
    rows.value = [];
    loadError.value = '';
    const id = record.value.id;
    if (!id) return;
    setModalProps({ loading: true });
    try {
      // 明细走分页接口 /stock/apply/items(status 字段=明细审批状态)；审批动态走 /stock/apply/approvals
      // (queryById 的 itemList/approvalList 已废弃：接口文档标注「请使用 /stock/apply/items 分页查询」)
      const itemRes: any = await queryItems({ applyId: id, pageNo: 1, pageSize: 500 });
      const approvalRes: any = await queryApprovals({ applyId: id, pageNo: 1, pageSize: 500 });
      const items = itemRes?.records || itemRes || [];
      const approvalList = approvalRes?.records || approvalRes || [];
      rows.value = items.map((it: any, i: number) => {
        // 明细状态 status(PENDING/APPROVED/REJECTED) 判断是否已审批过；备注取审批动态按 itemId 最新一条
        const st = calcItemApproval(it.id, approvalList, it.status);
        const approved = it.status !== 'PENDING'; // 已审批过 → 只读
        return {
          _key: i,
          id: it.id,
          materialName: it.materialName,
          brand: it.brand,
          model: it.model,
          unitName: it.unitName,
          applyQty: it.unitQty ?? it.applyQty ?? 0,
          approved,
          approve: st.approve ?? (it.status === 'APPROVED'),
          comment: approved ? st.comment : '',
          result: 'agree', // 未审批明细默认「通过」
          itemRemark: '',
        };
      });
      if (!rows.value.length) loadError.value = '未获取到申请明细';
    } catch (e) {
      loadError.value = '明细加载失败，请稍后重试';
      rows.value = [];
    } finally {
      setModalProps({ loading: false });
    }
  });

  /**
   * 提交审批：整条申请单所有物料审批结果一起提交到 `/stock/apply/approve`（唯一接口）。
   * items 一次带全：通过 `approve:true`、驳回 `approve:false`；任一条驳回 → 整单状态变更为「已驳回」
   */
  async function handleSubmit() {
    if (loadError.value || !rows.value.length) {
      createMessage.warning('无明细可审批');
      return;
    }
    const pending = rows.value.filter((r) => !r.approved); // 未审批明细
    if (!pending.length) {
      createMessage.warning('没有待审批的明细');
      return;
    }
    // 驳回的明细必须填写行级审批备注(驳回原因)
    if (pending.some((r) => r.result === 'reject' && !r.itemRemark?.trim())) {
      createMessage.warning('驳回的明细请填写审批备注（驳回原因）');
      return;
    }
    // 全局规定：审批传当前操作人id(approvalUserId)；通过+驳回一起经 items 提交
    await approveApply({
      applyId: record.value.id,
      approvalUserId: getCurrentUser().applyUserId,
      items: pending.map((r) => ({
        itemId: r.id,
        approve: r.result === 'agree',
        remark: r.itemRemark || '',
      })),
    });
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

  .approve-form {
    margin-top: 12px;
  }

  .approve-error {
    color: #f5222d;
    font-size: 12px;
    margin-top: 4px;
  }
</style>
