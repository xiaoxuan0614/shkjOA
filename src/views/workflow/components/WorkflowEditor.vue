<template>
  <section class="workflow-editor" :class="{ 'flow-view': step === 2 }">
    <header class="editor-header prototype-header">
      <a-button type="text" @click="close"><ArrowLeftOutlined />{{ model ? '编辑流程' : '创建新流程' }}</a-button>
      <nav class="flow-steps" aria-label="流程配置步骤"
        ><button v-for="(title, index) in steps" :key="title" :class="{ current: step === index }" @click="step = index"
          >{{ index + 1 }}.{{ title }}</button
        ></nav
      >
      <a-space
        ><a-tag :color="dirty ? 'orange' : 'green'">{{
          localSaved ? (dirty ? '本地暂存有修改' : '本地暂存 · 未保存到服务器') : dirty ? '未保存' : '已保存到服务器'
        }}</a-tag
        ><a-button v-if="step === 2" :disabled="readOnly" @click="saveDesign">本地暂存</a-button
        ><a-button v-if="step === 2 && localSaved" type="text" @click="clearDesign">清除会话稿</a-button
        ><a-button v-if="step === 3" :disabled="busy" @click="permissionsOpen = true">权限范围</a-button
        ><a-button :disabled="step === 0 || busy" @click="step--">上一步</a-button
        ><a-button :loading="busy" :disabled="readOnly || !!designBlockers.length" @click="save">保存完整草稿</a-button
        ><a-button type="primary" :disabled="busy || step === 4" @click="nextStep">下一步</a-button></a-space
      >
    </header>
    <a-alert v-if="designBlockers.length" type="info" show-icon message="当前包含仅供设计的节点或配置，可保存当前会话设计稿；暂不能发布运行。" />
    <a-alert v-if="readOnly" type="warning" show-icon message="此流程为业务适配或已归档，本版仅查看。" />
    <a-alert v-if="error" class="editor-error" type="error" show-icon :message="error" />
    <a-config-provider :component-disabled="readOnly"
      ><fieldset :disabled="busy" class="editor-body">
        <div v-if="step === 0" class="basic-page">
          <h1>{{ model ? '编辑审批流程' : '创建审批流程' }}</h1
          ><p class="hint">先定义一条可独立发起的通用审批流程。</p>
          <a-form layout="vertical">
            <a-form-item label="流程名称" required
              ><a-input v-model:value="definition.name" placeholder="例如：通用事项审批" :maxlength="100"
            /></a-form-item>
            <a-form-item label="流程标识" required
              ><a-input v-model:value="definition.key" :disabled="readOnly || !!savedModel" :maxlength="64" /><div class="hint"
                >自动生成，可在首次保存前修改；保存后不可更改。</div
              ></a-form-item
            >
            <a-form-item label="流程类型"><a-input value="自定义表单" disabled /></a-form-item>
            <div v-if="savedModel" class="version-note"
              >当前草稿修订 {{ savedModel.revision }} ·
              {{ savedModel.published_version ? `已发布 V${savedModel.published_version}` : '尚未发布' }}</div
            >
          </a-form>
        </div>
        <div v-else-if="step === 1" class="form-designer">
          <aside class="field-palette"
            ><h2>基础控件</h2><p class="hint">点击添加到表单</p>
            <button v-for="type in fieldTypes" :key="type.value" :disabled="readOnly" type="button" @click="addField(type.value, type.label)"
              ><Icon :icon="type.icon" />{{ type.label }}</button
            >
          </aside>
          <main class="form-preview"
            ><div class="paper"
              ><h2>{{ definition.name || '未命名申请' }}</h2
              ><p class="hint">表单预览 · 配置完成后可独立发起</p>
              <a-empty v-if="!definition.formFields?.length" description="从左侧添加第一个字段" />
              <div
                v-for="(field, index) in definition.formFields"
                :key="field.key"
                class="preview-field"
                :class="{ selected: selectedField === index }"
                @click="selectedField = index"
              >
                <button type="button" class="field-label" @click="selectedField = index"
                  ><span v-if="field.required" class="required">*</span>{{ field.name }}</button
                >
                <div class="preview-control">{{
                  field.type === 'boolean' ? '是 / 否' : field.type === 'attachment' ? '上传附件（最大10MB）' : `请输入${field.name}`
                }}</div>
                <div class="field-actions"
                  ><a-button size="small" type="text" :disabled="readOnly || index === 0" aria-label="字段上移" @click.stop="moveField(index, -1)"
                    ><ArrowUpOutlined /></a-button
                  ><a-button
                    size="small"
                    type="text"
                    :disabled="readOnly || index === definition.formFields!.length - 1"
                    aria-label="字段下移"
                    @click.stop="moveField(index, 1)"
                    ><ArrowDownOutlined /></a-button
                  ><a-button danger size="small" type="text" aria-label="删除字段" @click.stop="deleteField(field.key)"><DeleteOutlined /></a-button
                ></div>
              </div> </div
          ></main>
          <aside class="field-properties"
            ><h2>字段属性</h2
            ><a-form v-if="activeField" layout="vertical">
              <a-form-item label="字段名称"><a-input v-model:value="activeField.name" :maxlength="100" /></a-form-item>
              <a-form-item label="字段标识"
                ><a-input :value="activeField.key" disabled /><span class="hint">标识固定，用于条件和权限引用。</span></a-form-item
              >
              <a-form-item label="字段类型"
                ><a-input :value="fieldTypes.find((t) => t.value === activeField!.type)?.label || activeField.type" disabled
              /></a-form-item>
              <a-checkbox v-model:checked="activeField.required">必填</a-checkbox> </a-form
            ><p v-else class="hint">选择表单中的字段以设置属性</p></aside
          >
        </div>
        <WorkflowCanvas
          v-else-if="step === 2"
          v-model:nodes="designNodes"
          v-model:definition="definition"
          :readonly="readOnly"
          @changed="syncDesign"
        />
        <MoreSettings v-else-if="step === 3" />
        <div v-else class="publish-page">
          <h1>检查并发布</h1><p class="hint">发布创建新版本，在途申请继续使用原版本。启停新申请请在流程列表操作。</p>
          <a-descriptions bordered :column="1"
            ><a-descriptions-item label="流程名称">{{ definition.name || '未填写' }}</a-descriptions-item
            ><a-descriptions-item label="表单字段">{{ definition.formFields?.length || 0 }} 项</a-descriptions-item
            ><a-descriptions-item label="审批节点">{{ definition.nodes.map((n) => n.name).join(' → ') }}</a-descriptions-item
            ><a-descriptions-item label="版本">{{
              savedModel?.published_version ? `当前 V${savedModel.published_version}，发布将创建新版本` : '首次发布'
            }}</a-descriptions-item></a-descriptions
          >
          <a-alert v-if="issues.length" type="warning" show-icon message="以下配置需要完善"
            ><template #description
              ><ul
                ><li v-for="issue in issues" :key="issue">{{ issue }}</li></ul
              ></template
            ></a-alert
          >
          <a-alert
            v-else
            type="success"
            show-icon
            message="本地配置检查通过"
            description="保存和发布时，服务端会继续校验人员、字段、权限与当前版本。"
          />
          <a-button type="primary" size="large" :loading="busy" :disabled="issues.length > 0 || readOnly" @click="confirmPublish"
            >保存并发布</a-button
          >
        </div>
      </fieldset></a-config-provider
    >
    <a-drawer v-model:open="permissionsOpen" title="权限范围" width="min(820px, 96vw)" :mask-closable="!busy">
      <a-config-provider :component-disabled="readOnly || busy">
        <div class="policy-page">
          <h1>权限配置</h1><p class="hint">发起范围、额外读取范围分别配置，管理流程不代表可以读取所有申请。</p>
          <a-tabs>
            <a-tab-pane key="starters" tab="发起范围"
              ><a-form layout="vertical"><AudienceEditor v-model:value="definition.policy!.starters!" /></a-form
            ></a-tab-pane>
            <a-tab-pane key="readers" tab="额外读取范围">
              <section v-for="(reader, index) in definition.policy!.readers" :key="index" class="reader-rule">
                <div class="reader-heading"
                  ><h2>读取规则 {{ index + 1 }}</h2
                  ><a-button danger @click="definition.policy!.readers!.splice(index, 1)">移除规则</a-button></div
                >
                <a-form layout="vertical"
                  ><AudienceEditor v-model:value="reader.audience" /><a-form-item label="可读取的数据范围"
                    ><a-select v-model:value="reader.scope" :options="scopeOptions" /></a-form-item
                ></a-form>
              </section>
              <a-button type="dashed" block @click="definition.policy!.readers!.push({ audience: {}, scope: 'SELF' })"
                ><PlusOutlined />添加读取规则</a-button
              >
            </a-tab-pane>
            <a-tab-pane key="fields" tab="表单权限"
              ><a-empty v-if="!definition.formFields?.length" description="请先配置表单字段" />
              <div v-for="field in definition.formFields" :key="field.key" class="permission-row"
                ><strong>{{ field.name }}</strong>
                <a-select
                  :value="definition.policy!.fields![field.key]"
                  allow-clear
                  placeholder="默认权限（未配置）"
                  :options="permissionOptions"
                  @change="(v) => setPolicyField('fields', field.key, v)"
                />
                <a-select
                  :value="definition.policy!.initiatorFields![field.key]"
                  allow-clear
                  placeholder="发起人权限（未配置）"
                  :options="permissionOptions"
                  @change="(v) => setPolicyField('initiatorFields', field.key, v)"
                />
              </div>
            </a-tab-pane>
          </a-tabs>
        </div>
      </a-config-provider>
    </a-drawer>
  </section>
