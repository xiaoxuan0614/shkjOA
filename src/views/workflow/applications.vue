<template>
  <div class="applications-page">
    <header><h1>通用审批申请</h1><a-button :disabled="loading" @click="load">刷新</a-button></header>
    <a-tabs v-model:activeKey="tab" @change="changeTab"
      ><a-tab-pane key="available" tab="发起申请" /><a-tab-pane key="mine" tab="我发起的" /><a-tab-pane key="tasks" tab="待我审批"
    /></a-tabs>
    <a-alert v-if="error" :message="error" type="error" show-icon />
    <a-table
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :row-key="(r) => r.id || r.process_key"
      :pagination="{ current: page, pageSize: 10, total, showSizeChanger: false }"
      :scroll="{ x: 700 }"
      @change="
        (p) => {
          page = p.current || 1;
          load();
        }
      "
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'name'">{{ record.name || record.processKey }}</template>
        <template v-else-if="column.key === 'status'">{{
          statusLabels[record.status] || (record.published_version ? `V${record.published_version}` : '待办理')
        }}</template>
        <template v-else-if="column.key === 'action'"
          ><a-button v-if="tab === 'available'" type="link" :disabled="record.business_type !== 'WORKFLOW_FORM'" @click="openForm(record)">{{
            record.business_type === 'WORKFLOW_FORM' ? '填写申请' : '由业务页面发起'
          }}</a-button
          ><a-button v-else type="link" @click="openDetail(record.instanceId || record.id)">查看详情</a-button></template
        >
      </template>
    </a-table>
    <a-drawer
      :open="formOpen"
      :title="form?.name || '填写申请'"
      width="min(720px, 96vw)"
      :mask-closable="false"
      :closable="!submitting && !uploading"
      @close="closeForm"
    >
      <a-alert v-if="formError" type="error" :message="formError" show-icon />
      <a-spin :spinning="formLoading"
        ><RequestForm
          v-if="form"
          :key="businessId"
          :fields="form.fields"
          :permissions="form.fieldPermissions || {}"
          v-model:value="formData"
          :disabled="submitting || submitted || !!pendingSubmission"
          @uploading="(v) => (uploading = v)"
      /></a-spin>
      <a-alert
        v-if="pendingSubmission && !submitting"
        type="warning"
        message="提交结果尚未确认，已锁定本次内容；再次提交将使用同一请求重试。也可关闭后在我发起的中核对。"
      />
      <a-alert v-if="preview" type="info" message="路线预览（实际激活时重新校验人员）"
        ><template #description>
          <pre>{{ JSON.stringify(preview, null, 2) }}</pre>
        </template></a-alert
      >
      <template #footer
        ><div class="drawer-actions"
          ><a-button :disabled="submitting || uploading" @click="closeForm">取消</a-button
          ><a-button :disabled="!form || formLoading || uploading || submitting || submitted" :loading="previewLoading" @click="previewRoute"
            >预览路线</a-button
          ><a-button type="primary" :disabled="!form || formLoading || uploading || submitted || previewLoading" :loading="submitting" @click="submit"
            >提交申请</a-button
          ></div
        ></template
      >
    </a-drawer>
    <InstanceDrawer :open="detailOpen" :instance-id="detailId" @close="detailOpen = false" @processed="load" />
  </div>
