<template>
  <BasicModal v-bind="$attrs" @register="register" :title="title" :width="900" :okText="okText" @ok="handleOk">
    <!-- 申请头 -->
    <a-descriptions :column="3" size="small" bordered class="stock-exec__desc">
      <a-descriptions-item label="申请单号">{{ apply.applyNo || '—' }}</a-descriptions-item>
      <a-descriptions-item label="业务类型">{{ bizMap[apply.bizType]?.text || apply.bizType || '—' }}</a-descriptions-item>
      <a-descriptions-item label="方向">{{ typeMap[apply.applyType]?.text || apply.applyType || '—' }}</a-descriptions-item>
      <a-descriptions-item label="申请人">{{ apply.applyUserName || '—' }}</a-descriptions-item>
      <a-descriptions-item label="项目">{{ apply.projectName || apply.projectNo || '—' }}</a-descriptions-item>
      <a-descriptions-item label="备注">{{ apply.remark || '—' }}</a-descriptions-item>
    </a-descriptions>

    <!-- 明细：勾选(表头可全选/取消全选) + 剩余可执行 + 本次执行数 + 说明 -->
    <a-table :columns="columns" :data-source="rows" :row-key="(r) => r._key" :pagination="false" size="small" bordered>
      <template #headerCell="{ column }">
        <a-checkbox
          v-if="column.key === 'check'"
          :checked="allChecked"
          :indeterminate="someChecked"
          :disabled="!executableRows.length"
          @change="onHeaderCheck"
        />
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'check'">
          <a-checkbox :checked="!!record.checked" :disabled="record.remain <= 0" @change="(e) => (record.checked = e.target.checked)" />
        </template>
        <template v-else-if="column.key === 'execQty'">
          <a-input-number v-model:value="record.execQty" :min="1" :max="record.remain" :disabled="record.remain <= 0" style="width: 100%" />
        </template>
        <template v-else-if="column.key === 'remark'">
          <a-input v-model:value="record.remark" :disabled="record.remain <= 0" placeholder="差异说明(选填，实际≠申请时建议填)" />
        </template>
        <template v-else-if="column.key === 'remain'">
          <span :class="{ 'text-warn': record.remain <= 0 }">{{ record.remain }}</span>
        </template>
      </template>
    </a-table>

    <!-- 快捷操作 -->
    <div class="stock-exec__foot">
      <span class="stock-exec__tip">
        {{ loadError || (allDone ? (isReturn ? '该申请已全部入库，无可执行数量' : '该申请已全部出库，无可执行数量') : (isReturn ? '勾选明细 → 填「最终入库数」(默认=剩余，可改) → 与应还/实际还不一致时填说明 → 点执行入库' : '勾选明细 → 填「本次出库数」(默认=剩余可执行，可改) → 差异填说明 → 点执行出库')) }}
      </span>
    </div>
  </BasicModal>
</template>

