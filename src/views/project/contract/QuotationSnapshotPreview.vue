<template>
  <div class="snapshot-preview">
    <div v-if="materialOnly" class="snapshot-sheet-scroll" tabindex="0" role="region" aria-label="合同物料及服务费快照，可横向滚动">
      <table class="snapshot-sheet">
        <caption>报价单物料及服务费清单</caption>
        <thead><tr><th v-for="header in materialHeaders" :key="header" scope="col">{{ header }}</th></tr></thead>
        <tbody>
          <tr v-for="(row, index) in materialRows" :key="index">
            <td>{{ index + 1 }}</td><td>{{ row.materialCategory || '—' }}</td>
            <td>{{ row.materialName || '—' }}</td>
            <td>{{ row.brand || '—' }}</td><td>{{ row.model || '—' }}</td><td>{{ row.quantity ?? '—' }}</td>
            <td>{{ row.unit || '—' }}</td><td class="sheet-text">{{ row.remark || '—' }}</td>
          </tr>
          <tr v-if="!materialRows.length"><td colspan="8">{{ !quotation ? '暂无物料及服务费快照' : Array.isArray(quotation.records) || Array.isArray(quotation.serviceFees) ? '本轮未提交物料或服务费' : '快照未提供物料及服务费明细' }}</td></tr>
        </tbody>
      </table>
    </div>
    <a-alert v-if="!materialOnly && !hideAmounts && !sheet.complete" type="info" show-icon :message="live ? '部分报价数据未提供或不可见，合计暂不展示。' : '部分送审数据未提供或不可见，仅展示本轮快照；合计暂不展示。'" />
    <div v-if="!materialOnly" class="snapshot-sheet-scroll" tabindex="0" role="region" aria-label="报价单快照表格，可横向滚动">
      <table class="snapshot-sheet">
        <caption>{{ sheet.title }}</caption>
        <colgroup><col v-for="(width, index) in visibleWidths" :key="index" :style="{ width: `${width / totalWidth * 100}%` }" /></colgroup>
        <thead><tr><th v-for="header in visibleHeaders" :key="header" scope="col">{{ header }}</th></tr></thead>
        <tbody>
          <tr v-for="(row, index) in sheet.rows" :key="index">
            <td>{{ index + 1 }}</td><td>{{ row.name || '—' }}</td><td>{{ row.brand || '' }}</td><td>{{ row.model || '' }}</td>
            <td class="sheet-text">{{ row.parameters || '' }}</td><td>{{ row.quantity ?? '—' }}</td><td>{{ row.unit || '' }}</td>
            <td v-if="!hideAmounts">{{ snapshotMoney(row.price) }}</td><td v-if="!hideAmounts">{{ snapshotMoney(row.amount) }}</td><td class="sheet-text">{{ row.remark || '' }}</td>
          </tr>
          <tr v-if="!sheet.rows.length"><td :colspan="visibleHeaders.length">{{ live ? '暂无可展示的报价明细' : '本轮快照未提供可展示的报价明细' }}</td></tr>
        </tbody>
        <tfoot v-if="!hideAmounts"><tr><th colspan="8" scope="row">合计</th><td>{{ snapshotMoney(sheet.total) }}</td><td></td></tr></tfoot>
      </table>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { contractSnapshotRows, quotationSnapshotPreview, snapshotMoney, snapshotQuotationHeaders, snapshotQuotationWidths } from './quotationSnapshotPreview';
const props = defineProps<{ quotation: Record<string, any> | null; live?: boolean; materialOnly?: boolean; hideAmounts?: boolean }>();
const visibleHeaders = computed(() => snapshotQuotationHeaders.filter((_, index) => !props.hideAmounts || (index !== 7 && index !== 8)));
const visibleWidths = computed(() => snapshotQuotationWidths.filter((_, index) => !props.hideAmounts || (index !== 7 && index !== 8)));
const totalWidth = computed(() => visibleWidths.value.reduce((sum, width) => sum + width, 0));
const materialHeaders = ['序号', '类别', '物料 / 服务费名称', '品牌', '型号', '数量', '单位', '备注'];
const materialRows = computed(() => contractSnapshotRows(props.quotation));
const sheet = computed(() => quotationSnapshotPreview(props.quotation));
</script>
<style scoped>
.snapshot-preview { display: grid; gap: 16px; }
.snapshot-sheet-scroll { overflow: auto; max-height: calc(100vh - 180px); }
.snapshot-sheet-scroll:focus-visible { outline: 2px solid #1677ff; outline-offset: 2px; }
.snapshot-sheet { border-collapse: collapse; table-layout: fixed; width: 100%; min-width: 1100px; color: #000; background: #fff; font-family: SimSun, 'Songti SC', serif; font-size: 14px; }
.snapshot-sheet caption { caption-side: top; border: 1px solid #000; border-bottom: 0; background: #00b0f0; color: #000; font-size: 19px; font-weight: 700; padding: 12px; overflow-wrap: anywhere; }
.snapshot-sheet th, .snapshot-sheet td { border: 1px solid #000; padding: 8px 4px; text-align: center; vertical-align: middle; white-space: pre-wrap; overflow-wrap: anywhere; }
.snapshot-sheet .sheet-text { text-align: left; }
.snapshot-sheet tfoot { font-weight: 700; }
</style>
