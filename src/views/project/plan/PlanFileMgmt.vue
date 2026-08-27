<template>
  <div class="plan-file-mgmt">
    <div class="plan-file-mgmt__toolbar">
      <a-button type="primary" preIcon="ant-design:plus-outlined" :disabled="!editable" @click="addRow">添加</a-button>
      <span class="plan-file-mgmt__tip">支持 PDF、Word、Excel、PPT；方案名称、类型和文件均为必填</span>
    </div>

    <a-table :loading="loading" :columns="columns" :data-source="list" :row-key="(record) => record._key" :pagination="false" size="middle" bordered>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'index'">
          {{ record._key }}
        </template>
        <template v-else-if="column.key === 'planName'">
          <a-input
            v-model:value="record.planName"
            :disabled="!editable || record._locked"
            placeholder="请输入方案名称"
            @change="record._dirty = true"
          />
        </template>
        <template v-else-if="column.key === 'planType'">
          <a-select
            v-model:value="record.planType"
            :disabled="!editable || record._locked"
            placeholder="请选择方案类型"
            style="width: 100%"
            :options="planTypeOptions"
            @change="record._dirty = true"
          />
        </template>
        <template v-else-if="column.key === 'planFileId'">
          <a-upload
            :accept="DOCUMENT_UPLOAD_ACCEPT"
            :before-upload="handleBeforeUpload"
            :disabled="!editable || record._locked"
            :file-list="record._uploadFileList"
            :max-count="1"
            :show-upload-list="{ showRemoveIcon: editable && !record._locked }"
            @change="(info) => handleUploadChange(record, info)"
            @preview="(file) => previewFileInModal(file, record._fileText)"
            @remove="() => handleRemoveFile(record)"
          >
            <a-button v-if="!record._uploadFileList.length && !record._locked" :disabled="!editable" preIcon="ant-design:cloud-upload-outlined">
              选择文件
            </a-button>
          </a-upload>
        </template>
        <template v-else-if="column.key === 'remark'">
          <a-input v-model:value="record.remark" :disabled="!editable || record._locked" placeholder="备注" @change="record._dirty = true" />
        </template>
        <template v-else-if="column.key === 'action'">
          <template v-if="editable">
            <a-button v-if="record._locked" type="link" size="small" @click="unlockRow(record)">修改</a-button>
            <a-button v-else type="link" size="small" :loading="record._saving" @click="saveRow(record)">保存</a-button>
            <a-popconfirm title="确认删除这条方案文件吗？" @confirm="removeRow(record)">
              <a-button type="link" danger size="small">删除</a-button>
            </a-popconfirm>
          </template>
        </template>
      </template>
    </a-table>
  </div>
</template>

