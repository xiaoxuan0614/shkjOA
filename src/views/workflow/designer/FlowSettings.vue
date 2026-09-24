<template>
  <div class="flow-settings">
    <a-tabs v-if="node.kind === 'APPROVAL' && !lane" v-model:activeKey="tab">
      <a-tab-pane key="people" tab="人员配置" /><a-tab-pane key="rules" tab="审批配置" /><a-tab-pane key="buttons" tab="按钮配置" /><a-tab-pane
        key="fields"
        tab="字段配置"
      />
    </a-tabs>
    <template v-if="lane">
      <h3>{{ node.kind === 'CONDITION' ? '配置要执行的条件' : '流程分支' }}</h3
      ><a-alert v-if="node.kind !== 'CONDITION'" message="此处按流程结构执行；已有路由条件会原样保留。" type="info" />
      <a-alert v-if="lane.fallback" message="不满足其他条件时走此分支，无需填写条件。" type="info" />
      <template v-else-if="node.kind === 'CONDITION'">
        <a-alert v-if="!lane.groups.length && lane.predicate" message="已有递归条件原样保留。添加新条件会替换原条件。" type="info" />
        <div v-for="(group, gi) in lane.groups" :key="gi" class="condition-group">
          <span v-if="gi" class="or-label">或</span>
          <div v-for="(row, ri) in group" :key="ri" class="condition-row">
            <a-select v-model:value="row.field" placeholder="关联表单条件" :options="fields.map((f) => ({ value: f.key, label: f.name }))" />
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
        ><a-radio value="head">部门负责人</a-radio><a-radio value="field">表单内成员</a-radio><a-radio value="levels">连续多级负责人</a-radio>
      </a-radio-group>
      <div class="source-fields">
        <template v-if="source === 'users' || source === 'roles'"
          ><a-button @click="pick(source)"><PlusOutlined />添加{{ source === 'users' ? '成员' : '角色' }}</a-button
          ><DirectorySelect
            :value="source === 'users' ? node.approval!.userIds : node.approval!.roleIds"
            :kind="source"
            @update:value="(v) => (source === 'users' ? (node.approval!.userIds = v) : (node.approval!.roleIds = v))"
        /></template>
        <a-select
          v-else-if="source === 'field'"
          v-model:value="node.config.field"
          placeholder="请选择表单内成员字段"
          :options="fields.map((f) => ({ value: f.key, label: f.name }))"
        />
        <a-input v-else-if="source === 'levels'" v-model:value="node.config.task" placeholder="请输入负责人层级说明" />
        <p v-else>{{ source === 'head' ? '由发起人的部门负责人审批' : '由发起人的直属主管审批' }}</p>
      </div>
      <a-collapse ghost class="advanced"
        ><a-collapse-panel key="advanced" header="更多人员规则与排除设置"
          ><NodeEditor v-model:node="node.approval!" :fields="fields" /></a-collapse-panel
      ></a-collapse>
    </template>
    <template v-else-if="node.kind === 'APPROVAL' && tab === 'rules'">
      <a-alert type="info" message="自动通过、退回类型、无人处理和回调设置仅用于设计，配置后暂不能发布。" show-icon /><h3>配置审批方式</h3
      ><a-form layout="vertical">
        <a-form-item label="审批类型"
          ><a-radio-group
            :value="node.config.approvalType || 'manual'"
            @change="node.config.approvalType = $event.target.value === 'manual' ? undefined : 'auto'"
            ><a-radio value="manual">人工审批</a-radio><a-radio value="auto">自动通过</a-radio></a-radio-group
          ></a-form-item
        >
        <a-form-item label="审批退回类型"
          ><a-radio-group v-model:value="node.config.returnType"
            ><a-radio value="choose">自选节点</a-radio><a-radio value="start">开始节点</a-radio></a-radio-group
          ></a-form-item
        >
        <a-form-item label="多人审批类型"
          ><a-radio-group v-model:value="node.approval!.options!.mode"
            ><a-radio value="ANY">或签（其中1人通过即可）</a-radio><a-radio value="ALL">会签（需所有人通过）</a-radio></a-radio-group
          ></a-form-item
        >
        <a-form-item label="审批人员为空时"
          ><a-radio-group v-model:value="node.config.emptyType"
            ><a-radio value="auto">自动通过</a-radio><a-radio value="transfer">自动转交给某个人</a-radio></a-radio-group
          ></a-form-item
        >
        <a-form-item v-if="node.config.emptyType === 'transfer'" label="转交人员"
          ><DirectorySelect v-model:value="node.config.users" kind="users"
        /></a-form-item>
        <a-form-item label="是否允许回调"
          ><a-radio-group v-model:value="node.config.callback"
            ><a-radio :value="false">否</a-radio><a-radio :value="true">是</a-radio></a-radio-group
          ></a-form-item
        >
        <a-form-item label="是否延迟通知"
          ><a-radio-group v-model:value="node.config.delay"
            ><a-radio :value="false">否</a-radio><a-radio :value="true">是</a-radio></a-radio-group
          ></a-form-item
        >
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
                :checked="node.config.buttons?.includes(action)"
                @change="toggleAction(action, $event.target.checked)"
                :aria-label="`允许${action}`" /></td></tr></tbody
      ></table>
    </template>
    <template v-else-if="node.kind === 'APPROVAL' && tab === 'fields'">
      <h3>参与者可以看见或者操作哪些字段</h3><FieldPermissions :fields="fields" v-model:value="node.approval!.fieldPermissions!" />
    </template>
    <template v-else-if="node.kind === 'CC' || node.kind === 'NOTICE'">
      <h3>{{ node.kind === 'CC' ? '请选择要抄送的人员' : '配置通知人员及通知内容' }}</h3>
      <a-radio-group v-model:value="node.config.source" class="people-types"
        ><a-radio v-if="node.kind === 'NOTICE'" value="initiator">发起人</a-radio><a-radio value="users">指定成员</a-radio
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
            ><a-checkbox-group v-model:value="node.config.channels" :options="['邮件', '微信公众号', '站内信']" /></a-form-item
          ><a-form-item label="通知模版"
            ><div class="notice-template"
              ><a-textarea
                v-model:value="node.config.template"
                :rows="6"
                placeholder="您提交的「流程名称」已通过「节点名称」，请尽快处理。" /><a-select
                class="insert-field"
                placeholder="置入字段"
                :value="null"
                :options="[
                  { value: '流程名称', label: '流程名称' },
                  { value: '节点名称', label: '节点名称' },
                  ...fields.map((f) => ({ value: f.name, label: f.name })),
                ]"
                @change="(v) => (node.config.template = (node.config.template || '') + '「' + v + '」')" /></div></a-form-item></a-form
      ></template>
    </template>
    <template v-else
      ><h3>配置任务</h3
      ><a-form layout="vertical"
        ><a-form-item label="任务说明"><a-textarea v-model:value="node.config.task" :rows="5" placeholder="请设置任务" /></a-form-item
        ><a-form-item label="任务处理人"><DirectorySelect v-model:value="node.config.users" kind="users" /></a-form-item></a-form
      ><p class="draft-note">原稿未提供任务配置详情，此处先保留任务说明与处理人设计。</p></template
    >
    <PeoplePicker
      :open="picker"
      :kind="pickerKind"
      :value="picked"
      @cancel="picker = false"
      @confirm="
        (ids) => {
          picked = ids;
          applyPeople();
        }
      "
    />
  </div>
