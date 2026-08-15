<template>
  <div class="detail-file">
    <div class="detail-file__toolbar">
      <a-button type="primary" preIcon="ant-design:cloud-upload-outlined" @click="handleUpload">新增文件</a-button>
      <input ref="fileInput" type="file" style="display: none" @change="handleFileChange" />
    </div>
    <a-table
      :columns="columns"
      :data-source="files"
      :pagination="false"
      size="middle"
      bordered
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'">
          <a-button type="link" size="small" @click="handleView(record)">查看</a-button>
          <a-button type="link" size="small" @click="handleDownload(record)">下载</a-button>
          <a-popconfirm title="是否确认删除" @confirm="handleDelete(record)">
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
  import { getFiles } from '../ProjectDetail.api';

  const props = defineProps<{
    projectId: string;
  }>();

  const { createMessage } = useMessage();
  const files = ref<any[]>([]);
  const fileInput = ref<HTMLInputElement | null>(null);

  // 设计稿列: 文件类型/附件/创建人/创建时间/操作
  const columns = [
    { title: '文件类型', dataIndex: 'fileType' },
    { title: '附件', dataIndex: 'fileName' },
    { title: '创建人', dataIndex: 'createBy' },
    { title: '创建时间', dataIndex: 'createTime' },
    { title: '操作', key: 'action', width: 160, align: 'center' },
  ];

  async function load() {
    const data = await getFiles({ projectId: props.projectId });
    files.value = data || [];
  }

  function handleUpload() {
    fileInput.value?.click();
  }

  function handleFileChange(e: any) {
    const file = e.target.files?.[0];
    if (file) {
      // 占位: 后续接真实上传接口
      createMessage.success(`已选择文件「${file.name}」(演示)`);
    }
    e.target.value = '';
  }

  function handleView(record: any) {
    createMessage.info(`查看文件「${record.fileName}」`);
  }

  function handleDownload(record: any) {
    createMessage.success(`开始下载「${record.fileName}」`);
  }

  function handleDelete(record: any) {
    createMessage.success(`删除文件「${record.fileName}」(演示)`);
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
