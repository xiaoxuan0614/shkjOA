<template>
  <section class="service-fees">
    <div class="service-fees__toolbar">
      <h3>服务费</h3>
      <a-button v-if="structureEditable" :disabled="busy || !ready" @click="openPicker">选择服务费</a-button>
    </div>
    <a-alert v-if="!ready" type="warning" message="服务费尚未加载完成，请刷新报价后重试，暂不能保存。" show-icon />
    <a-table :columns="columns" :data-source="modelValue" row-key="_key" :pagination="false" :scroll="{ x: 1200 }" table-layout="fixed" bordered size="small">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'name'">{{ record.name }}</template>
        <template v-else-if="column.key === 'unit'">
          <a-input v-model:value="record.unit" :disabled="!structureEditable || busy" :maxlength="50" :aria-label="`${record.name}单位`" />
        </template>
        <template v-else-if="column.key === 'quantity'">
          <a-input-number v-model:value="record.quantity" :disabled="!structureEditable || busy" :min="0.0001" :max="9999999999" :precision="4" :aria-label="`${record.name}数量`" />
        </template>
        <template v-else-if="column.key === 'costPrice'">
          <a-input-number v-model:value="record.costPrice" :disabled="!costEditable || busy" :min="0" :max="9999999999" :precision="2" :aria-label="`${record.name}成本价`" @change="recalculate(record)" />
        </template>
        <template v-else-if="column.key === 'markupRate'">
          <a-input-number v-model:value="record.markupRate" :disabled="!priceEditable || busy" :min="0" :max="9999999999" :precision="2" addon-after="%" :aria-label="`${record.name}指导比例`" @change="recalculate(record)" />
        </template>
        <template v-else-if="column.key === 'guidePrice'">
          <a-input-number v-model:value="record.guidePrice" :disabled="!priceEditable || busy" :min="0" :max="9999999999" :precision="2" :aria-label="`${record.name}指导价`" />
        </template>
        <template v-else-if="column.key === 'amount'">
          {{ quotationAmount([record], 'guidePrice', 'quantity') ?? '—' }}
          <div v-if="record._error" class="service-fees__error" role="alert">{{ record._error }}</div>
          <div v-if="Number(record.quantity) !== 1 || record.unit !== '项'" class="service-fees__hint">{{ record.quantity }} {{ record.unit }} × {{ record.guidePrice ?? '—' }}</div>
        </template>
        <template v-else-if="column.key === 'remark'"><a-input v-model:value="record.remark" :disabled="!editable || busy" :maxlength="500" :aria-label="`${record.name}备注`" placeholder="选填" /></template>
        <template v-else-if="column.key === 'action'"><a-popconfirm title="从本报价移除该服务费？" @confirm="remove(record)"><a-button type="link" danger :disabled="busy || !structureEditable">删除</a-button></a-popconfirm></template>
      </template>
    </a-table>
    <div class="service-fees__total">服务费合计：{{ ready ? (total ?? '—') : '—' }} 元</div>
    <a-modal v-model:open="pickerOpen" title="选择服务费" :width="720" :footer="null">
      <a-input-search v-model:value="keyword" placeholder="搜索费用名称" aria-label="搜索费用名称" allow-clear :loading="loading" @search="search" />
      <a-alert v-if="error" type="error" :message="error" show-icon><template #action><a-button size="small" @click="loadOptions">重试</a-button></template></a-alert>
      <a-table :columns="pickerColumns" :data-source="options" row-key="id" :loading="loading" :pagination="{ current: page, pageSize: 10, total: optionTotal, showSizeChanger: false }" :scroll="{ x: 600 }" @change="changePage">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'action'"><a-button type="link" :disabled="busy || loading || !structureEditable" @click="select(record)">选择</a-button></template>
          <template v-else-if="column.key === 'markupRate'">{{ record.markupRate ?? '—' }}%</template>
        </template>
      </a-table>
    </a-modal>
  </section>
