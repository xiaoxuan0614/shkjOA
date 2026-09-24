<template>
  <div class="workflow-page">
    <a-result v-if="!canManage" status="403" title="暂无流程管理权限" sub-title="需要流程管理功能权限及对应模型管理范围。" />
    <WorkflowEditor v-else-if="editing" :key="editorKey" :model="selected" @saved="onSaved" @close="closeEditor" />
    <section v-else class="model-list">
      <header
        ><div><h1>审批流程配置</h1><p>统一维护审批表单、人员和规则，发布后用于新的申请。</p></div
        ><a-space
          ><a-button @click="load">刷新</a-button><a-button type="primary" @click="create"><PlusOutlined />新建流程</a-button></a-space
        ></header
      >
      <a-alert v-if="error" type="error" show-icon :message="error"
        ><template #action><a-button size="small" @click="load">重试</a-button></template></a-alert
      >
      <a-table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        row-key="process_key"
        :scroll="{ x: 1100 }"
        :pagination="{ current: page, pageSize: 10, total, showSizeChanger: false, showTotal: (n) => `共 ${n} 个流程` }"
        @change="
          (p) => {
            page = p.current || 1;
            load();
          }
        "
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'"
            ><button type="button" class="model-name" @click="edit(record)">{{ record.name }}</button
            ><div class="model-key">{{ record.process_key }}</div></template
          >
          <template v-else-if="column.key === 'type'">{{ record.business_type === 'WORKFLOW_FORM' ? '自定义表单' : record.business_type }}</template>
          <template v-else-if="column.key === 'version'"
            ><a-tag v-if="record.published_version" color="blue">V{{ record.published_version }}</a-tag
            ><a-tag v-else>未发布</a-tag></template
          >
          <template v-else-if="column.key === 'state'"
            ><a-tag v-if="record.archived === 1">已归档</a-tag
            ><a-tag v-else :color="record.enabled === 1 ? 'green' : 'default'">{{ record.enabled === 1 ? '已启用' : '已停用' }}</a-tag></template
          >
          <template v-else-if="column.key === 'action'"
            ><a-space :size="8"
              ><a-button type="link" size="small" @click="edit(record)">{{ record.archived === 1 ? '查看' : '配置' }}</a-button
              ><a-button type="link" size="small" @click="history(record)">版本</a-button
              ><a-dropdown :trigger="['click']"
                ><a-button type="text" size="small">更多<DownOutlined /></a-button
                ><template #overlay
                  ><a-menu @click="({ key }) => operate(record, String(key))"
                    ><a-menu-item key="COPY">复制流程</a-menu-item
                    ><a-menu-item v-if="!record.archived" key="ENABLE" :disabled="!record.published_version">{{
                      record.enabled ? '停用新申请' : '启用新申请'
                    }}</a-menu-item
                    ><a-menu-item :key="record.archived ? 'RESTORE' : 'ARCHIVE'">{{
                      record.archived ? '恢复流程（保持停用）' : '归档流程'
                    }}</a-menu-item></a-menu
                  ></template
                ></a-dropdown
              ></a-space
            ></template
          >
        </template>
        <template #emptyText
          ><a-empty description="暂无可管理的流程"><a-button type="primary" @click="create">创建第一个流程</a-button></a-empty></template
        >
      </a-table>
    </section>
    <a-drawer v-model:open="versionsOpen" title="发布版本历史" width="min(760px, 96vw)">
      <a-alert type="info" show-icon message="回退会创建新的发布版本，不覆盖历史，不改变运行中的申请。" />
      <a-alert v-if="versionError" type="error" :message="versionError" show-icon />
      <a-spin :spinning="versionLoading"
        ><a-empty v-if="!versions.length" description="尚无发布版本" />
        <section v-for="version in versions" :key="version.id" class="version-row"
          ><div
            ><h3>V{{ version.version_no }}</h3
            ><p>{{ version.published_by }} · {{ version.published_at }}</p></div
          ><a-button :disabled="!!versionModel?.archived || versionBusy" @click="rollback(version.version_no)">以此版本发布</a-button></section
        >
      </a-spin>
    </a-drawer>
  </div>
