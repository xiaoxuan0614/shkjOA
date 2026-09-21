<template>
  <div class="plan-file-mgmt">
    <div class="plan-file-mgmt__toolbar">
      <a-button type="primary" preIcon="ant-design:plus-outlined" :disabled="!canWrite" @click="addRow">添加</a-button>
      <span class="plan-file-mgmt__tip">方案记录及文件均选填；添加记录时名称、类型必填。支持 PDF、Word、Excel、PPT</span>
    </div>

    <a-table
      :loading="loading || saving"
      :columns="columns"
      :data-source="list"
      :row-key="(record) => record._key"
      :pagination="false"
      size="middle"
      bordered
    >
      <template #bodyCell="{ column, record, index }">
        <template v-if="column.key === 'index'">
          {{ index + 1 }}
        </template>
        <template v-else-if="column.key === 'planName'">
          <a-input v-model:value="record.planName" :disabled="!canWrite" placeholder="请输入方案名称" @change="record._dirty = true" />
        </template>
        <template v-else-if="column.key === 'planType'">
          <a-select
            v-model:value="record.planType"
            :disabled="!canWrite"
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
            :disabled="!canWrite"
            :file-list="record._uploadFileList"
            :max-count="1"
            :show-upload-list="{ showRemoveIcon: canWrite }"
            @change="(info) => handleUploadChange(record, info)"
            @preview="(file) => previewFileInModal(file, record._fileText)"
            @remove="() => handleRemoveFile(record)"
          >
            <a-button v-if="!record._uploadFileList.length && editable" :disabled="!canWrite" preIcon="ant-design:cloud-upload-outlined">
              选择文件
            </a-button>
          </a-upload>
        </template>
        <template v-else-if="column.key === 'remark'">
          <a-input v-model:value="record.remark" :disabled="!canWrite" placeholder="备注" @change="record._dirty = true" />
        </template>
        <template v-else-if="column.key === 'action'">
          <template v-if="editable">
            <a-popconfirm title="确认移除这条方案文件？保存本页后生效" @confirm="removeRow(record)">
              <a-button type="link" danger size="small" :disabled="!canWrite">删除</a-button>
            </a-popconfirm>
          </template>
        </template>
      </template>
    </a-table>
  </div>
</template>

