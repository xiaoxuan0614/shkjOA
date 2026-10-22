<template><a-space v-if="files.length" direction="vertical"><a-button v-for="file in files" :key="file.fileId" type="link" :loading="busy === file.fileId" :disabled="!!busy" @click="download(file)">{{ file.fileName || file.fileNameSnapshot || '下载附件' }}</a-button></a-space><span v-else>暂无可见附件</span></template>
<script setup lang="ts">
import { ref } from 'vue';
import { downloadByData } from '/@/utils/file/download';
import { useMessage } from '/@/hooks/web/useMessage';
import { repairAttachment, type Row } from './repair.api';
defineProps<{ files: Row[] }>();
const busy = ref('');
const { createMessage } = useMessage();
async function download(file: Row) {
  if (!file.fileId || busy.value) return;
  busy.value = file.fileId;
  try { downloadByData(await repairAttachment(file.fileId), file.fileName || file.fileNameSnapshot || '维修附件'); }
  catch(e) { createMessage.error((e as Error).message); }
  finally { busy.value = ''; }
}
</script>
