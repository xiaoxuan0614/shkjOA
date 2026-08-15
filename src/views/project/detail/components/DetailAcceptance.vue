<template>
  <div class="detail-acceptance">
    <!-- 内部验收：上传照片 + 填写内部验收负责人 -->
    <a-card title="内部验收" size="small" class="internal-card">
      <template #extra>
        <a-button type="primary" size="small" @click="handleSave">保存</a-button>
      </template>
      <a-form layout="inline" class="internal-form">
        <a-form-item label="内部验收负责人">
          <a-input
            v-model:value="form.internalOwner"
            placeholder="请输入内部验收负责人"
            style="width: 200px"
          />
        </a-form-item>
        <a-form-item label="内部验收日期">
          <a-date-picker v-model:value="form.internalDate" valueFormat="YYYY-MM-DD" style="width: 160px" />
        </a-form-item>
        <a-form-item label="内部验收照片">
          <j-upload-button
            type="primary"
            preIcon="ant-design:camera-outlined"
            @click="handleAddPhoto"
          >上传照片</j-upload-button>
        </a-form-item>
      </a-form>
      <!-- 照片墙 -->
      <div class="internal-photos">
        <div v-for="(img, i) in form.photos" :key="i" class="internal-photos__item">
          <a-image :src="img" :width="80" :height="80" />
          <a-button type="link" size="small" danger @click="removePhoto(i)">删除</a-button>
        </div>
        <span v-if="!form.photos.length" class="internal-photos__empty">暂无内部验收照片</span>
      </div>
    </a-card>

    <!-- 正式验收信息(只读) -->
    <a-descriptions :column="2" bordered size="middle">
      <a-descriptions-item label="验收日期">{{ acceptance.acceptanceDate || '—' }}</a-descriptions-item>
      <a-descriptions-item label="实施完成日期">{{ acceptance.completeDate || '—' }}</a-descriptions-item>
      <a-descriptions-item label="验收单位负责人">{{ acceptance.unitOwner || '—' }}</a-descriptions-item>
      <a-descriptions-item label="验收单位联系电话">{{ acceptance.unitPhone || '—' }}</a-descriptions-item>
      <a-descriptions-item label="验收负责人">{{ acceptance.acceptOwner || '—' }}</a-descriptions-item>
      <a-descriptions-item label="验收状态">
        <a-tag :color="acceptance.status === '已验收' ? 'success' : 'warning'">{{ acceptance.status || '—' }}</a-tag>
      </a-descriptions-item>
      <a-descriptions-item label="竣工报告" :span="2">{{ acceptance.completionReport || '—' }}</a-descriptions-item>
      <a-descriptions-item label="验收单" :span="2">{{ acceptance.acceptanceDoc || '—' }}</a-descriptions-item>
    </a-descriptions>
  </div>
</template>

<script lang="ts" setup>
  import { ref, reactive, watch } from 'vue';
  import { getAcceptance, saveAcceptance } from '../ProjectDetail.api';
  import { useMessage } from '/@/hooks/web/useMessage';

  const props = defineProps<{
    projectId: string;
  }>();

  const { createMessage } = useMessage();

  const acceptance = ref<any>({});
  // 内部验收表单(可编辑保存)
  const form = reactive<{ internalOwner: string; internalDate: string; photos: string[] }>({
    internalOwner: '',
    internalDate: '',
    photos: [],
  });

  async function load() {
    const data = await getAcceptance({ projectId: props.projectId });
    acceptance.value = data || {};
    // 回显内部验收信息(照片存 JSON 数组字符串，避免 base64 里的逗号被误拆)
    form.internalOwner = data.internalOwner || '';
    form.internalDate = data.internalDate || '';
    form.photos = parsePhotos(data.internalPhotos);
  }

  /** 内部验收照片：JSON 数组字符串 -> 数组(兼容旧的逗号分隔) */
  function parsePhotos(str?: string): string[] {
    if (!str) return [];
    try {
      const arr = JSON.parse(str);
      if (Array.isArray(arr)) return arr;
    } catch (e) {
      /* 非 JSON，走兼容逻辑 */
    }
    return String(str)
      .split(',')
      .filter(Boolean);
  }

  /**
   * 上传内部验收照片
   * JUploadButton 选中文件后回调的是 antd upload 的 options 对象，真正的文件在 file.file；
   * 用 FileReader 转 base64：mock 无后端存储，base64 可直接预览并随数据保存；
   * 正式后端接入后此处改为调 upload 接口返回文件路径即可。
   */
  function handleAddPhoto(file: any) {
    const rawFile = file?.file || file; // antd options.file / 直接 File 兜底
    if (!rawFile || typeof rawFile !== 'object' || !rawFile.name) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      form.photos.push(String(e.target?.result || ''));
    };
    reader.readAsDataURL(rawFile);
  }

  /** 删除某张照片 */
  function removePhoto(i: number) {
    form.photos.splice(i, 1);
  }

  /** 保存内部验收信息 */
  async function handleSave() {
    await saveAcceptance({
      projectId: props.projectId,
      internalOwner: form.internalOwner,
      internalDate: form.internalDate,
      // 照片存 JSON 数组字符串(base64 含逗号，不能用逗号分隔)
      internalPhotos: JSON.stringify(form.photos),
    });
    createMessage.success('内部验收信息保存成功');
    load();
  }

  watch(
    () => props.projectId,
    () => load(),
    { immediate: true }
  );
</script>

<style lang="less" scoped>
  .internal-card {
    margin-bottom: 16px;
  }

  .internal-form {
    margin-bottom: 8px;
  }

  .internal-photos {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;

    &__item {
      display: flex;
      flex-direction: column;
      align-items: center;
      border: 1px solid #eee;
      border-radius: 4px;
      padding: 4px;
    }

    &__empty {
      color: #999;
      font-size: 13px;
    }
  }
</style>
