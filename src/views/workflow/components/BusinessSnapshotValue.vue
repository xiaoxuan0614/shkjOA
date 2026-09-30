<template>
  <a-space v-if="isFile && files.length" direction="vertical">
    <a-button v-for="file in files" :key="file" type="link" @click="previewFileInModal(file)">预览：{{ file.split('/').pop() }}</a-button>
  </a-space>
  <pre v-else class="business-snapshot-value">{{ displayValue }}</pre>
</template>
<script setup lang="ts">
  import { computed } from 'vue';
  import { previewFileInModal } from '/@/utils/filePreview';
  import type { FormField } from '../workflow.types';
  const props = defineProps<{ field?: FormField; value: unknown }>();
  const isFile = computed(() => props.field?.type === 'attachment' || ['contractFileId', 'materialFileId'].includes(props.field?.key || ''));
  const files = computed(() => isFile.value && typeof props.value === 'string' ? props.value.split(',').map((s) => s.trim()).filter(Boolean) : []);
  const displayValue = computed(() => {
    if (props.value == null || props.value === '') return '—';
    if (props.field?.key === 'paymentPlan' && typeof props.value === 'string') {
      try { return JSON.stringify(JSON.parse(props.value), null, 2); } catch { return props.value; }
    }
    return typeof props.value === 'object' ? JSON.stringify(props.value, null, 2) : String(props.value);
  });
</script>
<style scoped>
  .business-snapshot-value { margin: 0; font: inherit; white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
