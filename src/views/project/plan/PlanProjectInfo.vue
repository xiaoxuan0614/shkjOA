<template>
  <a-descriptions
    v-if="Object.keys(record).length"
    class="plan-project-info"
    :column="{ xs: 1, sm: 2, md: 3, lg: 3, xl: 3, xxl: 3 }"
    size="small"
    bordered
  >
    <a-descriptions-item label="主项目名称">{{ record.projectName || '—' }}</a-descriptions-item>
    <a-descriptions-item :label="periodNameLabel">{{ record.periodName || '—' }}</a-descriptions-item>
    <a-descriptions-item label="甲方名称">{{ record.customerName || '—' }}</a-descriptions-item>
    <template v-if="showPlanFields">
      <a-descriptions-item label="项目经理">{{ record.projectManagerUserName || '—' }}</a-descriptions-item>
      <a-descriptions-item label="合同签订时间">{{ record.contractSignedDate || '—' }}</a-descriptions-item>
      <a-descriptions-item label="计划交付日期">{{ record.plannedDeliveryDate || '—' }}</a-descriptions-item>
    </template>
    <a-descriptions-item v-else label="项目对接人">{{ record.projectLiaisonUserName || '—' }}</a-descriptions-item>
  </a-descriptions>
</template>

<script lang="ts" setup>
  withDefaults(
    defineProps<{
      record: Recordable;
      periodNameLabel?: string;
      showPlanFields?: boolean;
    }>(),
    {
      periodNameLabel: '分期项目名称',
      showPlanFields: true,
    }
  );
</script>

<style lang="less" scoped>
  .plan-project-info {
    margin-bottom: 16px;
  }
</style>