</template>
<script setup lang="ts">
  import { computed, onBeforeUnmount, ref } from 'vue';
  import MoreSettings from './MoreSettings.vue';
  const permissionsOpen = ref(false);
  import { onBeforeRouteLeave } from 'vue-router';
  import { Modal, message } from 'ant-design-vue';
  import { ArrowLeftOutlined, ArrowUpOutlined, ArrowDownOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons-vue';
  import { Icon } from '/@/components/Icon';
  import AudienceEditor from './AudienceEditor.vue';
  import WorkflowCanvas from '../designer/WorkflowCanvas.vue';
  import { fromDefinition, executableGraph, executionBlockers, flatten } from '../designer/graph';
  import { useUserStore } from '/@/store/modules/user';
  import { saveModel, publishModel } from '../Workflow.api';
  import {
    canEditDefinition,
    fieldTypes,
    newDefinition,
    newId,
    parseDefinition,
    permissionOptions,
    removeField,
    validateDefinition,
  } from '../workflow';
  import type { FieldPermission, WorkflowModel } from '../workflow.types';
  const props = defineProps<{ model?: WorkflowModel }>();
  const emit = defineEmits<{ (e: 'close'): void; (e: 'saved', model: WorkflowModel): void }>();
  const savedModel = ref(props.model);
  const definition = ref(props.model ? parseDefinition(props.model) : newDefinition());
  definition.value.policy ||= {};
  definition.value.policy.starters ||= {};
  definition.value.policy.readers ||= [];
  definition.value.policy.fields ||= {};
  definition.value.policy.initiatorFields ||= {};
  for (const node of definition.value.nodes) {
    node.options ||= { mode: 'ANY' };
    node.fieldPermissions ||= {};
    node.approverRules ||= [];
  }
  const designNodes = ref(fromDefinition(definition.value));
  const userId = useUserStore().getUserInfo?.id;
  const draftKey = userId ? `workflow-design:v1:${userId}:${props.model?.process_key || 'new'}` : '';
  let restored = false;
  try {
    const raw = draftKey && sessionStorage.getItem(draftKey);
    if (raw) {
      const draft = JSON.parse(raw);
      if (
        draft.version === 1 &&
        draft.revision === (props.model?.revision ?? null) &&
        Array.isArray(draft.nodes) &&
        Array.isArray(draft.definition?.nodes)
      ) {
        restored = true;
        designNodes.value = draft.nodes;
        definition.value = draft.definition;
      }
    }
  } catch {
    /* Invalid local drafts never replace server data. */
  }
  const localSaved = ref(restored);
  const serialized = () => JSON.stringify({ definition: definition.value, nodes: designNodes.value });
  const snapshot = ref(props.model || restored ? serialized() : '');
  const dirty = computed(() => serialized() !== snapshot.value);
  const designBlockers = computed(() => executionBlockers(designNodes.value));
  function syncDesign() {
    if (!designBlockers.value.length) {
      const graph = executableGraph(designNodes.value, !!definition.value.stages);
      definition.value.nodes = graph.nodes;
      definition.value.stages = graph.stages;
    }
  }
  function saveDesign() {
    if (!draftKey) {
      message.error('登录身份未就绪，无法保存当前会话设计稿');
      return;
    }
    try {
      sessionStorage.setItem(
        draftKey,
        JSON.stringify({ version: 1, revision: savedModel.value?.revision ?? null, definition: definition.value, nodes: designNodes.value })
      );
      snapshot.value = serialized();
      localSaved.value = true;
      message.success('设计稿已保存到本机当前会话，未发布运行');
    } catch {
      message.error('本机存储空间不足，设计稿未保存，请勿关闭页面');
    }
  }
  function clearDesign() {
    Modal.confirm({
      title: '清除当前会话设计稿？',
      content: '只清除当前会话中保存的设计稿，当前画布继续保留。',
      okText: '清除',
      cancelText: '取消',
      onOk: () => {
        sessionStorage.removeItem(draftKey);
        localSaved.value = false;
        snapshot.value = '';
      },
    });
  }
  function nextStep() {
    error.value = '';
    if (step.value === 0 && (!definition.value.name.trim() || !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(definition.value.key))) {
      error.value = '请填写流程名称和有效标识';
      return;
    }
    if (step.value === 1 && !definition.value.formFields?.length) {
      error.value = '请至少添加一个表单字段';
      return;
    }
    if (step.value < 4) step.value++;
  }

  const readOnly = computed(() => !canEditDefinition(definition.value) || savedModel.value?.archived === 1);
  const step = ref(0),
    selectedField = ref(-1),
    busy = ref(false),
    error = ref('');
  const steps = ['基础信息', '表单配置', '流程设计', '更多配置', '完成发布'];
  const issues = computed(() => {
    if (designBlockers.value.length) return designBlockers.value;
    return validateDefinition({ ...definition.value, ...executableGraph(designNodes.value, !!definition.value.stages) });
  });
  const activeField = computed(() => definition.value.formFields?.[selectedField.value]);
  const scopeOptions = [
    { value: 'SELF', label: '本人发起' },
    { value: 'DEPARTMENT', label: '本部门' },
    { value: 'DEPARTMENT_AND_CHILDREN', label: '本部门及下级部门' },
    { value: 'SELF_AND_SUBORDINATES', label: '本人及下属' },
    { value: 'ALL', label: '全部申请' },
  ];
  function addField(type: string, name: string) {
    definition.value.formFields ||= [];
    definition.value.formFields.push({ key: newId('field'), name, type, required: false });
    selectedField.value = definition.value.formFields.length - 1;
  }
  function deleteField(key: string) {
    try {
      for (const n of flatten(designNodes.value)) {
        if (n.config.field === key || n.branches?.some((b) => !b.fallback && b.groups.some((g) => g.some((r) => r.field === key))))
          throw new Error('该字段被流程设计条件或人员来源引用，请先调整节点设置');
      }
      removeField(definition.value, key);
      for (const n of flatten(designNodes.value)) if (n.approval?.fieldPermissions) delete n.approval.fieldPermissions[key];
      selectedField.value = -1;
    } catch (e) {
      error.value = (e as Error).message;
    }
  }
  function moveField(index: number, delta: number) {
    const fields = definition.value.formFields!;
    [fields[index], fields[index + delta]] = [fields[index + delta], fields[index]];
    selectedField.value = index + delta;
  }
  function setPolicyField(kind: 'fields' | 'initiatorFields', key: string, value?: FieldPermission) {
    if (value) definition.value.policy![kind]![key] = value;
    else delete definition.value.policy![kind]![key];
  }
  async function persist() {
    if (designBlockers.value.length) throw new Error('当前包含仅供设计的配置，请保存当前会话设计稿。');
    syncDesign();
    const errors = validateDefinition(definition.value);
    if (errors.length) throw new Error(errors[0]);
    const saved = await saveModel(JSON.parse(JSON.stringify(definition.value)), savedModel.value?.revision);
    if (!saved || !Number.isInteger(saved.revision) || saved.process_key !== definition.value.key)
      throw new Error('保存响应缺少当前版本，请返回列表刷新后重试。');
    savedModel.value = saved;
    snapshot.value = serialized();
    if (draftKey) sessionStorage.removeItem(draftKey);
    localSaved.value = false;
    emit('saved', saved);
    return saved;
  }
  async function save() {
    if (busy.value || readOnly.value) return;
    busy.value = true;
    error.value = '';
    try {
      await persist();
    } catch (e) {
      error.value = (e as Error).message;
    } finally {
      busy.value = false;
    }
  }
  function confirmPublish() {
    Modal.confirm({
      title: '发布新的审批版本？',
      content: '新版本仅用于后续申请，已有审批记录和在途申请不会改变。发布不自动启用，请在列表启用新申请。',
      okText: '保存并发布',
      cancelText: '取消',
      onOk: async () => {
        if (busy.value || readOnly.value) return;
        busy.value = true;
        error.value = '';
        try {
          const current = await persist();
          const published = await publishModel(current.process_key, current.revision);
          savedModel.value = published;
          emit('saved', published);
          emit('close');
        } catch (e) {
          error.value = (e as Error).message;
          throw e;
        } finally {
          busy.value = false;
        }
      },
    });
  }
  function confirmLeave(): Promise<boolean> {
    if (busy.value) return Promise.resolve(false);
    if (!dirty.value) return Promise.resolve(true);
    return new Promise((resolve) =>
      Modal.confirm({
        title: '离开并放弃未保存修改？',
        okText: '放弃修改',
        cancelText: '继续编辑',
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      })
    );
  }
  async function close() {
    if (await confirmLeave()) emit('close');
  }
  onBeforeRouteLeave(confirmLeave);
  function beforeUnload(event: BeforeUnloadEvent) {
    if (dirty.value) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
  window.addEventListener('beforeunload', beforeUnload);
  onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload));
