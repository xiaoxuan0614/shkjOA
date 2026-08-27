<template>
  <div class="detail-basic">
    <div v-if="editable" class="detail-basic__toolbar">
      <a-button type="primary" ghost preIcon="ant-design:edit-outlined" @click="$emit('edit')">编辑</a-button>
    </div>
    <a-descriptions :column="2" bordered size="middle">
      <a-descriptions-item label="项目编号">{{ project.projectNo || '—' }}</a-descriptions-item>
      <a-descriptions-item label="分期名称">{{ project.periodName || '—' }}</a-descriptions-item>
      <a-descriptions-item label="主项目名称">{{ project.projectName || '—' }}</a-descriptions-item>
      <a-descriptions-item label="项目类型">{{ project.projectType || '—' }}</a-descriptions-item>
      <a-descriptions-item label="甲方名称">{{ project.customerName || '—' }}</a-descriptions-item>
      <a-descriptions-item label="甲方联系人">{{ project.contactPerson || '—' }}</a-descriptions-item>
      <a-descriptions-item label="甲方联系电话">{{ project.contactPhone || '—' }}</a-descriptions-item>
      <a-descriptions-item label="项目对接人">{{ project.projectLiaisonUserName || '—' }}</a-descriptions-item>
      <a-descriptions-item label="业务属性">{{ project.businessAttribute || '—' }}</a-descriptions-item>
      <a-descriptions-item label="涉及产品">{{ project.involvedProducts || '—' }}</a-descriptions-item>
      <a-descriptions-item label="进度(%)">{{ project.totalProgress ?? '—' }}</a-descriptions-item>
      <a-descriptions-item label="甲方信息">{{ project.customerInfo || '—' }}</a-descriptions-item>
      <a-descriptions-item label="项目地址" :span="2">{{ project.projectAddress || '—' }}</a-descriptions-item>
      <a-descriptions-item label="项目需求" :span="2">{{ project.projectRequirement || '—' }}</a-descriptions-item>
      <a-descriptions-item label="附件" :span="2">
        <a-button
          v-if="project.attachmentFileId"
          size="small"
          preIcon="ant-design:eye-outlined"
          @click="previewFileInModal(project.attachmentFileId)"
        >
          预览：{{ fileName(project.attachmentFileId) }}
        </a-button>
        <span v-else>—</span>
      </a-descriptions-item>
      <a-descriptions-item label="备注" :span="2">{{ project.remark || '—' }}</a-descriptions-item>
    </a-descriptions>
  </div>
</template>

<script lang="ts" setup>
  import { previewFileInModal } from '/@/utils/filePreview';

  defineProps<{
    project: Recordable;
    editable?: boolean;
  }>();
  defineEmits<{ (e: 'edit'): void }>();

  function fileName(path: string) {
    return decodeURIComponent(path.split('/').pop() || path);
  }
</script>

<style lang="less" scoped>
  .detail-basic__toolbar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 12px;
  }
</style>
