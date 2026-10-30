<template>
  <section class="payment-plan-editor">
    <div class="payment-plan-editor__heading">
      <h3>回款计划</h3>
      <a-button v-if="!readonly" type="primary" size="small" :disabled="disabled || !canAdd" @click="$emit('add')">添加款项</a-button>
    </div>
    <a-table :data-source="rows" :columns="columns" :row-key="rowKey" :pagination="false" :scroll="{ x: mode === 'date' ? 1100 : 780 }" size="middle" bordered>
      <template #headerCell="{ column }">
        {{ column.title }}<span v-if="column.required && !readonly" class="required"> *</span>
        <a-tooltip v-if="column.key === 'rollbackTime'" title="阶段任务完成后回款的周期"><span class="cycle-help" aria-label="回款周期说明">ⓘ</span></a-tooltip>
      </template>
      <template #bodyCell="{ column, record, index }">
        <template v-if="column.key === 'index'">{{ index + 1 }}</template>
        <template v-else-if="column.key === 'action'">
          <a-popconfirm v-if="removeConfirmation" :title="removeConfirmation" :disabled="disabled" @confirm="$emit('remove', record)"><a-button type="link" danger :disabled="disabled">删除</a-button></a-popconfirm>
          <a-button v-else type="link" danger :disabled="disabled" @click="$emit('remove', record)">删除</a-button>
        </template>
        <template v-else-if="readonly">{{ display(record, column.key) }}</template>
        <template v-else-if="column.key === 'node'">
          <UniqueRowSelect v-if="uniqueNodes" v-model="record[nodeField]" :rows="rows" :row="record" :options="nodeOptions" :field="nodeField" :disabled="disabled" placeholder="请选择回款项" :error="error(record, nodeField)" @change="$emit('change', record, nodeField)" />
          <a-select v-else v-model:value="record[nodeField]" :options="optionsFor(record)" :disabled="disabled" show-search option-filter-prop="label" placeholder="请选择回款项" @change="$emit('change', record, nodeField)" />
        </template>
        <template v-else-if="column.key === 'amount' && mode === 'cycle'"><b>{{ display(record, 'amount') }} 元</b></template>
        <div v-else class="cell-field">
          <a-date-picker v-if="column.key === 'plannedDate'" v-model:value="record.plannedDate" value-format="YYYY-MM-DD" :disabled="disabled" @change="$emit('change', record, 'plannedDate')" />
          <a-input-number v-else-if="['ratio', 'rollbackTime', 'amount'].includes(column.key)" v-model:value="record[field(column.key)]" :min="0" :max="column.key === 'ratio' ? 100 : undefined" :precision="column.key === 'rollbackTime' ? 0 : 2" :addon-after="column.key === 'ratio' ? '%' : column.key === 'rollbackTime' ? '天' : undefined" :disabled="disabled" :status="error(record, field(column.key)) ? 'error' : undefined" :aria-label="column.title" @change="$emit('change', record, field(column.key))" />
          <a-input v-else v-model:value="record[column.key]" :maxlength="500" :disabled="disabled" :aria-label="column.title" @change="$emit('change', record, column.key)" />
          <div v-if="error(record, field(column.key))" class="cell-error" role="alert">{{ error(record, field(column.key)) }}</div>
        </div>
      </template>
    </a-table>
    <slot name="footer" />
  </section>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { UniqueRowSelect } from '/@/components/EditableTable';
type Row = Record<string, any>;
const props = withDefaults(defineProps<{
  rows: Row[]; nodeOptions: { label: string; value: string }[]; rowKey: (row: Row) => string | number;
  mode?: 'cycle' | 'date'; nodeField?: string; amountField?: string; uniqueNodes?: boolean;
  readonly?: boolean; disabled?: boolean; canAdd?: boolean; removeConfirmation?: string;
  error?: (row: Row, field: string) => string;
}>(), { mode: 'cycle', nodeField: 'node', amountField: 'amount', uniqueNodes: true, readonly: false, disabled: false, canAdd: true, removeConfirmation: '', error: () => '' });
defineEmits(['add', 'remove', 'change']);
const columns = computed(() => [
  { title: '序号', key: 'index', width: 60 },
  { title: '回款项', key: 'node', width: 180, required: true },
  { title: '比例(%)', key: 'ratio', width: 150, required: props.mode === 'cycle' },
  props.mode === 'cycle' ? { title: '回款周期', key: 'rollbackTime', width: 150, required: true } : { title: '计划日期', key: 'plannedDate', width: 170, required: true },
  { title: props.mode === 'cycle' ? '回款金额(自动)' : '回款金额', key: 'amount', width: 170, required: props.mode === 'date' },
  ...(props.mode === 'date' ? [{ title: '备注', key: 'remark', width: 200 }] : []),
  ...(!props.readonly ? [{ title: '操作', key: 'action', width: 80 }] : []),
]);
const field = (key: string) => key === 'node' ? props.nodeField : key === 'amount' ? props.amountField : key;
function optionsFor(row: Row) {
  const value = row[props.nodeField];
  return value != null && value !== '' && !props.nodeOptions.some(option => String(option.value) === String(value))
    ? [...props.nodeOptions, { value, label: row.paymentNode_dictText || String(value) }] : props.nodeOptions;
}
function display(row: Row, key: string) {
  const value = row[field(key)];
  if (value == null || value === '') return '—';
  if (key === 'node') return optionsFor(row).find(option => String(option.value) === String(value))?.label || String(value);
  if (key === 'amount') return Number.isFinite(Number(value)) ? Number(value).toFixed(2) : '—';
  return String(value);
}
</script>
<style scoped>
.payment-plan-editor { margin: 20px 0; }
.payment-plan-editor__heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; gap: 12px; }
.payment-plan-editor__heading h3 { margin: 0; font-size: 15px; font-weight: 600; }
.required, .cell-error { color: #ff4d4f; }
.cell-error { margin-top: 4px; font-size: 12px; }
.cycle-help { margin-left: 5px; color: #8c8c8c; cursor: help; }
.cell-field :deep(.ant-input-number), .cell-field :deep(.ant-picker), :deep(.ant-select) { width: 100%; }
</style>
