<template>
  <div class="detail-basic">
    <a-descriptions :column="2" bordered size="middle">
      <a-descriptions-item label="项目ID">{{ project.projectNo || '—' }}</a-descriptions-item>
      <a-descriptions-item label="项目名称">{{ project.projectName || '—' }}</a-descriptions-item>
      <a-descriptions-item label="项目类型">{{ project.projectType || '—' }}</a-descriptions-item>
      <a-descriptions-item label="甲方名称">{{ project.customerName || '—' }}</a-descriptions-item>
      <a-descriptions-item label="甲方联系人">{{ project.contact || '—' }}</a-descriptions-item>
      <a-descriptions-item label="甲方联系电话">{{ project.phone || '—' }}</a-descriptions-item>
      <a-descriptions-item label="项目负责人">{{ project.manager || '—' }}</a-descriptions-item>
      <a-descriptions-item label="质保期">{{ project.warranty || '—' }}</a-descriptions-item>
      <a-descriptions-item label="合同金额">{{ project.contractAmount || '—' }}</a-descriptions-item>
      <a-descriptions-item label="已回款金额">{{ project.receivedAmount || 0 }}</a-descriptions-item>
      <a-descriptions-item label="项目地址" :span="2">{{ project.address || '—' }}</a-descriptions-item>
      <a-descriptions-item label="项目需求" :span="2">{{ project.requirement || '—' }}</a-descriptions-item>
      <a-descriptions-item label="附件" :span="2">{{ project.attachment || '—' }}</a-descriptions-item>
      <a-descriptions-item label="备注" :span="2">{{ project.remark || '—' }}</a-descriptions-item>
    </a-descriptions>
  </div>
</template>

<script lang="ts" setup>
  defineProps<{
    project: Recordable;
  }>();
</script>