</template>
<script setup lang="ts" name="WorkflowModelList">
  defineOptions({ name: 'WorkflowModelList' });
  import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
  import { Modal, message } from 'ant-design-vue';
  import { DownOutlined, PlusOutlined } from '@ant-design/icons-vue';
  import { usePermission } from '/@/hooks/web/usePermission';
  import { enableModel, listModels, modelVersions, operateModel } from './Workflow.api';
  import { newId, parseDefinition } from './workflow';
  import WorkflowEditor from './components/WorkflowEditor.vue';
  import type { WorkflowModel, WorkflowVersion } from './workflow.types';
  const { hasPermission } = usePermission();
  const canManage = computed(() => hasPermission('workflow:model:manage'));
  const rows = ref<WorkflowModel[]>([]),
    loading = ref(false),
    error = ref(''),
    page = ref(1),
    total = ref(0);
  const editing = ref(false),
    selected = ref<WorkflowModel>(),
    editorKey = ref('');
  const versions = ref<WorkflowVersion[]>([]),
    versionsOpen = ref(false),
    versionLoading = ref(false),
    versionBusy = ref(false),
    versionError = ref(''),
    versionModel = ref<WorkflowModel>();
  let generation = 0,
    versionGeneration = 0;
  const columns = [
    { title: '流程名称', key: 'name', width: 280 },
    { title: '流程类型', key: 'type', width: 140 },
    { title: '发布版本', key: 'version', width: 100 },
    { title: '状态', key: 'state', width: 100 },
    { title: '最近维护人', dataIndex: 'updated_by', width: 130 },
    { title: '最近维护时间', dataIndex: 'updated_at', width: 180 },
    { title: '操作', key: 'action', width: 190, fixed: 'right' },
  ];
  async function load() {
    if (!canManage.value) return;
    const current = ++generation;
    loading.value = true;
    error.value = '';
    try {
      const result = await listModels(page.value);
      if (current !== generation) return;
      rows.value = result.records;
      total.value = result.total;
    } catch (e) {
      if (current === generation) {
        error.value = (e as Error).message;
        rows.value = [];
      }
    } finally {
      if (current === generation) loading.value = false;
    }
  }
  function create() {
    selected.value = undefined;
    editorKey.value = newId('editor');
    editing.value = true;
  }
  function edit(model: WorkflowModel) {
    try {
      parseDefinition(model);
      selected.value = model;
      editorKey.value = `${model.process_key}_${model.revision}`;
      editing.value = true;
    } catch (e) {
      error.value = (e as Error).message;
    }
  }
  function onSaved(model: WorkflowModel) {
    const i = rows.value.findIndex((row) => row.process_key === model.process_key);
    if (i >= 0) rows.value[i] = model;
  }
  function closeEditor() {
    editing.value = false;
    load();
  }
  function operate(model: WorkflowModel, operation: string) {
    const label =
      operation === 'COPY'
        ? '复制流程'
        : operation === 'ENABLE'
          ? model.enabled
            ? '停用新申请'
            : '启用新申请'
          : operation === 'ARCHIVE'
            ? '归档流程'
            : '恢复流程';
    Modal.confirm({
      title: `${label}？`,
      content: operation === 'COPY' ? '将创建一个未发布的新流程。' : '历史记录和在途审批保留。归档及恢复后均停用新申请。',
      okText: label,
      cancelText: '取消',
      onOk: async () => {
        try {
          if (operation === 'ENABLE') await enableModel(model.process_key, model.revision, !model.enabled);
          else
            await operateModel({
              key: model.process_key,
              revision: model.revision,
              operation: operation as 'COPY' | 'ARCHIVE' | 'RESTORE',
              ...(operation === 'COPY' ? { newKey: newId('flow'), name: `${model.name}（副本）` } : {}),
            });
          message.success(`${label}成功`);
          await load();
        } catch (e) {
          await load();
          error.value = (e as Error).message;
          throw e;
        }
      },
    });
  }
  async function history(model: WorkflowModel) {
    const current = ++versionGeneration;
    versionsOpen.value = true;
    versionModel.value = model;
    versions.value = [];
    versionError.value = '';
    versionLoading.value = true;
    try {
      const result = await modelVersions(model.process_key);
      if (current === versionGeneration) versions.value = result;
    } catch (e) {
      if (current === versionGeneration) versionError.value = (e as Error).message;
    } finally {
      if (current === versionGeneration) versionLoading.value = false;
    }
  }
  function rollback(version: number) {
    const model = versionModel.value!;
    Modal.confirm({
      title: `以 V${version} 内容发布新版本？`,
      content: '当前草稿可能被历史版本内容替换，请确认已经保存所需配置。',
      okText: '确认发布',
      cancelText: '取消',
      onOk: async () => {
        versionBusy.value = true;
        try {
          await operateModel({ key: model.process_key, revision: model.revision, operation: 'ROLLBACK', version });
          versionsOpen.value = false;
          await load();
        } catch (e) {
          versionError.value = (e as Error).message;
          throw e;
        } finally {
          versionBusy.value = false;
        }
      },
    });
  }
  onMounted(load);
  onBeforeUnmount(() => {
    generation++;
    versionGeneration++;
  });
</script>
<style scoped>
  .workflow-page {
    margin: 16px;
  }
  .model-list {
    padding: 24px;
    background: var(--component-background, #fff);
  }
  header {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    align-items: center;
    margin-bottom: 24px;
  }
  h1 {
    font-size: 22px;
    font-weight: 600;
    margin: 0 0 8px;
  }
  header p {
    color: #595959;
    margin: 0;
  }
  .model-name {
    border: 0;
    padding: 0;
    background: transparent;
    color: var(--ant-primary-color, #1677ff);
    text-align: left;
    cursor: pointer;
    font-weight: 500;
  }
  .model-key {
    color: #595959;
    font-size: 12px;
    margin-top: 5px;
    overflow-wrap: anywhere;
  }
  .version-row {
    padding: 20px 0;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .version-row p {
    color: #595959;
    margin: 0;
  }
  .version-row h3 {
    margin: 0 0 6px;
  }
  .model-list > .ant-alert {
    margin-bottom: 16px;
  }
  @media (max-width: 760px) {
    .workflow-page {
      margin: 8px;
    }
    .model-list {
      padding: 16px;
    }
    header {
      align-items: flex-start;
      flex-direction: column;
    }
  }
</style>