</script>
<style scoped>
  .workflow-editor {
    --flow-accent: var(--ant-primary-color, #1677ff);
    background: var(--component-background, #fff);
    min-height: calc(100vh - 150px);
  }
  .flow-view {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 142px);
    min-height: 480px;
  }
  .flow-view > .editor-header,
  .flow-view > .ant-alert {
    flex-shrink: 0;
  }
  .flow-view .editor-body {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  .flow-view :deep(.workflow-canvas:not(.fullscreen)) {
    height: 100%;
    min-height: 0;
  }
  .editor-header {
    display: flex;
    align-items: center;
    gap: 24px;
    padding: 16px 20px;
    border-bottom: 1px solid #e5e7eb;
  }
  .editor-header .ant-steps {
    flex: 1;
    max-width: 780px;
    margin: 0 auto;
  }
  .editor-body {
    padding: 0;
    margin: 0;
    border: 0;
    min-width: 0;
  }
  .editor-body:disabled {
    pointer-events: none;
    opacity: 0.75;
  }
  .editor-error {
    margin: 12px 20px;
  }
  h1 {
    font-size: 22px;
    margin: 0 0 10px;
    font-weight: 600;
  }
  h2 {
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 14px;
  }
  .hint {
    color: #595959;
    line-height: 1.7;
    font-size: 13px;
  }
  .basic-page,
  .policy-page,
  .publish-page {
    max-width: 780px;
    padding: 40px 28px;
    margin: auto;
    min-height: 560px;
  }
  .basic-page {
    max-width: 640px;
  }
  .basic-page .ant-form {
    margin-top: 32px;
  }
  .version-note {
    color: #595959;
    padding: 16px 0;
  }
  .form-designer {
    display: grid;
    grid-template-columns: 190px minmax(260px, 1fr) 280px;
    min-height: 610px;
  }
  .field-palette,
  .field-properties {
    padding: 24px 18px;
  }
  .field-palette {
    border-right: 1px solid #e5e7eb;
  }
  .field-properties {
    border-left: 1px solid #e5e7eb;
  }
  .field-palette > button {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    background: transparent;
    border: 1px solid #d9d9d9;
    padding: 10px 12px;
    margin-bottom: 12px;
    border-radius: 4px;
    cursor: pointer;
    color: inherit;
  }
  .field-palette > button:hover {
    color: var(--flow-accent);
    border-color: var(--flow-accent);
  }
  .form-preview {
    padding: 30px;
    background: #f5f7fa;
  }
  .paper {
    background: #fff;
    padding: 26px;
    max-width: 620px;
    margin: auto;
    min-height: 480px;
  }
  .preview-field {
    position: relative;
    padding: 14px;
    margin-top: 12px;
    border: 1px solid transparent;
    cursor: pointer;
  }
  .preview-field.selected {
    border-color: var(--flow-accent);
    background: #f0f7ff;
  }
  .field-label {
    border: 0;
    background: transparent;
    padding: 0;
    cursor: pointer;
    color: #262626;
  }
  .required {
    color: #b42318;
    margin-right: 4px;
  }
  .preview-control {
    border: 1px solid #d9d9d9;
    border-radius: 4px;
    padding: 7px 10px;
    color: #595959;
    margin-top: 10px;
  }
  .field-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 6px;
  }
  .flow-designer {
    display: flex;
    align-items: stretch;
    min-height: 610px;
    max-height: 900px;
  }
  .flow-canvas {
    position: relative;
    flex: 1;
    min-width: 300px;
    padding: 72px 24px 40px;
    overflow: auto;
    background: #f5f7fa;
  }
  .canvas-caption {
    position: absolute;
    top: 20px;
    left: 24px;
    display: flex;
    gap: 16px;
    align-items: baseline;
  }
  .flow-node {
    display: block;
    width: 250px;
    margin: auto;
    background: #fff;
    border: 1px solid #dfe4eb;
    border-radius: 6px;
    overflow: hidden;
  }
  .starter {
    padding: 0;
    text-align: left;
    cursor: pointer;
  }
  .starter strong {
    display: flex;
    gap: 10px;
    background: #52627a;
    color: #fff;
    padding: 12px 16px;
  }
  .starter > span {
    display: block;
    padding: 16px;
    color: #595959;
  }
  .approval.active {
    outline: 2px solid var(--flow-accent);
    outline-offset: 2px;
  }
  .node-title {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 11px 16px;
    color: #fff;
    background: var(--flow-accent);
    border: 0;
    cursor: pointer;
  }
  .node-summary {
    text-align: left;
    padding: 14px 16px 8px;
    width: 100%;
    border: 0;
    background: transparent;
    cursor: pointer;
    color: #262626;
  }
  .node-summary small {
    display: block;
    color: #595959;
    margin-top: 6px;
  }
  .node-actions {
    display: flex;
    justify-content: flex-end;
    padding: 0 8px 8px;
  }
  .connector {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 55px;
    position: relative;
  }
  .connector::before {
    content: '';
    position: absolute;
    height: 100%;
    width: 1px;
    background: #cbd5e1;
  }
  .connector .ant-btn {
    z-index: 1;
    color: var(--flow-accent);
  }
  .flow-end {
    text-align: center;
    color: #595959;
  }
  .flow-end > span {
    display: inline-block;
    width: 8px;
    height: 8px;
    background: #94a3b8;
    border-radius: 50%;
    margin-right: 8px;
  }
  .reader-rule {
    border-bottom: 1px solid #e5e7eb;
    margin-bottom: 24px;
    padding-bottom: 24px;
  }
  .reader-heading {
    display: flex;
    justify-content: space-between;
  }
  .permission-row {
    display: grid;
    grid-template-columns: 1fr 180px 180px;
    gap: 12px;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid #eee;
  }
  .publish-page > .ant-alert,
  .publish-page > .ant-btn {
    margin-top: 24px;
  }
  .publish-page li {
    line-height: 1.8;
  }
  button:focus-visible {
    /* OA global reset also uses !important; restore a visible keyboard focus locally. */
    outline: 2px solid var(--flow-accent) !important;
    outline-offset: 3px;
  }
  @media (max-width: 1200px) {
    .editor-header {
      flex-wrap: wrap;
      gap: 12px;
    }
    .editor-header .ant-steps {
      order: 3;
      flex-basis: 100%;
      max-width: none;
    }
    .form-designer {
      grid-template-columns: 150px minmax(240px, 1fr) 240px;
    }
  }
  @media (max-width: 900px) {
    .form-designer {
      grid-template-columns: 140px minmax(200px, 1fr);
    }
    .field-properties {
      grid-column: 1 / -1;
      border-top: 1px solid #eee;
      border-left: 0;
    }
    .flow-designer {
      flex-direction: column;
      max-height: none;
    }
    .flow-canvas {
      max-height: 700px;
    }
    .permission-row {
      grid-template-columns: 1fr;
    }
    .paper {
      padding: 16px;
    }
    .form-preview {
      padding: 12px;
    }
  }
</style>

<style scoped>
  .prototype-header {
    padding: 0 20px;
    height: 68px;
    gap: 16px;
  }
  .prototype-header > :deep(.ant-space) {
    flex-wrap: wrap;
  }
  .flow-steps {
    display: flex;
    justify-content: center;
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    gap: 26px;
    align-self: stretch;
  }
  .flow-steps button {
    padding: 0 2px;
    border: 0;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: #525766;
    font-size: 13px;
    cursor: pointer;
    white-space: nowrap;
  }
  .flow-steps button.current {
    color: #7671df;
    border-bottom-color: #7671df;
  }
  .flow-steps button:focus-visible {
    outline: 2px solid #7671df !important;
  }
  .prototype-header :deep(.ant-btn-primary) {
    background: #7371e6;
  }
  .prototype-header :deep(.ant-tag) {
    font-size: 11px;
  }
  @media (max-width: 1450px) {
    .prototype-header {
      height: auto;
      min-height: 68px;
      flex-wrap: wrap;
      padding: 12px;
    }
    .flow-steps {
      gap: 18px;
      justify-content: flex-start;
      min-height: 38px;
      order: 3;
      flex-basis: 100%;
    }
  }
</style>
