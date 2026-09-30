<template>
  <div class="flow-settings">
    <a-button v-if="node.config.callback || node.approval?.options?.behavior?.callbackEnabled" type="link" @click="clearCallback"
      >关闭未支持的节点回调</a-button
    >
    <a-tabs v-if="node.kind === 'APPROVAL' && !lane" v-model:activeKey="tab">
      <a-tab-pane key="people" tab="人员配置" /><a-tab-pane key="rules" tab="审批配置" /><a-tab-pane key="buttons" tab="按钮配置" /><a-tab-pane
        key="fields"
        tab="字段配置"
      />
    </a-tabs>
    <template v-if="lane">
      <a-button v-if="node.config.channels?.some((c) => !['SITE', '站内信'].includes(c))" type="link" @click="node.config.channels = ['SITE']"
        >将旧通知方式改为仅站内信</a-button
      >
      <h3>{{ node.kind === 'CONDITION' ? '配置要执行的条件' : '流程分支' }}</h3
      ><a-alert v-if="node.kind !== 'CONDITION'" message="此处按流程结构执行；已有路由条件会原样保留。" type="info" />
      <a-alert v-if="lane.fallback" message="不满足其他条件时走此分支，无需填写条件。" type="info" />
      <template v-else-if="node.kind === 'CONDITION'">
        <a-alert v-if="!lane.groups.length && lane.predicate" message="已有递归条件原样保留。添加新条件会替换原条件。" type="info" />
        <div v-for="(group, gi) in lane.groups" :key="gi" class="condition-group">
          <span v-if="gi" class="or-label">或</span>
          <div v-for="(row, ri) in group" :key="ri" class="condition-row">
            <a-select v-model:value="row.field" placeholder="关联表单条件" :options="conditionFieldOptions" />
            <a-select v-model:value="row.operator" :options="operators" />
            <a-input v-model:value="row.value" placeholder="请输入" />
            <a-button type="text" danger aria-label="删除条件" @click="group.splice(ri, 1)"><CloseOutlined /></a-button>
          </div>
          <a-button type="link" @click="group.push(emptyCondition())"><PlusOutlined />且条件</a-button>
        </div>
        <a-button @click="lane.groups.push([emptyCondition()])"><PlusOutlined />或条件</a-button>
      </template>
    </template>
    <template v-else-if="tab === 'people' && node.kind === 'APPROVAL'">
      <h3>请选择审批人员类型</h3>
      <a-radio-group :value="source" @change="changeSource($event.target.value)" class="people-types">
        <a-radio value="users">指定成员</a-radio><a-radio value="roles">指定角色</a-radio><a-radio value="supervisor">上级</a-radio
        ><a-radio value="head">部门负责人</a-radio>
        <a-tooltip title="运行时读取表单中的有效用户ID或ID数组"><a-radio value="field" :disabled="!capabilities">表单内成员</a-radio></a-tooltip>
        <a-tooltip title="按主管链顺序审批，支持1至30级"><a-radio value="levels" :disabled="!capabilities">连续多级负责人</a-radio></a-tooltip>
        <a-radio v-if="source === 'mixed'" value="mixed">组合选人</a-radio>
      </a-radio-group>
      <div class="source-fields">
        <template v-if="source === 'users' || source === 'roles'">
          <div class="selection-toolbar">
            <a-button class="add-people" @click="pick(source)"><PlusOutlined />添加{{ source === 'users' ? '成员' : '角色' }}</a-button>
            <span class="selection-count">已选 {{ selectedIds.length }} / 100 {{ source === 'users' ? '人' : '个角色' }}</span>
          </div>
          <DirectorySelect
            :key="source"
            :value="selectedIds"
            :kind="source"
            display-only
            :known-labels="pickedLabels[source]"
            @update:value="(v) => (source === 'users' ? (node.approval!.userIds = v) : (node.approval!.roleIds = v))"
          />
        </template>
        <p v-else-if="source === 'mixed'" class="source-hint">已配置多个选人来源，请在下方组合选人设置中查看和调整。</p>
        <a-select
          v-else-if="source === 'field'"
          v-model:value="node.config.field"
          placeholder="请选择表单内成员字段"
          :options="fields.map((f) => ({ value: f.key, label: f.name }))"
        />
        <a-input-number v-else-if="source === 'levels'" v-model:value="node.config.levels" :min="1" :max="30" :precision="0" addon-after="级主管" />
        <p v-else class="source-hint">{{
          source === 'head' ? '由发起人所属部门的负责人审批，无需指定成员。' : '由发起人的直属主管审批，无需指定成员。'
        }}</p>
        <p v-if="['field', 'levels'].includes(source)" class="source-hint">{{
          source === 'field' ? '表单值须为有效用户 ID 或 ID 数组。' : '按主管链逐级串行审批，最多30级。'
        }}</p>
      </div>
      <a-collapse v-model:activeKey="advancedKeys" ghost class="advanced"
        ><a-collapse-panel key="advanced" header="组合选人及排除设置"
          ><NodeEditor v-model:node="node.approval!" :fields="fields" people-only /></a-collapse-panel
      ></a-collapse>
    </template>
    <template v-else-if="node.kind === 'APPROVAL' && tab === 'rules'">
      <h3>配置审批方式</h3
      ><a-form layout="vertical">
        <a-form-item label="审批类型"
          ><a-radio-group :value="node.config.approvalType || 'manual'" @change="node.config.approvalType = $event.target.value"
            ><a-radio value="manual">人工审批</a-radio><a-radio value="auto" :disabled="!capabilities">自动通过</a-radio></a-radio-group
          ></a-form-item
        >
        <a-form-item label="审批退回类型"
          ><a-radio-group :value="node.config.returnType || 'choose'" @change="node.config.returnType = $event.target.value"
            ><a-radio value="choose">自选节点</a-radio><a-radio value="start">开始节点</a-radio
            ><a-radio value="disabled">禁止退回</a-radio></a-radio-group
          ></a-form-item
        >
        <a-form-item label="多人审批类型"
          ><a-select v-model:value="node.approval!.options!.mode" :options="modeOptions" @change="delete node.approval!.options!.threshold"
        /></a-form-item>
        <a-form-item v-if="['COUNT', 'PERCENT'].includes(node.approval!.options!.mode || '')" label="通过阈值"
          ><a-input-number v-model:value="node.approval!.options!.threshold" :min="1" :max="100" :precision="0"
        /></a-form-item>

        <a-form-item label="审批人员为空时"
          ><a-radio-group :value="node.config.emptyType || 'fail'" @change="node.config.emptyType = $event.target.value"
            ><a-radio value="fail">停止并提示</a-radio><a-radio value="auto" :disabled="!capabilities">自动通过</a-radio
            ><a-radio value="transfer">自动转交给某个人</a-radio></a-radio-group
          ></a-form-item
        >
        <a-form-item v-if="node.config.emptyType === 'transfer'" label="转交人员"
          ><DirectorySelect v-model:value="node.config.users" kind="users"
        /></a-form-item>
        <p v-if="node.config.emptyType === 'transfer' && node.config.users?.length !== 1" class="draft-note">请选择且仅选择一名转交人员。</p
        ><a-form-item label="是否允许回调（尚未定义）"
          ><a-radio-group :value="false" disabled><a-radio :value="false">否</a-radio><a-radio :value="true">是</a-radio></a-radio-group></a-form-item
        >
        <a-form-item label="是否延迟通知"
          ><a-radio-group v-model:value="node.config.delay"
            ><a-radio :value="false">否</a-radio><a-radio :value="true">是</a-radio></a-radio-group
          ></a-form-item
        >
        <a-form-item v-if="node.config.delay" label="延迟分钟"
          ><a-input-number v-model:value="node.config.delayMinutes" :min="0" :max="10080" :precision="0"
        /></a-form-item>
      </a-form>
    </template>
    <template v-else-if="node.kind === 'APPROVAL' && tab === 'buttons'">
      <h3>参与者可以看见或者操作哪些按钮</h3>
      <table class="settings-table"
        ><thead
          ><tr><th>操作项</th><th>是否可操作</th></tr></thead
        ><tbody
          ><tr v-for="action in actions" :key="action"
            ><td
              ><a-button size="small" :type="['提交', '同意'].includes(action) ? 'primary' : 'default'" :danger="action === '拒绝'">{{
                action
              }}</a-button></td
            ><td
              ><a-checkbox
                :checked="
                  node.config.buttons
                    ? node.config.buttons.includes(action)
                    : node.approval?.options?.behavior?.buttons?.[buttonCodes[action]] !== false
                "
                @change="toggleAction(action, $event.target.checked)"
                :aria-label="`允许${action}`" /></td></tr></tbody
      ></table>
    </template>
    <template v-else-if="node.kind === 'APPROVAL' && tab === 'fields'">
      <h3>参与者可以看见或者操作哪些字段</h3><FieldPermissions :fields="fields" v-model:value="node.approval!.fieldPermissions!" />
    </template>
    <template v-else-if="node.kind === 'CC' || node.kind === 'NOTICE'">
      <a-button v-if="node.config.channels?.some((c) => !['SITE', '站内信'].includes(c))" type="link" @click="node.config.channels = ['SITE']"
        >将旧通知方式改为仅站内信</a-button
      >
      <h3>{{ node.kind === 'CC' ? '请选择要抄送的人员' : '配置通知人员及通知内容' }}</h3>
      <a-radio-group :value="node.config.source" @change="changeRecipientSource($event.target.value)" class="people-types"
        ><a-radio value="initiator">发起人</a-radio><a-radio value="users">指定成员</a-radio
        ><a-radio value="field">表单内成员</a-radio></a-radio-group
      >
      <div v-if="node.config.source !== 'initiator'" class="source-fields"
        ><template v-if="node.config.source !== 'field'"
          ><a-button @click="pick('users')">添加成员</a-button><DirectorySelect v-model:value="node.config.users" kind="users" /></template
        ><a-select
          v-else
          v-model:value="node.config.field"
          placeholder="请选择表单内成员字段"
          :options="fields.map((f) => ({ value: f.key, label: f.name }))"
      /></div>
      <template v-if="node.kind === 'NOTICE'"
        ><a-form layout="vertical"
          ><a-form-item label="通知方式"
            ><a-checkbox-group
              v-model:value="node.config.channels"
              :options="[
                { label: '邮件（未接通）', value: 'EMAIL', disabled: true },
                { label: '微信公众号（未接通）', value: 'WECHAT', disabled: true },
                { label: '站内信', value: 'SITE' },
              ]" /></a-form-item
          ><a-form-item label="通知模版"
            ><div class="notice-template"
              ><a-textarea
                v-model:value="node.config.template"
                :rows="6"
                :maxlength="1000"
                placeholder="您提交的「流程名称」已通过「节点名称」，请尽快处理。" /><a-select
                class="insert-field"
                placeholder="置入字段"
                :value="null"
                :options="fields.map((f) => ({ value: f.key, label: f.name }))"
                @change="(v) => (node.config.template = (node.config.template || '') + '${' + v + '}')" /></div></a-form-item
          ><a-form-item label="通知延迟（分钟）"
            ><a-input-number v-model:value="node.config.delayMinutes" :min="0" :max="10080" :precision="0" /></a-form-item></a-form
      ></template>
    </template>
    <template v-else
      ><h3>配置任务</h3
      ><a-form layout="vertical"
        ><a-form-item label="任务说明"
          ><a-textarea v-model:value="node.config.task" :rows="5" :maxlength="1000" placeholder="请设置任务" /></a-form-item
        ><a-form-item label="任务处理人"><DirectorySelect v-model:value="node.config.users" kind="users" /></a-form-item></a-form
      ><p class="draft-note">人工任务由指定人员点击“完成任务”办理，不执行脚本或自动业务操作。</p></template
    >
    <PeoplePicker :open="picker" :kind="pickerKind" :value="picked" @cancel="picker = false" @confirm="applyPeople" />
  </div>
