<template>
  <a-space v-if="isFile && files.length && allowFilePreview" direction="vertical">
    <a-button v-for="file in files" :key="file" type="link" @click="previewFileInModal(file)">预览：{{ file.split('/').pop() }}</a-button>
  </a-space>
  <span v-else-if="isFile">{{ value ? '附件已上传（本入口暂不支持查看）' : '—' }}</span>
  <SnapshotContent v-else :value="value" :path="field?.key" :fields="fields" :permissions="permissions" />
</template>
<script setup lang="ts">
  import { computed } from 'vue';
  import { previewFileInModal } from '/@/utils/filePreview';
  import type { FormField } from '../workflow.types';
  import SnapshotContent from './SnapshotContent.vue';
  const props = defineProps<{ field?: FormField; value: unknown; fields?: FormField[]; permissions?: Record<string, string>; allowFilePreview?: boolean }>();
  const isFile = computed(() => props.field?.type === 'attachment' || ['contractFileId', 'materialFileId'].includes(props.field?.key || ''));
  const files = computed(() => isFile.value && typeof props.value === 'string' ? props.value.split(',').map((s) => s.trim()).filter(Boolean) : []);
</script>
