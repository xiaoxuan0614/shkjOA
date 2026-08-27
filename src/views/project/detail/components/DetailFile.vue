<template>
  <div class="detail-file">
    <div v-if="editable && files.length === 0" class="detail-file__toolbar">
      <a-upload :accept="DOCUMENT_UPLOAD_ACCEPT" :show-upload-list="false" :before-upload="handleFileChange">
        <a-button type="primary" preIcon="ant-design:cloud-upload-outlined">新增文件</a-button>
      </a-upload>
    </div>
    <a-table :columns="columns" :data-source="files" :pagination="false" size="middle" bordered>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'">
          <a-button size="small" preIcon="ant-design:eye-outlined" @click="handleView(record)">预览</a-button>
          <a-popconfirm v-if="editable" title="是否确认删除" @confirm="handleDelete(record)">
            <a-button type="link" size="small" danger>删除</a-button>
          </a-popconfirm>
        </template>
      </template>
    </a-table>
  </div>
</template>

<script lang="ts" setup>
  import { ref, watch } from 'vue';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { getFiles, addFile, deleteFile } from '../ProjectDetail.api';
  import { DOCUMENT_UPLOAD_ACCEPT, isAllowedDocumentFile, uploadProjectDocument } from '/@/utils/documentUpload';
  import { previewFileInModal } from '/@/utils/filePreview';

  const props = defineProps<{
    projectId: string;
    editable?: boolean;
  }>();

  const { createMessage } = useMessage();
  const files = ref<any[]>([]);

  // 后端 project_file 字段
  const columns = [
    { title: '文件类型', dataIndex: 'fileType' },
    { title: '附件', dataIndex: 'fileName' },
    { title: '创建人', dataIndex: 'createBy' },
    { title: '创建时间', dataIndex: 'createTime' },
    { title: '操作', key: 'action', width: 140, align: 'center' },
  ];

  async function load() {
    const res: any = await getFiles({ periodId: props.projectId, pageNo: 1, pageSize: 100 });
    const list = res?.records || res || [];
    files.value = list || [];
  }

  /** 选择文件 → 上传 → 校验响应后把 message 路径写入项目文件记录。 */
  async function handleFileChange(file: any): Promise<boolean> {
    if (!file) return false;
    if (!isAllowedDocumentFile(file)) {
      createMessage.warning('仅支持 PDF、Word、Excel、PPT 文件');
      return false;
    }
    try {
      const { path } = await uploadProjectDocument(file, props.projectId);
      await addFile({ periodId: props.projectId, fileName: file.name, fileId: path, fileType: '' });
      createMessage.success(`文件「${file.name}」上传成功`);
      load();
    } catch (error: any) {
      createMessage.warning(error?.message || '上传失败，请重试');
    }
    return false;
  }

  function handleView(record: any) {
    previewFileInModal(record.fileId, record.fileName);
  }

  async function handleDelete(record: any) {
    await deleteFile({ ids: record.id });
    createMessage.success(`删除文件「${record.fileName}」成功`);
    load();
  }

  watch(
    () => props.projectId,
    () => load(),
    { immediate: true }
  );
</script>

<style lang="less" scoped>
  .detail-file {
    &__toolbar {
      margin-bottom: 12px;
    }
  }
</style>
