<template>
  <a-descriptions
    v-if="Object.keys(record).length"
    class="plan-project-info"
    :column="4"
    size="small"
    bordered
  >
    <a-descriptions-item label="主项目名称">{{ record.projectName || '—' }}</a-descriptions-item>
    <a-descriptions-item label="分期名称">{{ record.periodName || '—' }}</a-descriptions-item>
    <a-descriptions-item label="甲方名称">{{ record.customerName || '—' }}</a-descriptions-item>
    <a-descriptions-item label="项目负责人">{{ record.projectLeaderName || '—' }}</a-descriptions-item>
  </a-descriptions>
</template>

<script lang="ts" setup>
  defineProps<{
    record: Recordable;
  }>();
</script>

<style lang="less" scoped>
  .plan-project-info {
    margin-bottom: 16px;
  }
</style>
