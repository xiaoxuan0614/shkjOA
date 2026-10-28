<template>
  <section :class="{ 'service-fees': !pickerOnly }">
    <div v-if="!pickerOnly" class="service-fees__toolbar">
      <a-button v-if="structureEditable" type="primary" preIcon="ant-design:plus-outlined" :disabled="busy || !ready" @click="openPicker">选择服务费</a-button>
    </div>
    <a-alert v-if="!ready" type="warning" message="服务费尚未加载完成，请刷新报价后重试，暂不能保存。" show-icon />
    <a-table v-if="!pickerOnly" :columns="columns" :data-source="modelValue" row-key="_key" :pagination="false" :scroll="{ x: priceVisible ? 1200 : 900 }" table-layout="fixed" bordered size="small">
      <template #headerCell="{ column }">
        <span>{{ column.title }}<span v-if="['unit', 'quantity', 'costPrice'].includes(column.key)" class="service-fees__required" aria-hidden="true"> *</span></span>
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'name'">{{ record.name }}</template>
        <template v-else-if="column.key === 'unit'">
          <ServiceFeeUnitSelect :value="record.unit" :disabled="!structureEditable || busy" :label="`${record.name}单位`" @change="record.unit = $event" />
        </template>
        <template v-else-if="column.key === 'quantity'">
          <a-input-number v-model:value="record.quantity" :disabled="!structureEditable || busy" :min="0.01" :max="9999999999" :precision="2" :aria-label="`${record.name}数量`" aria-required="true" />
        </template>
        <template v-else-if="column.key === 'costPrice'">
          <a-input-number v-model:value="record.costPrice" :disabled="!costEditable || busy" :min="0" :max="9999999999" :precision="2" :aria-label="`${record.name}成本价`" aria-required="true" @change="deriveRate(record)" />
        </template>
        <template v-else-if="column.key === 'markupRate'">
          <a-input-number v-model:value="record.markupRate" :disabled="!priceEditable || busy" :min="-100" :max="9999999999" :precision="2" addon-after="%" :aria-label="`${record.name}加价比例`" @change="recalculate(record)" />
        </template>
        <template v-else-if="column.key === 'guidePrice'">
          <a-input-number v-model:value="record.guidePrice" :disabled="!priceEditable || busy" :min="0" :max="9999999999" :precision="2" :aria-label="`${record.name}指导价`" @change="deriveRate(record)" />
        </template>
        <template v-else-if="column.key === 'remark'"><a-input v-model:value="record.remark" :disabled="!editable || busy" :maxlength="500" :aria-label="`${record.name}备注`" placeholder="选填" /></template>
        <template v-else-if="column.key === 'action'"><a-popconfirm title="从本报价移除该服务费？" @confirm="remove(record)"><a-button type="link" danger :disabled="busy || !structureEditable">删除</a-button></a-popconfirm></template>
      </template>
    </a-table>
    <a-modal v-model:open="pickerOpen" title="选择服务费" width="min(1200px, calc(100vw - 32px))" :ok-button-props="{ disabled: busy || loading || !!error || !structureEditable || !ready }" @ok="confirmSelection">
      <div class="service-fees__toolbar">
        <a-input-search v-model:value="keyword" placeholder="搜索费用名称" aria-label="搜索费用名称" allow-clear :loading="loading" @search="search" />
        <a-button v-if="hasPermission('mtl:serviceFee:add')" type="primary" preIcon="ant-design:plus-outlined" :disabled="busy || !ready || !structureEditable" @click="maintenance?.openForm()">新增</a-button>
      </div>
      <a-alert v-if="error" type="error" :message="error" show-icon><template #action><a-button size="small" @click="loadOptions">重试</a-button></template></a-alert>
      <a-table :columns="pickerColumns" :data-source="options" :row-key="row => String(row.id)" :loading="loading" :pagination="withPagination({ current: page, pageSize: 10, total: optionTotal, showSizeChanger: false })" :scroll="{ x: 800 }" @change="changePage">
        <template #headerCell="{ column }">
          <a-space v-if="column.key === 'action'" :size="8">
            <span>操作</span>
            <a-checkbox :checked="pageSelection.all" :indeterminate="pageSelection.partial" :disabled="busy || loading || !structureEditable || !ready || !pageSelection.count" aria-label="全选当前页服务费" @change="togglePageSelection($event.target.checked)" />
          </a-space>
          <template v-else>{{ column.title }}</template>
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'guidePrice'">{{ Number(record.guidePrice ?? 0).toFixed(2) }}</template>
          <template v-else-if="column.key === 'unit'">{{ record.unit || '—' }}</template>
          <template v-else-if="column.key === 'taxRate'">{{ serviceFeeTaxText(record.taxRate ?? record.markupRate) }}</template>
          <template v-else-if="column.key === 'action'">
            <a-checkbox :checked="selectedKeys.includes(String(record.id))" :aria-label="`选择服务费：${record.name}`" :disabled="busy || loading || !structureEditable || !ready || record.id == null" @change="toggleSelection(record)" />
          </template>
        </template>
      </a-table>
      <div class="service-fees__hint">已选 {{ selectedKeys.length }} 项，可跨页多选；表头全选当前页，点击确定后应用。</div>
    </a-modal>
    <ServiceFeeMaintenance ref="maintenance" form-only @saved="refreshAfterCreate" />
  </section>
