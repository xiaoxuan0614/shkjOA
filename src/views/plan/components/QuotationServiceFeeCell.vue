<template>
  <div v-if="columnKey === 'materialIdentity' || columnKey === 'unifiedMaterial'" class="fee-name">
    <div><a-tag color="blue">服务费</a-tag><span>{{ record.name }}</span></div>
    <div class="fee-tax">税率：{{ serviceFeeTaxText(record.taxRate) }}</div>
  </div>
  <ServiceFeeUnitSelect v-else-if="columnKey === 'unit'" :value="record.unit" :disabled="!structureEditable || busy" :label="`${record.name}单位`" @change="update('unit', $event)" />
  <a-input-number v-else-if="columnKey === 'plannedQty'" :value="record.quantity" :disabled="!structureEditable || busy" :min="0.01" :max="9999999999" :precision="2" :aria-label="`${record.name}数量`" aria-required="true" @change="update('quantity', $event)" />
  <a-input-number v-else-if="columnKey === 'basePrice'" :value="record.costPrice" :disabled="!costEditable || busy" :min="0" :max="9999999999" :precision="2" :aria-label="`${record.name}成本价`" aria-required="true" @change="update('costPrice', $event)" />
  <span v-else-if="columnKey === 'costTotal'">{{ quotationAmount([record], 'costPrice', 'quantity') ?? '—' }}</span>
  <span v-else-if="columnKey === 'guideTotal'">{{ quotationAmount([record], 'guidePrice', 'quantity') ?? '—' }}</span>
  <span v-else-if="columnKey === 'quotationPercent'">{{ quotationPercentText }}</span>
  <template v-else-if="columnKey === 'markupRate' && rateVisible !== false">
    <a-input-number v-if="priceVisible" :value="record.markupRate" :disabled="!priceEditable || busy" :min="0" :max="9999999999" :precision="2" addon-after="%" :aria-label="`${record.name}指导比例`" @change="update('markupRate', $event)" />
    <span v-else>—</span>
  </template>
  <template v-else-if="columnKey === 'finalPrice'">
    <a-input-number v-if="priceVisible" :value="record.guidePrice" :disabled="!priceEditable || busy" :min="0" :max="9999999999" :precision="2" :aria-label="`${record.name}${directQuotation ? '报价单价' : '指导价'}`" @change="update('guidePrice', $event)" />
    <div v-if="priceVisible && record._error" role="alert" class="fee-error">{{ record._error }}</div>
    <span v-if="!priceVisible">—</span>
  </template>
  <a-input v-else-if="columnKey === 'remark'" :value="record.remark" :disabled="!editable || busy" :maxlength="500" :aria-label="`${record.name}备注`" placeholder="选填" @change="update('remark', $event.target.value)" />
  <template v-else-if="columnKey === 'action'">
    <QuotationOpinionButton v-if="approvalEditable" :value="record.approvalOpinion" :name="record.name" :disabled="busy" @change="update('approvalOpinion', $event)" />
    <a-popconfirm v-else-if="structureEditable" title="从本报价移除该服务费？" @confirm="remove">
      <a-button type="link" size="small" danger :disabled="busy">移除</a-button>
    </a-popconfirm>
    <span v-else>—</span>
  </template>
  <template v-else-if="columnKey === 'approvalOpinion'">
    <span style="white-space: pre-wrap; overflow-wrap: anywhere">{{ record.approvalOpinion || '—' }}</span>
  </template>
  <span v-else>—</span>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import QuotationOpinionButton from './QuotationOpinionButton.vue';
  import { serviceFeePrice, quotationAmount, serviceFeeTaxText } from '../serviceFee';
  import { quotationPercent } from '../quotationPricing';
  import ServiceFeeUnitSelect from './ServiceFeeUnitSelect.vue';
  const props = defineProps<{
    record: Recordable;
    columnKey: string;
    editable: boolean;
    approvalEditable?: boolean;
    structureEditable: boolean;
    costEditable: boolean;
    priceVisible: boolean;
    rateVisible?: boolean;
    priceEditable: boolean;
    directQuotation?: boolean;
    busy: boolean;
  }>();
  // 使用本单输入框绑定的两个单价，不读取基础库、税率或指导比例。
  const quotationPercentText = computed(() => props.priceVisible && props.rateVisible !== false
    ? quotationPercent(props.record.costPrice, props.record.guidePrice) : '—');
  const emit = defineEmits<{ remove: [row: Recordable]; change: [row: Recordable, patch: Recordable] }>();
  function remove() {
    if (props.structureEditable && !props.busy) emit('remove', props.record);
  }
  function update(field: string, value: unknown) {
    if (field === 'markupRate' && props.rateVisible === false) return;
    const allowed = field === 'approvalOpinion' ? props.approvalEditable : field === 'unit' || field === 'quantity' ? props.structureEditable
      : field === 'costPrice' ? props.costEditable : field === 'remark' ? props.editable
      : ['markupRate', 'guidePrice'].includes(field) && props.priceVisible && props.priceEditable;
    if (!allowed || props.busy) return;
    const patch: Recordable = { [field]: value };
    const newSourceCost = field === 'costPrice' && !props.record.id && !!props.record.serviceFeeId;
    if (!props.directQuotation && (newSourceCost || (props.priceVisible && props.priceEditable)) && ['costPrice', 'markupRate'].includes(field)) {
      const row = { ...props.record, ...patch };
      try { patch.guidePrice = serviceFeePrice(row.costPrice, row.markupRate); patch._error = ''; }
      catch (error: any) { patch.guidePrice = null; patch._error = error.message; }
    }
    emit('change', props.record, patch);
  }
</script>

<style scoped>
  .fee-name { display: flex; flex-direction: column; gap: 4px; overflow-wrap: anywhere; }
  .fee-tax { font-size: 12px; line-height: 18px; color: #595959; }
  .fee-error { color: #cf1322; }
  .ant-input-number, :deep(.ant-input-number-group-wrapper) { width: 100%; min-width: 0; }
</style>
