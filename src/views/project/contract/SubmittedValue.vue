<template>
  <a-table v-if="Array.isArray(value)" :columns="columns" :data-source="value.filter(row => row && typeof row === 'object')" :pagination="false" :scroll="{ x: 'max-content' }" size="small" bordered>
    <template #bodyCell="{ record, column }"><SubmittedValue :value="record[column.dataIndex]" /></template>
  </a-table>
  <a-descriptions v-else-if="value && typeof value === 'object'" :column="1" size="small" bordered>
    <a-descriptions-item v-for="(item, key) in value" :key="key" :label="labels[String(key)] || String(key)"><SubmittedValue :value="item" /></a-descriptions-item>
  </a-descriptions>
  <span v-else class="submitted-text">{{ value ?? '—' }}</span>
</template>
<script setup lang="ts">
import { computed } from 'vue';
defineOptions({ name: 'SubmittedValue' });
const props = defineProps<{ value: any }>();
const labels: Record<string, string> = {
 projectName:'主项目名称',periodName:'分期项目名称',customerName:'甲方名称',contactPerson:'项目对接人',projectRequirement:'项目需求',
 candidateName:'报价单名称',version:'送审版本',status:'送审状态',priced:'定价状态',items:'物料明细',
 materialCode:'物料编码',materialName:'物料名称',materialCategory:'类别',brand:'品牌',model:'型号',unit:'单位',quantity:'数量',
 basePrice:'成本价',markupRate:'指导比例',finalPrice:'指导价',remark:'备注',approvalOpinion:'审批意见',
 paymentNode:'回款节点',ratio:'回款比例',plannedAmount:'计划金额',rollbackTime:'回款周期',id:'编号',projectId:'项目编号',
};
const columns = computed(() => Array.isArray(props.value) ? [...new Set<string>(props.value.flatMap(row => row && typeof row === 'object' ? Object.keys(row) : []))].map(key => ({ title: labels[key] || key, dataIndex: key, key })) : []);
</script>
<style scoped>.submitted-text { white-space: pre-wrap; overflow-wrap: anywhere; }</style>