</template>
<script setup lang="ts">
  import { computed, onBeforeUnmount, ref } from 'vue';
  import { serviceFeeList } from '../service-fee/ServiceFee.api';
  import { quotationAmount, serviceFeeCopy, serviceFeePrice } from '../serviceFee';
  import { useMessage } from '/@/hooks/web/useMessage';
  const props = defineProps<{ modelValue: Recordable[]; ready: boolean; editable: boolean; structureEditable: boolean; costEditable: boolean; priceEditable: boolean; busy: boolean }>();
  const emit = defineEmits(['update:modelValue']);
  const { createMessage } = useMessage();
  const columns = computed(() => [
    { title: '费用名称', key: 'name', width: 180 },
    { title: '单位', key: 'unit', width: 90 }, { title: '数量', key: 'quantity', width: 110 },
    { title: '成本价（元）', key: 'costPrice', width: 120 },
    { title: '指导比例', key: 'markupRate', width: 130 }, { title: '指导价（元）', key: 'guidePrice', width: 120 },
    { title: '小计（元）', key: 'amount', width: 130 },
    { title: '备注', key: 'remark', width: 220 }, ...(props.structureEditable ? [{ title: '操作', key: 'action', width: 80 }] : []),
  ]);
  const pickerColumns = [{ title: '费用名称', dataIndex: 'name' }, { title: '指导比例', key: 'markupRate', width: 100 },
    { title: '成本价', dataIndex: 'costPrice', width: 110 }, { title: '描述', dataIndex: 'description', ellipsis: true }, { title: '操作', key: 'action', width: 80 }];
  const total = computed(() => quotationAmount(props.modelValue, 'guidePrice', 'quantity'));
  const pickerOpen = ref(false), keyword = ref(''), page = ref(1), optionTotal = ref(0), loading = ref(false), error = ref('');
  const options = ref<Recordable[]>([]);
  let sequence = 0, seed = 0;
  onBeforeUnmount(() => { sequence++; });
  async function loadOptions() {
    const request = ++sequence;
    loading.value = true; error.value = '';
    try {
      const result = await serviceFeeList({ name: keyword.value, pageNo: page.value, pageSize: 10 });
      if (request !== sequence) return;
      if (!Array.isArray(result?.records)) throw new Error('服务费列表格式异常');
      options.value = result.records; optionTotal.value = Number(result.total || 0);
    } catch (e: any) { if (request === sequence) { error.value = e?.message || '服务费加载失败'; options.value = []; } }
    finally { if (request === sequence) loading.value = false; }
  }
  function search() { page.value = 1; void loadOptions(); }
  function changePage(pagination: any) { page.value = pagination.current; void loadOptions(); }
  function openPicker() { if (!props.structureEditable || props.busy || !props.ready) return; pickerOpen.value = true; search(); }
  function select(row: Recordable) {
    if (!props.structureEditable || props.busy || loading.value) return;
    try {
      emit('update:modelValue', [...props.modelValue, { ...serviceFeeCopy(row), _key: `new-${++seed}` }]);
      pickerOpen.value = false;
    } catch (e: any) { createMessage.error(e.message); }
  }
  function remove(row: Recordable) { if (props.structureEditable && !props.busy) emit('update:modelValue', props.modelValue.filter(item => item !== row)); }
  function recalculate(row: Recordable) {
    try { row.guidePrice = serviceFeePrice(row.costPrice, row.markupRate); row._error = ''; }
    catch (e: any) { row.guidePrice = null; row._error = e.message; }
  }
</script>
<style scoped>
  .service-fees { margin-top: 24px; }
  .service-fees__toolbar { display: flex; align-items: center; gap: 16px; margin-bottom: 12px; }
  .service-fees__toolbar h3 { margin: 0; font-size: 16px; }
  .service-fees :deep(.ant-input-number), .service-fees :deep(.ant-input-number-group-wrapper) { width: 100%; min-width: 0; }
  .service-fees__total { margin-top: 12px; text-align: right; font-variant-numeric: tabular-nums; }
  .service-fees__error { color: #cf1322; }
  .service-fees__hint { color: #595959; font-size: 12px; }
</style>
