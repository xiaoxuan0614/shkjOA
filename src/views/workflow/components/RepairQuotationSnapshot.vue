<template>
  <section class="repair-quotation" aria-label="维修报价详情">
    <a-descriptions v-if="presentation.info.length" bordered :column="1" size="small">
      <a-descriptions-item v-for="row in presentation.info" :key="row.label" :label="row.label"><span class="repair-quotation__text">{{ row.value }}</span></a-descriptions-item>
    </a-descriptions>
    <template v-if="presentation.showItems">
      <h3>报价信息</h3>
      <a-table :columns="presentation.columns" :data-source="presentation.items" :pagination="false" size="small" bordered :scroll="{ x: 520 }" />
      <div v-if="presentation.total !== undefined" class="repair-quotation__total"><span>报价合计</span><strong>¥ {{ presentation.total }}</strong></div>
    </template>
  </section>
</template>
<script setup lang="ts">
  import { computed } from 'vue';
  import { repairQuotationPresentation } from '../repairQuotationPresentation';
  const props = defineProps<{ visible: Record<string, unknown>; permissions?: Record<string, string> }>();
  const presentation = computed(() => repairQuotationPresentation(props.visible, props.permissions));
</script>
<style scoped>
  .repair-quotation__text { white-space: pre-wrap; overflow-wrap: anywhere; }
  .repair-quotation h3 { margin: 20px 0 10px; font-size: 15px; font-weight: 600; }
  .repair-quotation__total { display: flex; justify-content: flex-end; align-items: baseline; gap: 16px; padding: 16px; background: #fafafa; }
  .repair-quotation__total strong { font-size: 20px; font-variant-numeric: tabular-nums; }
</style>