</template>
<script setup lang="ts">
  import { withPagination } from '/@/components/Pagination/config';
  import { computed, onBeforeUnmount, ref } from 'vue';
  import { serviceFeeList } from '../service-fee/ServiceFee.api';
  import { serviceFeeCopy, serviceFeePrice, serviceFeeTaxText } from '../serviceFee';
  import { derivedGuidanceRate } from '../quotationPricing';
  import ServiceFeeMaintenance from '../service-fee/index.vue';
  import { usePermission } from '/@/hooks/web/usePermission';
  import ServiceFeeUnitSelect from './ServiceFeeUnitSelect.vue';
  import { useMessage } from '/@/hooks/web/useMessage';
  const props = defineProps<{ modelValue: Recordable[]; ready: boolean; editable: boolean; structureEditable: boolean; costEditable: boolean; costVisible?: boolean; priceVisible: boolean; priceEditable: boolean; busy: boolean; pickerOnly?: boolean; directQuotation?: boolean }>();
  const emit = defineEmits(['update:modelValue']);
  const { createMessage } = useMessage();
  const { hasPermission } = usePermission();
  const maintenance = ref<InstanceType<typeof ServiceFeeMaintenance>>();
  const columns = computed(() => [
    { title: '费用名称', key: 'name', width: 100 },
    { title: '单位', key: 'unit', width: 90 }, { title: '数量', key: 'quantity', width: 110 },
    { title: '成本价（元）', key: 'costPrice', width: 120 },
    ...(props.priceVisible ? [{ title: '加价比例（%）', key: 'markupRate', width: 140 }, { title: '指导价（元）', key: 'guidePrice', width: 120 }] : []),
    { title: '备注', key: 'remark', width: 220 }, ...(props.structureEditable ? [{ title: '操作', key: 'action', width: 80 }] : []),
  ]);
  const pickerColumns = computed(() => [{ title: '费用名称', dataIndex: 'name' }, { title: '单位', key: 'unit', dataIndex: 'unit', width: 90, ellipsis: true },
    { title: '税率', key: 'taxRate', width: 90 },
    ...(props.priceVisible ? [{ title: '指导价格', key: 'guidePrice', width: 140 }] : []),
    ...(props.costVisible !== false ? [{ title: '成本价', dataIndex: 'costPrice', width: 110 }] : []), { title: '描述', dataIndex: 'description', ellipsis: true },
    { title: '操作', key: 'action', width: 110, fixed: 'right' as const }]);
  const pickerOpen = ref(false), keyword = ref(''), page = ref(1), optionTotal = ref(0), loading = ref(false), error = ref('');
  const options = ref<Recordable[]>([]);
  const selectedKeys = ref<string[]>([]);
  const selectedOptions = new Map<string, Recordable>();
  const pageSelection = computed(() => {
    const ids = options.value.filter(row => row.id != null).map(row => String(row.id));
    const selected = ids.filter(id => selectedKeys.value.includes(id)).length;
    return { count: ids.length, all: ids.length > 0 && selected === ids.length, partial: selected > 0 && selected < ids.length };
  });
  function togglePageSelection(checked: boolean) {
    if (props.busy || loading.value || !props.structureEditable || !props.ready) return;
    const keys = new Set(selectedKeys.value);
    for (const row of options.value) {
      if (row.id == null) continue;
      const id = String(row.id);
      if (checked) { keys.add(id); selectedOptions.set(id, row); }
      else keys.delete(id);
    }
    selectedKeys.value = [...keys];
  }
  function toggleSelection(row: Recordable) {
    if (props.busy || loading.value || !props.structureEditable || !props.ready || row.id == null) return;
    const id = String(row.id);
    if (selectedKeys.value.includes(id)) selectedKeys.value = selectedKeys.value.filter(key => key !== id);
    else { selectedKeys.value.push(id); selectedOptions.set(id, row); }
  }
  function refreshAfterCreate() { keyword.value = ''; search(); }
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
  function openPicker() { if (!props.structureEditable || props.busy || !props.ready) return; selectedKeys.value = [...new Set(props.modelValue.filter(row => row.serviceFeeId != null).map(row => String(row.serviceFeeId)))];
    selectedOptions.clear(); keyword.value = ''; pickerOpen.value = true; search(); }
  defineExpose({ openPicker });
  function confirmSelection() {
    if (!props.structureEditable || !props.ready || props.busy || loading.value || error.value) return;
    try {
      const selected = new Set(selectedKeys.value);
      // Keep edited snapshots and legacy rows without a source; never match by detail ID or name.
      const rows = props.modelValue.filter(row => row.serviceFeeId == null || selected.has(String(row.serviceFeeId)));
      const existing = new Set(rows.filter(row => row.serviceFeeId != null).map(row => String(row.serviceFeeId)));
      for (const id of selected) {
        if (existing.has(id)) continue;
        const source = selectedOptions.get(id);
        if (!source) throw new Error('所选服务费信息不完整，请重新选择');
        rows.push({ ...serviceFeeCopy(source, props.directQuotation), _key: `new-${++seed}` });
      }
      emit('update:modelValue', rows);
      pickerOpen.value = false;
    } catch (e: any) { createMessage.error(e.message); }
  }
  function remove(row: Recordable) { if (props.structureEditable && !props.busy) emit('update:modelValue', props.modelValue.filter(item => item !== row)); }
  function recalculate(row: Recordable) {
    if (props.directQuotation) return;
    if (props.busy || (!props.priceEditable && !(props.costEditable && !row.id && row.serviceFeeId))) return;
    try { row.guidePrice = serviceFeePrice(row.costPrice, row.markupRate); row._error = ''; }
    catch (e: any) { row.guidePrice = null; row._error = e.message; }
  }
  function deriveRate(row: Recordable) {
    if (props.busy || !props.priceVisible) return;
    row.markupRate = derivedGuidanceRate(row.costPrice, row.guidePrice ?? 0);
  }
</script>
<style scoped>
  .service-fees { margin-top: 24px; }
  .service-fees__toolbar { display: flex; align-items: center; gap: 16px; margin-bottom: 12px; }
  .service-fees__toolbar h3 { margin: 0; font-size: 16px; }
  .service-fees :deep(.ant-input-number), .service-fees :deep(.ant-input-number-group-wrapper) { width: 100%; min-width: 0; }
  .service-fees__error { color: #cf1322; }
  .service-fees__required { color: #ff4d4f; }
  .service-fees__hint { color: #595959; font-size: 12px; }
</style>
