<template>
  <div class="detail-basic">
    <div v-if="editable" class="detail-basic__toolbar">
      <a-button type="primary" ghost preIcon="ant-design:edit-outlined" @click="$emit('edit')">编辑</a-button>
    </div>
    <a-descriptions :column="2" bordered size="middle">
      <a-descriptions-item label="项目名称"><span class="detail-basic__name">{{ projectDisplayName }}</span></a-descriptions-item>
      <a-descriptions-item label="项目类型">{{ projectTypeText || project.projectType || '—' }}</a-descriptions-item>
      <a-descriptions-item label="甲方名称">{{ project.customerName || '—' }}</a-descriptions-item>
      <a-descriptions-item label="甲方联系人">{{ project.contactPerson || '—' }}</a-descriptions-item>
      <a-descriptions-item label="甲方联系电话">{{ project.contactPhone || '—' }}</a-descriptions-item>
      <a-descriptions-item label="项目对接人">{{ project.projectLiaisonUserName || '—' }}</a-descriptions-item>
      <a-descriptions-item label="业务属性">{{ businessAttributeText || project.businessAttribute || '—' }}</a-descriptions-item>
      <a-descriptions-item label="涉及产品">{{ involvedProductsText || project.involvedProducts || '—' }}</a-descriptions-item>
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
  import { computed } from 'vue';
  import { previewFileInModal } from '/@/utils/filePreview';

  const props = defineProps<{
    project: Recordable;
    editable?: boolean;
    projectTypeText?: string;
    businessAttributeText?: string;
    involvedProductsText?: string;
  }>();
  defineEmits<{ (e: 'edit'): void }>();
  const projectDisplayName = computed(() =>
    [props.project.projectName, props.project.periodName].map((name) => String(name ?? '').trim()).filter(Boolean).join('-') || '—'
  );

  function fileName(path: string) {
    return decodeURIComponent(path.split('/').pop() || path);
  }
</script>

<style lang="less" scoped>
  .detail-basic__name {
    overflow-wrap: anywhere;
  }
  .detail-basic__toolbar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 12px;
  }
</style>