<script lang="ts" setup>
  import { computed, ref, onMounted, watch } from 'vue';
  import { Upload } from 'ant-design-vue';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { DOCUMENT_UPLOAD_ACCEPT, isAllowedDocumentFile, uploadProjectDocument } from '/@/utils/documentUpload';
  import { getFileAccessHttpUrl } from '/@/utils/common/compUtils';
  import { previewFileInModal } from '/@/utils/filePreview';
  import { loadDictOptions } from '../Project.data';
  import { getPlan } from '../detail/ProjectDetail.api';
  import { addProjectPlansBatch, deleteProjectPlansBatch, editProjectPlan } from './Plan.api';

  const { createMessage } = useMessage();

  const props = defineProps<{
    editable?: boolean;
    periodId?: string;
  }>();

  const emit = defineEmits<{ 'persisted-change': [persisted: boolean] }>();

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
  const loaded = ref(false);
  const loadFailed = ref(false);
  const saving = ref(false);
  const deletedIds = ref<string[]>([]);
  const dirty = computed(() => deletedIds.value.length > 0 || list.value.some((item) => !item.id || item._dirty));
  const savedCount = computed(() => list.value.filter((item) => !!item.id).length);
  const canWrite = computed(() => !!props.editable && loaded.value && !loading.value && !loadFailed.value && !saving.value);
  let seed = 0;
  let loadSequence = 0;

  function ensureLoadedForWrite() {
    if (loading.value) {
      createMessage.warning('方案文件仍在加载，请稍后再操作');
      return false;
    }
    if (!loaded.value || loadFailed.value) {
      createMessage.warning('方案文件加载失败，为避免覆盖原数据，请刷新后重试');
      return false;
    }
    return true;
  }

  function assertLoadedForWrite() {
    if (loading.value) throw new Error('方案文件仍在加载，请稍后再保存');
    if (!loaded.value || loadFailed.value) throw new Error('方案文件加载失败，为避免覆盖原数据，请刷新后重试');
  }

  function normalizeFile(record: Recordable) {
    const fileId = record.fileId ?? record.planFileId ?? '';
    const fileName = record.fileName ?? record.planName ?? '';
    const key = ++seed;
    return {
      ...record,
      planName: record.planName ?? fileName,
      planType: record.fileType ?? record.planType,
      planFileId: fileId,
      _savedFileId: fileId,
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

  function setLoadedFiles(records: Recordable[], preserveLocalChanges: boolean) {
    const localChanges = preserveLocalChanges
      ? list.value.filter((item) => !item._saving && (!item.id || item._dirty)).map((item) => ({ ...item, _saving: false }))
      : [];
    if (!preserveLocalChanges) seed = 0;
    const loadedRows = records
      .filter(
        (record: Recordable) =>
          (!record.periodId || String(record.periodId) === String(props.periodId)) &&
          record.planType !== 'CONTRACT_MATERIAL_DRAFT' &&
          !deletedIds.value.includes(String(record.id))
      )
      .map(normalizeFile);

    localChanges.forEach((localRow) => {
      if (localRow.id) {
        const index = loadedRows.findIndex((item) => String(item.id) === String(localRow.id));
        if (index >= 0) loadedRows[index] = localRow;
        else loadedRows.push(localRow);
      } else {
        loadedRows.push(localRow);
      }
    });
    list.value = loadedRows;
    if (!preserveLocalChanges) emit('persisted-change', loadedRows.length > 0);
  }

  async function loadFiles(preserveLocalChanges = false) {
    const requestSequence = ++loadSequence;
    const periodId = props.periodId;
    if (!periodId) {
      list.value = [];
      loading.value = false;
      loaded.value = false;
      loadFailed.value = false;
      return;
    }
    if (!preserveLocalChanges) list.value = [];
    loading.value = true;
    loaded.value = false;
    loadFailed.value = false;
    try {
      const result: any = await getPlan({ periodId, pageNo: 1, pageSize: 1000 }, true);
      if (requestSequence !== loadSequence || periodId !== props.periodId) return;
      const records = Array.isArray(result) ? result : result?.records || [];
      // 方案页只读取 project_plan；合同用料草稿等合同记录不属于方案文件。
      setLoadedFiles(records, preserveLocalChanges);
      loaded.value = true;
    } catch (error: any) {
      if (requestSequence === loadSequence && periodId === props.periodId) {
        if (!preserveLocalChanges) list.value = [];
        loadFailed.value = true;
        loaded.value = false;
        createMessage.warning(error?.message || '方案文件加载失败，请刷新后重试');
      }
    } finally {
      if (requestSequence === loadSequence) loading.value = false;
    }
  }

  watch(
    () => props.periodId,
    () => {
      deletedIds.value = [];
      void loadFiles(false);
    },
    { immediate: true }
  );

  function handleBeforeUpload(file: File) {
    if (!canWrite.value) return Upload.LIST_IGNORE;
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
    if (!ensureLoadedForWrite() || saving.value) return false;
    record.planFileId = '';
    record._fileText = '';
    record._uploadFileList = [];
    record._pendingFile = undefined;
    record._dirty = true;
    return true;
  }

  function addRow() {
    if (!props.editable || !ensureLoadedForWrite() || saving.value) return;
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

  function removeRow(record: any) {
    if (!canWrite.value) return;
    if (record.id) deletedIds.value.push(String(record.id));
    list.value = list.value.filter((item) => item._key !== record._key);
  }

  function validateRow(record: any) {
    if (!record.planName) throw new Error('请填写方案名称');
    if (!record.planType) throw new Error('请选择方案类型');
    if (record._savedFileId && !record.planFileId && !record._pendingFile)
      throw new Error(`方案「${record.planName}」原附件仅支持替换，请选择新文件`);
  }

  function planPayload(record: any) {
    return {
      ...(record.id ? { id: record.id } : {}),
      planName: record.planName,
      planType: record.planType,
      ...(!record.id ? { status: '-1' } : {}),
      ...(record.planFileId ? { planFileId: record.planFileId } : {}),
      remark: record.remark,
    };
  }

  async function saveAll() {
    assertLoadedForWrite();
    if (!props.editable || saving.value) throw new Error('方案文件当前不可保存');
    const periodId = props.periodId;
    if (!periodId) throw new Error('缺少项目分期 ID');
    list.value.forEach(validateRow);
    saving.value = true;
    const isCurrent = () => periodId === props.periodId;
    const refreshSaved = async () => {
      if (!isCurrent()) throw new Error('项目分期已切换，请在原分期确认保存结果');
      await loadFiles(true);
      if (!isCurrent() || !loaded.value || loadFailed.value) throw new Error('部分方案文件已保存，但回查失败，请刷新确认后继续');
    };
    try {
      // 每次成功后回查并保留其余草稿，后续失败重试不会重新新增已完成的记录。
      while (true) {
        const row = list.value.find((item) => item.id && item._dirty);
        if (!row) break;
        row._saving = true;
        try {
          if (row._pendingFile) {
            row.planFileId = (await uploadProjectDocument(row._pendingFile, periodId)).path;
            row._pendingFile = undefined;
          }
          await editProjectPlan({ ...planPayload(row), periodId });
          row._dirty = false;
          row._pendingFile = undefined;
          await refreshSaved();
        } catch (error: any) {
          throw new Error(`方案「${row.planName}」保存未完成：${error?.message || '请重试'}`);
        } finally {
          row._saving = false;
        }
      }
      const additions = list.value.filter((item) => !item.id);
      if (additions.length) {
        additions.forEach((row) => (row._saving = true));
        try {
          for (const row of additions) {
            if (!row._pendingFile) continue;
            const { path } = await uploadProjectDocument(row._pendingFile, periodId);
            row.planFileId = path;
            row._pendingFile = undefined;
          }
          await addProjectPlansBatch(
            periodId,
            additions.map((row) => ({ plan: planPayload(row) }))
          );
          await refreshSaved();
        } finally {
          additions.forEach((row) => (row._saving = false));
        }
      }
      if (!isCurrent()) throw new Error('项目分期已切换，请在原分期确认保存结果');
      if (deletedIds.value.length) {
        await deleteProjectPlansBatch({ ids: deletedIds.value.join(',') }, false);
        if (!isCurrent()) throw new Error('项目分期已切换，请在原分期确认保存结果');
        deletedIds.value = [];
      }
      await loadFiles(false);
      if (!isCurrent() || !loaded.value || loadFailed.value) throw new Error('方案文件已提交，但回查失败，请刷新确认');
    } finally {
      saving.value = false;
    }
  }

  defineExpose({
    saveAll,
    setData(docs: any[]) {
      loadSequence += 1;
      loading.value = false;
      loaded.value = true;
      loadFailed.value = false;
      setLoadedFiles(docs || [], false);
    },
    reload: () => loadFiles(false),
    getSubmissionState() {
      return {
        loading: loading.value,
        loaded: loaded.value,
        loadFailed: loadFailed.value,
        saving: saving.value,
        dirty: dirty.value,
        hasData: savedCount.value > 0,
        savedCount: savedCount.value,
        sequence: loadSequence,
      };
    },
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
