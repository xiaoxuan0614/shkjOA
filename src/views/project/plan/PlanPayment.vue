<template>
  <div class="plan-payment">
    <!-- 合同主信息(只读, 来自合同信息页面) -->
    <div class="plan-payment__group">
      <div class="plan-payment__group-title">合同主信息</div>
      <a-descriptions :column="3" size="middle" bordered>
        <a-descriptions-item label="合同编号">{{ contract.contractNo || '—' }}</a-descriptions-item>
        <a-descriptions-item label="合同类型">{{ contract.contractType || '—' }}</a-descriptions-item>
        <a-descriptions-item label="合同金额">{{ contract.contractAmount != null ? `${contract.contractAmount} 元` : '—' }}</a-descriptions-item>
        <a-descriptions-item label="销售负责人">{{ contract.salesUserName || '—' }}</a-descriptions-item>
        <a-descriptions-item label="质保期">{{ contract.warrantyPeriod != null ? `${contract.warrantyPeriod} 月` : '—' }}</a-descriptions-item>
        <a-descriptions-item label="计划交付日期">{{ contract.plannedDeliveryDate || '—' }}</a-descriptions-item>
        <a-descriptions-item label="备注" :span="3">{{ contract.remark || '—' }}</a-descriptions-item>
      </a-descriptions>
    </div>

    <!-- 回款计划(节点 + 比例, 金额按合同金额自动计算) -->
    <div class="plan-payment__group">
      <div class="plan-payment__group-title">
        <span>回款计划</span>
        <span class="plan-payment__hint">维护节点与比例，金额 = 合同金额 × 比例</span>
        <a-button v-if="editable" type="primary" size="small" preIcon="ant-design:plus-outlined" @click="addRow">添加</a-button>
      </div>
      <a-table
        :columns="columns"
        :data-source="rows"
        :row-key="(record) => record._key"
        :pagination="false"
        size="middle"
        bordered
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'index'">
            {{ record._key }}
          </template>
          <template v-else-if="column.key === 'node'">
            <a-select v-model:value="record.node" :disabled="!editable" placeholder="请选择节点" style="width: 100%" :options="nodeOptions" />
          </template>
          <template v-else-if="column.key === 'ratio'">
            <a-input-number
              v-model:value="record.ratio"
              :min="0"
              :max="100"
              :disabled="!editable"
              placeholder="比例%"
              style="width: 100%"
              addon-after="%"
              @change="calcAmount(record)"
            />
          </template>
          <template v-else-if="column.key === 'amount'">
            <b>{{ record.amount != null ? record.amount.toFixed(2) : '—' }} 元</b>
          </template>
          <template v-else-if="column.key === 'planDate'">
            <a-date-picker v-model:value="record.planDate" :disabled="!editable" value-format="YYYY-MM-DD" style="width: 100%" placeholder="计划日期" />
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button v-if="editable" type="link" danger size="small" @click="removeRow(record._key)">删除</a-button>
          </template>
        </template>
      </a-table>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { ref, unref, watch, onMounted } from 'vue';
  import { contractList } from '/@/views/payment/Payment.api';
  import { initDictOptions } from '/@/utils/dict/index';

  const props = defineProps<{
    periodId?: string;
    editable?: boolean;
  }>();

  const contract = ref<Recordable>({});
  // 回款节点下拉(字典 payback_node)
  const nodeOptions = ref<{ label: string; value: string }[]>([]);

  async function load() {
    nodeOptions.value = (await initDictOptions('payback_node')) || [];
    if (!props.periodId) return;
    try {
      const res: any = await contractList({ periodId: props.periodId, pageNo: 1, pageSize: 10 });
      const records = res?.records || res || [];
      contract.value = records[0] || {};
    } catch {
      contract.value = {};
    }
  }

  onMounted(() => {
    load();
  });

  // 合同金额变化 → 重算所有行金额
  watch(
    () => contract.value.contractAmount,
    () => rows.value.forEach((r) => calcAmount(r))
  );

  // 回款计划行
  const columns = [
    { title: '序号', key: 'index', width: 60 },
    { title: '回款节点', key: 'node', width: 160 },
    { title: '比例(%)', key: 'ratio', width: 140 },
    { title: '金额(自动)', key: 'amount', width: 160 },
    { title: '计划日期', key: 'planDate', width: 160 },
    { title: '操作', key: 'action', width: 80, align: 'center' },
  ];
  const rows = ref<any[]>([]);
  let rowSeed = 0;

  function addRow() {
    rows.value.push({ _key: ++rowSeed, node: undefined, ratio: 0, amount: 0, planDate: undefined });
  }

  function removeRow(key: number) {
    rows.value = rows.value.filter((r) => r._key !== key);
  }

  /** 金额 = 合同金额 × 比例% */
  function calcAmount(record: any) {
    const amount = Number(contract.value.contractAmount) || 0;
    const ratio = Number(record.ratio) || 0;
    record.amount = ratio > 0 ? (amount * ratio) / 100 : 0;
  }

  defineExpose({
    getData() {
      return unref(rows);
    },
    setData(list: any[]) {
      rows.value = (list || []).map((item) => ({ ...item, _key: ++rowSeed, amount: Number(item.amount) || 0 }));
      rows.value.forEach((r) => calcAmount(r));
    },
  });
</script>

<style lang="less" scoped>
  .plan-payment {
    &__group {
      margin-bottom: 16px;

      &-title {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: 600;
        font-size: 14px;
        color: #333;
        margin-bottom: 12px;
      }

      &-hint {
        font-weight: 400;
        font-size: 12px;
        color: #999;
      }
    }
  }
</style>