</template>
<script setup lang="ts">
  import { ref, computed } from 'vue';
  import { PlusOutlined, CloseOutlined } from '@ant-design/icons-vue';
  import PeoplePicker from './PeoplePicker.vue';
  import DirectorySelect from '../components/DirectorySelect.vue';
  import NodeEditor from '../components/NodeEditor.vue';
  import FieldPermissions from './FieldPermissions.vue';
  import type { DesignNode, DesignBranch } from './graph';
  import type { FormField } from '../workflow.types';
  defineProps<{ fields: FormField[] }>();
  const node = defineModel<DesignNode>('node', { required: true });
  const lane = defineModel<DesignBranch>('lane');
  const tab = ref('people');
  const selectedSource = ref('');
  const source = computed(
    () =>
      selectedSource.value ||
      node.value.config.source ||
      (node.value.approval?.roleIds?.length
        ? 'roles'
        : node.value.approval?.approverRules?.some((r) => r.type === 'DIRECT_SUPERVISOR')
          ? 'supervisor'
          : node.value.approval?.approverRules?.some((r) => r.type === 'INITIATOR_DEPARTMENT_HEADS')
            ? 'head'
            : 'users')
  );
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
  function changeSource(value: string) {
    const n = node.value;
    n.config.source = ['field', 'levels'].includes(value) ? value : undefined;
    const a = n.approval!;
    a.userIds = [];
    a.roleIds = [];
    a.approverRules = [];
    if (value === 'supervisor') a.approverRules = [{ type: 'DIRECT_SUPERVISOR' }];
    if (value === 'head') a.approverRules = [{ type: 'INITIATOR_DEPARTMENT_HEADS' }];
    selectedSource.value = value;
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
  function applyPeople() {
    if (node.value.kind === 'APPROVAL') {
      if (pickerKind.value === 'users') node.value.approval!.userIds = [...picked.value];
      else node.value.approval!.roleIds = [...picked.value];
    } else node.value.config.users = [...picked.value];
    picker.value = false;
  }
  function toggleAction(action: string, checked: boolean) {
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
    padding: 0 0 24px;
  }
  .source-fields {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
    padding: 24px 0;
    max-width: 620px;
  }
  .source-fields > div,
  .source-fields > .ant-select {
    width: 100%;
  }
  .advanced {
    margin-top: 40px;
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