</template>
<script setup lang="ts">
  import { ref, computed, watch, inject } from 'vue';
  import { Modal } from 'ant-design-vue';
  import { PlusOutlined, CloseOutlined } from '@ant-design/icons-vue';
  import PeoplePicker from './PeoplePicker.vue';
  import DirectorySelect from '../components/DirectorySelect.vue';
  import NodeEditor from '../components/NodeEditor.vue';
  import FieldPermissions from './FieldPermissions.vue';
  import type { DesignNode, DesignBranch } from './graph';
  import { modeOptions } from '../workflow';
  import { buttonCodes } from './graph';
  import type { DesignerCapabilities, FormField } from '../workflow.types';
  const props = defineProps<{ fields: FormField[] }>();
  const conditionKeys = inject<import('vue').Ref<string[] | undefined>>('workflowConditionFields', ref(undefined));
  const conditionFieldOptions = computed(() => props.fields.filter((f) => !conditionKeys.value || conditionKeys.value.includes(f.key)).map((f) => ({ value: f.key, label: f.name })));
  const node = defineModel<DesignNode>('node', { required: true });
  const lane = defineModel<DesignBranch>('lane');
  const capabilities = inject<import('vue').Ref<DesignerCapabilities | null>>('workflowCapabilities', ref(null));
  const a = node.value.approval;
  const b = a?.options?.behavior;
  if (node.value.kind === 'APPROVAL' && b) {
    const c = node.value.config;
    c.approvalType ??= b.autoApprove ? 'auto' : 'manual';
    c.returnType ??=
      b.returnMode === 'START' ? 'start' : b.returnMode === 'DISABLED' ? 'disabled' : b.returnMode === 'PREVIOUS' ? 'choose' : undefined;
    c.emptyType ??=
      b.emptyApprover === 'AUTO_APPROVE' ? 'auto' : b.emptyApprover === 'TRANSFER' ? 'transfer' : b.emptyApprover === 'FAIL' ? 'fail' : undefined;
    if (b.fallbackUserId && !c.users) c.users = [b.fallbackUserId];
    c.delayMinutes ??= b.notificationDelayMinutes;
    c.delay ??= !!b.notificationDelayMinutes;
    c.callback ??= b.callbackEnabled;
  }
  const onlyRule = a?.approverRules?.length === 1 && !a.userIds?.length && !a.roleIds?.length ? a.approverRules[0] : undefined;
  if (node.value.kind === 'APPROVAL' && !node.value.config.source && onlyRule) {
    if (onlyRule.type === 'FORM_USERS') {
      node.value.config.source = 'field';
      node.value.config.field = onlyRule.fieldKey;
    }
    if (onlyRule.type === 'SUPERVISOR_CHAIN') {
      node.value.config.source = 'levels';
      node.value.config.levels = onlyRule.levels;
    }
  }
  const tab = ref('people');
  const selectedSource = ref('');
  const source = computed(() => {
    if (node.value.config.source) return node.value.config.source;
    const a = node.value.approval;
    const kinds = [
      ...(a?.userIds?.length ? ['users'] : []),
      ...(a?.roleIds?.length ? ['roles'] : []),
      ...(a?.approverRules || []).map((r) =>
        r.type === 'DIRECT_SUPERVISOR' ? 'supervisor' : r.type === 'INITIATOR_DEPARTMENT_HEADS' ? 'head' : 'mixed'
      ),
    ];
    return kinds.length > 1 ? 'mixed' : kinds[0] || selectedSource.value || 'users';
  });
  watch(
    source,
    (value) => {
      if (['users', 'roles', 'supervisor', 'head'].includes(value)) selectedSource.value = value;
    },
    { immediate: true }
  );
  const advancedKeys = ref<string[]>(source.value === 'mixed' ? ['advanced'] : []);
  const selectedIds = computed(() => (source.value === 'roles' ? node.value.approval?.roleIds : node.value.approval?.userIds) || []);
  const pickedLabels = ref<Record<string, Record<string, string>>>({ users: {}, roles: {} });
  const actions = ['保存', '提交', '同意', '拒绝', '退回', '加签', '打印', '转办'];
  const operators = [
    { value: 'EQ', label: '等于' },
    { value: 'NE', label: '不等于' },
    { value: 'GT', label: '大于' },
    { value: 'GE', label: '大于等于' },
    { value: 'LT', label: '小于' },
    { value: 'LE', label: '小于等于' },
  ];
  function emptyCondition() {
    return { field: '', operator: 'EQ', value: '' };
  }
  function clearCallback() {
    node.value.config.callback = false;
    if (node.value.approval?.options?.behavior) node.value.approval.options.behavior.callbackEnabled = false;
  }
  function changeRecipientSource(value: string) {
    node.value.config.source = value;
    node.value.config.users = [];
    node.value.config.field = undefined;
    if (node.value.approval) {
      node.value.approval.userIds = [];
      node.value.approval.roleIds = [];
      node.value.approval.approverRules = [];
    }
  }
  function changeSource(value: string) {
    if (value === source.value) return;
    const n = node.value;
    const a = n.approval!;
    const apply = () => {
      n.config.source = ['field', 'levels'].includes(value) ? value : undefined;
      if (value === 'levels') n.config.levels = 1;
      delete n.config.field;
      delete n.config.task;
      a.userIds = [];
      a.roleIds = [];
      a.approverRules = value === 'supervisor' ? [{ type: 'DIRECT_SUPERVISOR' }] : value === 'head' ? [{ type: 'INITIATOR_DEPARTMENT_HEADS' }] : [];
      selectedSource.value = value;
    };
    if (a.userIds?.length || a.roleIds?.length || a.approverRules?.length || n.config.source) {
      Modal.confirm({
        title: '切换审批人员类型？',
        content: '切换后将替换当前的成员、角色和组织选人规则，排除人员设置会保留。',
        okText: '切换类型',
        cancelText: '保留当前',
        onOk: apply,
      });
    } else apply();
  }

  const picker = ref(false),
    pickerKind = ref<'users' | 'roles'>('users'),
    picked = ref<string[]>([]);
  function pick(kind: 'users' | 'roles') {
    pickerKind.value = kind;
    picked.value = [
      ...((node.value.kind === 'APPROVAL'
        ? kind === 'users'
          ? node.value.approval!.userIds
          : node.value.approval!.roleIds
        : node.value.config.users) || []),
    ];
    picker.value = true;
  }
  function applyPeople(ids: string[], labels: Record<string, string>) {
    picked.value = ids;
    pickedLabels.value[pickerKind.value] = labels;
    if (node.value.kind === 'APPROVAL') {
      if (pickerKind.value === 'users') node.value.approval!.userIds = [...picked.value];
      else node.value.approval!.roleIds = [...picked.value];
    } else node.value.config.users = [...picked.value];
    picker.value = false;
  }
  function toggleAction(action: string, checked: boolean) {
    node.value.config.buttons ||= actions.filter((name) => node.value.approval?.options?.behavior?.buttons?.[buttonCodes[name]] !== false);
    node.value.config.buttons = checked
      ? [...(node.value.config.buttons || []), action]
      : (node.value.config.buttons || []).filter((a) => a !== action);
  }
