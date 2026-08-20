<template>
  <div class="detail-basic">
    <a-descriptions :column="2" bordered size="middle">
      <a-descriptions-item label="项目编号">{{ project.projectNo || '—' }}</a-descriptions-item>
      <a-descriptions-item label="分期名称">{{ project.periodName || '—' }}</a-descriptions-item>
      <a-descriptions-item label="主项目名称">{{ project.projectName || '—' }}</a-descriptions-item>
      <a-descriptions-item label="项目类型">{{ project.projectType || '—' }}</a-descriptions-item>
      <a-descriptions-item label="甲方名称">{{ project.customerName || '—' }}</a-descriptions-item>
      <a-descriptions-item label="甲方联系人">{{ project.contactPerson || '—' }}</a-descriptions-item>
      <a-descriptions-item label="甲方联系电话">{{ project.contactPhone || '—' }}</a-descriptions-item>
      <a-descriptions-item label="项目负责人">{{ project.projectLeaderName || '—' }}</a-descriptions-item>
      <a-descriptions-item label="业务属性">{{ project.businessAttribute || '—' }}</a-descriptions-item>
      <a-descriptions-item label="涉及产品">{{ project.involvedProducts || '—' }}</a-descriptions-item>
      <a-descriptions-item label="进度(%)">{{ project.totalProgress ?? '—' }}</a-descriptions-item>
      <a-descriptions-item label="甲方信息">{{ project.customerInfo || '—' }}</a-descriptions-item>
      <a-descriptions-item label="项目地址" :span="2">{{ project.projectAddress || '—' }}</a-descriptions-item>
      <a-descriptions-item label="项目需求" :span="2">{{ project.projectRequirement || '—' }}</a-descriptions-item>
      <a-descriptions-item label="附件" :span="2">{{ project.attachmentFileId || '—' }}</a-descriptions-item>
      <a-descriptions-item label="备注" :span="2">{{ project.remark || '—' }}</a-descriptions-item>
    </a-descriptions>
  </div>
</template>

<script lang="ts" setup>
  defineProps<{
    project: Recordable;
  }>();
</script>