<script lang="ts" setup>
  import { ref, unref, onMounted, watch } from 'vue';
  import { Upload } from 'ant-design-vue';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { DOCUMENT_UPLOAD_ACCEPT, isAllowedDocumentFile } from '/@/utils/documentUpload';
  import { getFileAccessHttpUrl } from '/@/utils/common/compUtils';
  import { previewFileInModal } from '/@/utils/filePreview';
  import { loadDictOptions } from '../Project.data';
  import { getPlan } from '../detail/ProjectDetail.api';
  import { addProjectPlan, deleteProjectPlansBatch, editProjectPlan } from './Plan.api';

  const { createMessage } = useMessage();

  const props = defineProps<{
    editable?: boolean;
    periodId?: string;
  }>();

  // 方案类型下拉(兜底: 字典 plan_type 加载失败时用)
  const planTypeFallback = [
    { label: '实施计划', value: '实施计划' },
    { label: '技术方案', value: '技术方案' },
    { label: '施工方案', value: '施工方案' },
  ];
  const planTypeOptions = ref<{ label: string; value: string }[]>(planTypeFallback);
  onMounted(async () => {
    planTypeOptions.value = await loadDictOptions('plan_type', planTypeFallback);
  });

  const columns = [
    { title: '序号', key: 'index', width: 60 },
    { title: '方案名称', key: 'planName', width: 200 },
    { title: '方案类型', key: 'planType', width: 140 },
    { title: '方案文件', key: 'planFileId', width: 260 },
    { title: '备注', key: 'remark' },
    { title: '操作', key: 'action', width: 130, align: 'center' },
  ];

  // 方案文件列表：进入页面时按项目分期从 project_plan 读取。
  const list = ref<any[]>([]);
  const loading = ref(false);
  let seed = 0;

  function normalizeFile(record: Recordable) {
    const fileId = record.fileId ?? record.planFileId ?? '';
    const fileName = record.fileName ?? record.planName ?? '';
    const key = ++seed;
    return {
      ...record,
      planName: fileName,
      planType: record.fileType ?? record.planType,
      planFileId: fileId,
      _key: key,
      _dirty: false,
      _locked: !!record.id,
      _pendingFile: undefined,
      _fileText: fileName || (fileId ? String(fileId).split('/').pop() : ''),
      _uploadFileList: fileId
        ? [
            {
              uid: `uploaded-${record.id || key}`,
              name: fileName || String(fileId).split('/').pop() || '已上传文件',
              status: 'done',
              url: getFileAccessHttpUrl(fileId),
            },
          ]
        : [],
    };
  }

  async function loadFiles() {
    if (!props.periodId) {
      list.value = [];
      return;
    }
    loading.value = true;
    try {
      const result: any = await getPlan({ periodId: props.periodId, pageNo: 1, pageSize: 1000 });
      const records = Array.isArray(result) ? result : result?.records || [];
      // 方案页只读取 project_plan；合同用料草稿等合同记录不属于方案文件。
      list.value = records
        .filter(
          (record: Recordable) =>
            (!record.periodId || String(record.periodId) === String(props.periodId)) && record.planType !== 'CONTRACT_MATERIAL_DRAFT'
        )
        .map(normalizeFile);
    } catch (error: any) {
      list.value = [];
      createMessage.warning(error?.message || '方案文件加载失败，请刷新后重试');
    } finally {
      loading.value = false;
    }
  }

  watch(() => props.periodId, loadFiles, { immediate: true });

  function handleBeforeUpload(file: File) {
    if (!isAllowedDocumentFile(file)) {
      createMessage.warning('仅支持 PDF、Word、Excel、PPT 文件');
      return Upload.LIST_IGNORE;
    }
    return false;
  }

  /** 选择后仅本地回显为完成态，避免未发起网络请求时持续显示上传转圈。 */
  function handleUploadChange(record: any, info: any) {
    const item = (info?.fileList || []).slice(-1)[0];
    if (!item) {
      record._uploadFileList = [];
      return;
    }
    const rawFile = item.originFileObj || info?.file?.originFileObj || info?.file;
    if (!(rawFile instanceof File)) return;
    record._pendingFile = rawFile;
    record._dirty = true;
    record._fileText = item.name || rawFile.name;
    record._uploadFileList = [
      {
        ...item,
        uid: item.uid || (rawFile as any).uid || `local-${Date.now()}`,
        name: item.name || rawFile.name,
        status: 'done',
        percent: 100,
        originFileObj: rawFile,
      },
    ];
  }

  function handleRemoveFile(record: any) {
    record.planFileId = '';
    record._fileText = '';
    record._uploadFileList = [];
    record._pendingFile = undefined;
    record._dirty = true;
    return true;
  }

  function addRow() {
    if (!props.editable) return;
    list.value.push({
      _key: ++seed,
      planName: '',
      planType: undefined,
      planFileId: '',
      _fileText: '',
      _uploadFileList: [],
      _pendingFile: undefined,
      _dirty: true,
      _locked: false,
      remark: '',
    });
  }

  function unlockRow(record: any) {
    record._locked = false;
  }

  async function removeRow(record: any) {
    if (record.id) await deleteProjectPlansBatch({ ids: record.id });
    list.value = list.value.filter((r) => r._key !== record._key);
  }

  function validateRow(record: any) {
    if (!record.planName) throw new Error('请填写方案名称');
    if (!record.planType) throw new Error('请选择方案类型');
    if (!record.planFileId && !record._pendingFile) throw new Error(`请上传方案「${record.planName}」的文件`);
  }

  async function saveRow(record: any, reloadAfterSave = true) {
    if (record._saving) return;
    if (!props.periodId) {
      createMessage.warning('缺少项目分期 ID，无法保存方案文件');
      throw new Error('period-id-empty');
    }
    try {
      validateRow(record);
    } catch (error: any) {
      createMessage.warning(error.message);
      throw error;
    }
    record._saving = true;
    try {
      const data = {
        ...(record.id ? { id: record.id } : {}),
        periodId: props.periodId,
        planName: record.planName,
        planType: record.planType,
        status: record.status || 'DRAFT',
        remark: record.remark,
      };
      if (record.id) await editProjectPlan(data, record._pendingFile);
      else await addProjectPlan(data, record._pendingFile);
      record._locked = true;
      record._dirty = false;
      record._pendingFile = undefined;
      createMessage.success(`方案文件「${record.planName}」保存成功`);
      if (reloadAfterSave) await loadFiles();
    } catch (error: any) {
      createMessage.warning(error?.message || '方案文件保存失败，请重试');
      throw error;
    } finally {
      record._saving = false;
    }
  }

  // 暴露给父级：整套保存时逐条保存新增或已修改的方案文件。
  defineExpose({
    async saveAll() {
      const rows = unref(list);
      if (!rows.length) {
        createMessage.warning('请至少添加一个方案文件');
        throw new Error('plan-empty');
      }
      try {
        rows.forEach(validateRow);
      } catch (error: any) {
        createMessage.warning(error.message);
        throw error;
      }
      for (const row of rows.filter((item) => !item.id || item._dirty)) await saveRow(row, false);
      await loadFiles();
    },
    setData(docs: any[]) {
      list.value = (docs || []).map(normalizeFile);
    },
    reload: loadFiles,
  });
</script>

<style lang="less" scoped>
  .plan-file-mgmt {
    &__toolbar {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    &__tip {
      color: #999;
      font-size: 13px;
    }

    :deep(.ant-upload-list) {
      max-width: 240px;
      margin-top: 0;
    }

    :deep(.ant-table-tbody > tr > td) {
      vertical-align: middle;
    }

    :deep(.ant-upload-wrapper) {
      display: flex;
      align-items: center;
      min-height: 32px;
    }

    :deep(.ant-upload-list-item-name) {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
</style>