</script>
<style scoped>
  h3 {
    font-size: 14px;
    font-weight: 600;
    margin: 24px 0 28px;
    border-left: 3px solid #7774e9;
    padding-left: 10px;
    color: #303448;
  }
  .flow-settings {
    max-width: 920px;
  }
  .people-types {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 8px;
    border-bottom: 1px solid #eeeef4;
    padding: 0 0 18px;
  }
  .source-fields {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
    padding: 18px 0;
    max-width: 620px;
  }
  .source-fields > div,
  .source-fields > .ant-select {
    width: 100%;
  }
  .selection-toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
  }
  .add-people {
    min-width: 112px;
    color: #6266dc;
    border-color: #7875ee;
  }
  .selection-count,
  .source-hint {
    color: #545b6c;
    font-size: 12px;
    line-height: 1.7;
  }
  .source-hint {
    margin: 0;
  }
  .advanced {
    margin-top: 20px;
    max-width: 620px;
    border-top: 1px solid #eeeef4;
  }
  .people-types :deep(.ant-radio-wrapper) {
    margin-right: 8px;
  }

  .advanced :deep(.node-editor) {
    width: auto;
    border: 0;
    padding: 8px;
  }
  .advanced :deep(.node-editor > header),
  .advanced :deep(.node-editor > footer) {
    display: none;
  }
  .settings-table {
    width: 600px;
    max-width: 100%;
    border-collapse: collapse;
  }
  .settings-table th,
  .settings-table td {
    padding: 12px 16px;
    border-bottom: 1px solid #eeeef5;
    text-align: left;
  }
  .settings-table th {
    background: #f8f8fc;
    font-weight: 500;
  }
  .notice-template {
    position: relative;
  }
  .notice-template :deep(textarea) {
    padding-bottom: 52px;
    resize: vertical;
  }
  .insert-field {
    position: absolute;
    width: 140px;
    right: 12px;
    bottom: 12px;
  }
  .insert-field :deep(.ant-select-selector) {
    background: #7371e6;
    border-color: #7371e6;
    color: #fff;
  }
  .insert-field :deep(.ant-select-selection-placeholder),
  .insert-field :deep(.ant-select-arrow) {
    color: #fff;
  }
  .picked-count,
  .draft-note {
    color: #767b89;
    font-size: 12px;
    margin-top: 16px;
  }
  .condition-group {
    padding: 12px;
    background: #fafafe;
    margin-bottom: 16px;
  }
  .condition-row {
    display: flex;
    gap: 12px;
    margin: 12px 0;
  }
  .condition-row .ant-select {
    min-width: 120px;
    flex: 1;
  }
  .condition-row .ant-input {
    width: 180px;
  }
  .or-label {
    color: #6868d9;
  }
  .flow-settings :deep(.ant-form-item) {
    margin-bottom: 28px;
  }
  @media (max-width: 760px) {
    .condition-row {
      flex-wrap: wrap;
    }
    .condition-row .ant-input {
      width: 100%;
    }
  }
</style>
