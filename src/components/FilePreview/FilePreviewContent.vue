<template>
  <div class="file-preview-content">
    <div v-if="loading" class="file-preview-content__state" aria-live="polite">
      <a-spin size="large" />
      <span>正在读取文件内容…</span>
    </div>

    <a-result v-else-if="errorMessage" status="warning" title="文件内容预览失败" :sub-title="errorMessage">
      <template #extra>
        <a-button @click="loadPreview">重新加载</a-button>
      </template>
    </a-result>

    <img v-else-if="previewKind === 'image'" class="file-preview-content__image" :src="objectUrl" :alt="fileName" @error="handleRenderError" />
    <iframe
      v-else-if="previewKind === 'pdf'"
      class="file-preview-content__frame"
      :src="objectUrl"
      :title="`${fileName}文件内容预览`"
      @error="handleRenderError"
    />
    <component
      :is="officeComponent"
      v-else-if="officeComponent && officeSource"
      class="file-preview-content__office"
      :src="officeSource"
      @rendered="handleRendered"
      @error="handleRenderError"
    />
  </div>
</template>

<script lang="ts" setup>
  import { computed, defineAsyncComponent, onBeforeUnmount, ref, watch } from 'vue';
  import { getHeaders } from '/@/utils/common/compUtils';
  import { useGlobSetting } from '/@/hooks/setting';
  import { trustedFileUrl } from '/@/utils/security';

  const settings = useGlobSetting();
  const maxBytes = 20 * 1024 * 1024;
  let controller: AbortController | undefined;
  let sequence = 0;

  const props = defineProps<{
    source: string | File;
    fileName: string;
    extension: string;
  }>();

  const VueOfficeDocx = defineAsyncComponent(() => import('@vue-office/docx'));
  const VueOfficeExcel = defineAsyncComponent(() => import('@vue-office/excel'));
  const VueOfficePptx = defineAsyncComponent(() => import('@vue-office/pptx'));

  const imageExtensions = new Set(['bmp', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp']);
  const loading = ref(true);
  const errorMessage = ref('');
  const objectUrl = ref('');
  const officeSource = ref<ArrayBuffer>();

  const previewKind = computed(() => {
    if (imageExtensions.has(props.extension)) return 'image';
    if (props.extension === 'pdf') return 'pdf';
    if (['docx'].includes(props.extension)) return 'docx';
    if (['xls', 'xlsx'].includes(props.extension)) return 'excel';
    if (props.extension === 'pptx') return 'pptx';
    return 'unsupported';
  });

  const officeComponent = computed(() => {
    if (previewKind.value === 'docx') return VueOfficeDocx;
    if (previewKind.value === 'excel') return VueOfficeExcel;
    if (previewKind.value === 'pptx') return VueOfficePptx;
    return null;
  });

  function clearObjectUrl() {
    if (objectUrl.value) URL.revokeObjectURL(objectUrl.value);
    objectUrl.value = '';
  }

  async function readFileBuffer(signal: AbortSignal) {
    if (props.source instanceof File) {
      if (props.source.size > maxBytes) throw new Error('预览文件不能超过 20 MB');
      return props.source.arrayBuffer();
    }
    const { url, trusted } = trustedFileUrl(props.source, window.location.href, [settings.apiUrl, settings.domainUrl]);
    const response = await fetch(url, {
      credentials: trusted ? 'same-origin' : 'omit',
      headers: trusted ? getHeaders() as HeadersInit : {},
      redirect: 'error',
      signal,
    });
    if (!response.ok) throw new Error(`文件读取失败（${response.status}）`);
    if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('预览文件不能超过 20 MB');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('浏览器不支持安全文件预览，请升级浏览器');
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error('预览文件不能超过 20 MB');
      }
      chunks.push(value);
    }
    const result = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
    return result.buffer;
  }

  function getMimeType() {
    if (previewKind.value === 'pdf') return 'application/pdf';
    if (props.extension === 'svg') return 'image/svg+xml';
    return `image/${props.extension === 'jpg' ? 'jpeg' : props.extension}`;
  }

  async function loadPreview() {
    const current = ++sequence;
    controller?.abort();
    const request = new AbortController();
    controller = request;
    const timeout = window.setTimeout(() => request.abort(), 30000);
    loading.value = true;
    errorMessage.value = '';
    officeSource.value = undefined;
    clearObjectUrl();
    try {
      if (previewKind.value === 'unsupported') {
        throw new Error('暂不支持旧版 .doc 或 .ppt 内容渲染，请另存为 .docx 或 .pptx 后重新上传。');
      }
      const buffer = await readFileBuffer(request.signal);
      if (current !== sequence) return;
      if (previewKind.value === 'image' || previewKind.value === 'pdf') {
        objectUrl.value = URL.createObjectURL(new Blob([buffer], { type: getMimeType() }));
      } else {
        officeSource.value = buffer;
      }
    } catch (error: any) {
      if (current !== sequence) return;
      errorMessage.value = error?.name === 'AbortError' ? '文件读取超时，请重试。' : error?.message || '文件读取失败，请检查文件是否存在或联系管理员。';
    } finally {
      window.clearTimeout(timeout);
      if (current === sequence) loading.value = false;
    }
  }

  function handleRendered() {
    loading.value = false;
  }

  function handleRenderError(error?: any) {
    errorMessage.value = error?.message || '文件格式无法解析，请确认文件内容完整后重试。';
    loading.value = false;
  }

  watch(() => [props.source, props.extension], loadPreview, { immediate: true });
  onBeforeUnmount(() => { sequence++; controller?.abort(); clearObjectUrl(); });
</script>

<style lang="less">
  @import '@vue-office/docx/lib/index.css';
  @import '@vue-office/excel/lib/index.css';

  .file-preview-content {
    position: relative;
    height: min(72vh, 820px);
    min-height: 360px;
    overflow: auto;
    background: #f5f5f5;
    border: 1px solid #e8e8e8;
    border-radius: 8px;

    &__state {
      position: absolute;
      inset: 0;
      z-index: 2;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 14px;
      color: #595959;
      background: rgba(255, 255, 255, 0.92);
    }

    &__image,
    &__frame,
    &__office {
      display: block;
      width: 100%;
      min-height: 100%;
      border: 0;
    }

    &__image {
      height: 100%;
      object-fit: contain;
    }

    &__frame {
      height: 100%;
      background: #fff;
    }

    &__office {
      background: #fff;
    }
  }
</style>
