<template>
  <BasicModal v-bind="$attrs" @register="register" title="批量审批" :width="920" @ok="handleSubmit" :okText="'提交审批'">
    <div class="batch-tip">逐单选择审批结果；仅处理「待审批」状态的申请，其余自动跳过</div>
    <a-table :columns="columns" :data-source="rows" :row-key="(r) => r.id" :pagination="false" size="small" bordered>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag :color="getApprovalStatusMeta(record.status).color">{{ getApprovalStatusMeta(record.status).text }}</a-tag>
        </template>
        <template v-else-if="column.key === 'result'">
          <a-radio-group v-model:value="record.result" size="small" :disabled="!record.enabled">
            <a-radio value="AGREE">通过</a-radio>
            <a-radio value="REJECT">驳回</a-radio>
          </a-radio-group>
        </template>
        <template v-else-if="column.key === 'comment'">
          <a-input v-model:value="record.comment" size="small" :disabled="!record.enabled" placeholder="备注/驳回原因" />
        </template>
      </template>
    </a-table>
  </BasicModal>
</template>

<script lang="ts" setup>
  import { ref } from 'vue';
  import { BasicModal, useModalInner } from '/@/components/Modal';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { queryItems, approveApply, rejectApply } from '../StockApply.api';
  import { loadDictMap } from '../../material.util';
  import { getApprovalStatusMeta } from '/@/utils/approvalStatus';

  import { useStockAccess } from '../stockAccess';
  const { canApprove } = useStockAccess();
  const { createMessage } = useMessage();
  const emit = defineEmits(['register', 'success']);

  const rows = ref<any[]>([]);

  const columns = [
    { title: '申请单号', dataIndex: 'applyNo', key: 'applyNo', width: 150 },
    { title: '业务类型', dataIndex: 'bizText', key: 'bizText', width: 90 },
    { title: '申请人', dataIndex: 'applyUserName', key: 'applyUserName', width: 100 },
    { title: '物料数', dataIndex: 'itemCount', key: 'itemCount', width: 80 },
    { title: '申请总数量', dataIndex: 'totalQty', key: 'totalQty', width: 90 },
    { title: '状态', key: 'status', width: 90 },
    { title: '审批结果', key: 'result', width: 150 },
    { title: '备注', key: 'comment', width: 170 },
  ];

  // 业务类型仍按业务字典回显；审批状态使用全局五态映射。
  const bizMap = ref<Record<string, { text: string; color: string }>>({});
  loadDictMap('stock_apply_biz_type').then((m) => (bizMap.value = m));

  const [register, { closeModal }] = useModalInner(async (data) => {
    const list: any[] = (data?.rows || []).filter((r: any) => r && r.id);
    rows.value = list.map((r: any) => ({
      ...r,
      id: r.id,
      applyNo: r.applyNo || '—',
      bizText: bizMap.value[r.bizType]?.text || r.bizType || '—',
      applyUserName: r.applyUserName || '—',
      status: r.status,
      enabled: canApprove(r), // 仅待审批可批
      result: 'AGREE',
      comment: '',
      itemCount: 0,
      totalQty: 0,
    }));
    // 并行查待审批单的明细数(明细分页接口，失败静默，展示 0)
    await Promise.all(
      rows.value
        .filter((r) => r.enabled)
        .map(async (r) => {
          try {
            const res: any = await queryItems({ applyId: r.id, pageNo: 1, pageSize: 500 });
            const items = res?.records || res || [];
            r.itemCount = items.length;
            r.totalQty = items.reduce((s, it) => s + Number(it.unitQty ?? it.applyQty ?? 0), 0);
          } catch (e) {
            /* 忽略，保持 0 */
          }
        })
    );
  });

  /** 提交：逐单调 approve/reject(整单，不带 items)，汇总结果 */
  async function handleSubmit() {
    const items = rows.value.filter((r) => r.enabled && canApprove(r));
    if (!items.length) {
      createMessage.warning('勾选记录中没有「待审批」状态的申请');
      return;
    }
    // 驳回时必须填写备注（驳回原因），全部校验通过再提交
    const invalidReject = items.find((r) => r.result === 'REJECT' && !r.comment?.trim());
    if (invalidReject) {
      createMessage.warning(`申请单 ${invalidReject.applyNo} 驳回时必须填写备注（驳回原因）`);
      return;
    }
    let done = 0;
    for (const r of items) {
      // 审批人由后端按登录身份确定
      const params = { applyId: r.id, approvalResult: r.result, approvalComment: r.comment };
      if (r.result === 'AGREE') await approveApply(params);
      else await rejectApply(params);
      done++;
    }
    const skipped = rows.value.length - items.length;
    createMessage.success(`批量审批完成，共处理 ${done} 条${skipped ? `（${skipped} 条非待审批已跳过）` : ''}`);
    closeModal();
    emit('success');
  }
</script>

<style lang="less" scoped>
  .batch-tip {
    font-size: 12px;
    color: #999;
    margin-bottom: 10px;
  }
</style>