<script lang="ts" setup>
  import { ref, computed } from 'vue';
  import { BasicModal, useModalInner } from '/@/components/Modal';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { queryItems, executeApply } from '../StockApply.api';
  import { loadDictMap } from '../../material.util';

  const { createMessage } = useMessage();
  const emit = defineEmits(['register', 'success']);

  const apply = ref<any>({});
  const rows = ref<any[]>([]);

  // 业务类型/方向字典(英文码→中文/颜色)
  const bizMap = ref<Record<string, { text: string; color: string }>>({});
  const typeMap = ref<Record<string, { text: string; color: string }>>({});
  loadDictMap('stock_apply_biz_type').then((m) => (bizMap.value = m));
  loadDictMap('stock_apply_type').then((m) => (typeMap.value = m));

  const isReturn = computed(() => apply.value.bizType === 'RETURN');
  const ioType = computed<'IN' | 'OUT'>(() => (apply.value.applyType === 'IN' ? 'IN' : 'OUT'));
  const title = computed(() => (ioType.value === 'OUT' ? '出库执行' : '入库执行'));
  const okText = computed(() => (ioType.value === 'OUT' ? '执行出库' : '执行入库'));

  // 明细列：还料多 应还/实际还 两层，其余同
  const columns = computed(() => {
    const base: any[] = [
      { title: '勾选', key: 'check', width: 55, align: 'center' },
      { title: '物料名称', dataIndex: 'materialName', key: 'materialName', width: 140 },
      { title: '品牌', dataIndex: 'brand', key: 'brand', width: 90 },
      { title: '型号', dataIndex: 'model', key: 'model', width: 110 },
      { title: '单位', dataIndex: 'unitName', key: 'unitName', width: 70 },
    ];
    if (isReturn.value) {
      base.push(
        { title: '应还数量', dataIndex: 'shouldReturn', key: 'shouldReturn', width: 85 },
        { title: '实际还库', dataIndex: 'actualReturn', key: 'actualReturn', width: 85 }
      );
    } else {
      base.push({ title: '申请数量', dataIndex: 'applyQty', key: 'applyQty', width: 85 });
    }
    base.push(
      { title: '剩余可执行', key: 'remain', width: 95 },
      { title: isReturn.value ? '*最终入库数' : '*本次出库数', key: 'execQty', width: 115 },
      { title: '说明(留痕)', key: 'remark', width: 170 }
    );
    return base;
  });

  const [register, { closeModal, setModalProps }] = useModalInner(async (data) => {
    apply.value = data.record || {};
    rows.value = [];
    const id = apply.value.id;
    if (!id) return;
    loadError.value = '';
    setModalProps({ loading: true });
    try {
      // 明细分页接口(executedQty 已执行数直接返回，不再聚台账；queryById.itemList 已废弃)
      // 只保留已通过明细(明细 status=APPROVED)
      const res: any = await queryItems({ applyId: id, pageNo: 1, pageSize: 500 });
      const items = res?.records || res || [];
      if (!items.length) {
        loadError.value = '未获取到申请明细';
        rows.value = [];
        return;
      }
      const approvedItems = items.filter((it: any) => it.status === 'APPROVED');
      rows.value = approvedItems.map((it: any, i: number) => {
        // 正式后端明细数量字段为 applyQty(优先)，回退 unitQty；已执行数直接取明细 executedQty
        const applied = Number(it.applyQty ?? it.unitQty ?? 0);
        const executed = Number(it.executedQty ?? 0);
        const remain = Math.max(applied - executed, 0);
        return {
          _key: i,
          itemId: it.id,
          materialId: it.materialId,
          materialName: it.materialName,
          brand: it.brand,
          model: it.model,
          unitName: it.unitName,
          applyQty: applied,
          shouldReturn: it.shouldReturn ?? it.canReturn ?? it.applyQty ?? applied,
          actualReturn: it.actualReturn ?? applied,
          remain,
          execQty: remain,
          checked: remain > 0,
          remark: '',
        };
      });
      if (!rows.value.length) loadError.value = '该申请暂无已审批通过的明细，无法执行出入库';
    } catch (e) {
      loadError.value = '申请/台账加载失败，请稍后重试';
      rows.value = [];
    } finally {
      setModalProps({ loading: false });
    }
  });

  // 加载错误/空明细提示
  const loadError = ref('');
  // 整单已全部执行完(剩余都为0且非空)
  const allDone = computed(() => rows.value.length > 0 && rows.value.every((r) => r.remain <= 0));

  // 可执行(剩余>0)行 → 表头全选/取消全选
  const executableRows = computed(() => rows.value.filter((r) => r.remain > 0));
  const allChecked = computed(() => executableRows.value.length > 0 && executableRows.value.every((r) => r.checked));
  const someChecked = computed(() => executableRows.value.some((r) => r.checked) && !allChecked.value);

  function onHeaderCheck(e: any) {
    const v = e.target.checked;
    rows.value.forEach((r) => {
      if (r.remain > 0) r.checked = v;
    });
  }

  /** 执行选中的行：整单一次调 executeApply(items 带 itemId+executeQty；说明留痕待后端补字段) */
  async function handleOk() {
    const selected = rows.value.filter((r) => r.checked && r.remain > 0 && r.execQty > 0);
    if (!selected.length) {
      createMessage.warning('请勾选要执行的明细');
      return;
    }
    await executeApply({
      applyId: apply.value.id,
      itemIds: selected.map((r) => r.itemId),
      items: selected.map((r) => ({ itemId: r.itemId, executeQty: r.execQty })),
    });
    createMessage.success(`${ioType.value === 'OUT' ? '出库' : '入库'}完成，共 ${selected.length} 条`);
    closeModal();
    emit('success');
  }
</script>

<style lang="less" scoped>
  .stock-exec {
    &__desc {
      margin-bottom: 14px;
    }

    &__foot {
      margin-top: 10px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    &__tip {
      font-size: 12px;
      color: #999;
    }
  }

  .text-warn {
    color: #f5222d;
  }
</style>