</template>
<script setup lang="ts" name="WorkflowApplications">
  defineOptions({ name: 'WorkflowApplications' });
  import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
  import { Modal } from 'ant-design-vue';
  import { availableModels, modelForm, myInstances, myTasks, previewModel, startInstance } from './Workflow.api';
  import { newId, statusLabels } from './workflow';
  import RequestForm from './components/RequestForm.vue';
  import InstanceDrawer from './components/InstanceDrawer.vue';
  const tab = ref('available'),
    page = ref(1),
    total = ref(0),
    rows = ref<any[]>([]),
    loading = ref(false),
    error = ref('');
  const formOpen = ref(false),
    formLoading = ref(false),
    formError = ref(''),
    form = ref<Awaited<ReturnType<typeof modelForm>>>(),
    formData = ref<Record<string, any>>({}),
    uploading = ref(false),
    submitting = ref(false),
    submitted = ref(false),
    previewLoading = ref(false),
    preview = ref<Record<string, unknown>>();
  const pendingSubmission = ref<Parameters<typeof startInstance>[0]>();
  const detailOpen = ref(false),
    detailId = ref('');
  let businessId = '',
    requestId = '',
    generation = 0,
    formGeneration = 0;
  const columns = computed(() => [
    { title: tab.value === 'tasks' ? '当前任务' : '流程名称', key: 'name', width: 240 },
    { title: '状态 / 版本', key: 'status', width: 140 },
    {
      title: tab.value === 'available' ? '流程标识' : '申请 / 实例编号',
      dataIndex: tab.value === 'available' ? 'process_key' : tab.value === 'tasks' ? 'instanceId' : 'businessId',
      width: 280,
    },
    { title: '操作', key: 'action', width: 140 },
  ]);
  async function load() {
    const current = ++generation;
    loading.value = true;
    error.value = '';
    try {
      const result = await (tab.value === 'available'
        ? availableModels(page.value)
        : tab.value === 'mine'
          ? myInstances(page.value)
          : myTasks(page.value));
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
  function changeTab() {
    page.value = 1;
    rows.value = [];
    load();
  }
  async function openForm(model: any) {
    const current = ++formGeneration;
    formOpen.value = true;
    form.value = undefined;
    formData.value = {};
    formError.value = '';
    formLoading.value = true;
    submitted.value = false;
    pendingSubmission.value = undefined;
    preview.value = undefined;
    businessId = newId('application');
    requestId = newId('start');
    try {
      const result = await modelForm(model.process_key);
      if (current !== formGeneration) return;
      if (result.businessType !== 'WORKFLOW_FORM') throw new Error('该流程需从业务页面发起');
      form.value = result;
    } catch (e) {
      if (current === formGeneration) formError.value = (e as Error).message;
    } finally {
      if (current === formGeneration) formLoading.value = false;
    }
  }
  function closeForm() {
    if (submitting.value || uploading.value) return;
    if (Object.keys(formData.value).length && !submitted.value) {
      Modal.confirm({
        title: pendingSubmission.value ? '关闭并核对申请状态？' : '放弃本次未提交申请？',
        content: pendingSubmission.value ? '请求可能已经提交，请先在我发起的中核对，避免重复发起。' : '已填写内容尚未保存。',
        okText: pendingSubmission.value ? '关闭' : '放弃',
        cancelText: '继续填写',
        onOk: () => {
          formGeneration++;
          formOpen.value = false;
        },
      });
    } else {
      formGeneration++;
      formOpen.value = false;
    }
  }
  function validate() {
    if (!form.value) throw new Error('请先读取表单');
    for (const field of form.value.fields) {
      if (form.value.fieldPermissions?.[field.key] === 'HIDDEN') continue;
      if (!['string', 'number', 'boolean', 'date', 'attachment'].includes(field.type.toLowerCase()) || /[.\[\]]/.test(field.key))
        throw new Error(`字段“${field.name}”需要支持复杂表单的客户端`);
      const value = formData.value[field.key];
      if (field.required && (value == null || value === '')) throw new Error(`请填写${field.name}`);
    }
  }
  async function previewRoute() {
    if (!form.value) return;
    previewLoading.value = true;
    formError.value = '';
    preview.value = undefined;
    try {
      validate();
      preview.value = await previewModel(form.value.processKey, formData.value);
    } catch (e) {
      formError.value = (e as Error).message;
    } finally {
      previewLoading.value = false;
    }
  }
  async function submit() {
    if (submitting.value || submitted.value || !form.value) return;
    submitting.value = true;
    formError.value = '';
    try {
      validate();
      pendingSubmission.value ||= { processKey: form.value.processKey, businessId, requestId, data: JSON.parse(JSON.stringify(formData.value)) };
      const result = await startInstance(pendingSubmission.value);
      submitted.value = true;
      formOpen.value = false;
      tab.value = 'mine';
      page.value = 1;
      await load();
      openDetail(result.id);
    } catch (e) {
      formError.value = (e as Error).message;
    } finally {
      submitting.value = false;
    }
  }
  function openDetail(id: string) {
    detailId.value = id;
    detailOpen.value = true;
  }
  onMounted(load);
  onBeforeUnmount(() => {
    generation++;
    formGeneration++;
  });
</script>
<style scoped>
  .applications-page {
    margin: 16px;
    padding: 24px;
    background: var(--component-background, #fff);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  h1 {
    font-size: 22px;
    font-weight: 600;
    margin: 0;
  }
  .drawer-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  pre {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    max-height: 320px;
    overflow: auto;
  }
  .applications-page > .ant-alert {
    margin-bottom: 16px;
  }
  @media (max-width: 760px) {
    .applications-page {
      margin: 8px;
      padding: 16px;
    }
  }
</style>
