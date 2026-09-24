<template>
  <aside class="node-editor" aria-label="审批节点设置">
    <header
      ><h2>节点设置</h2><a-button type="text" aria-label="关闭节点设置" :disabled="false" @click="emit('close')"><CloseOutlined /></a-button
    ></header>
    <a-form layout="vertical">
      <a-form-item label="节点名称" required><a-input v-model:value="node.name" :maxlength="100" /></a-form-item>
      <a-tabs v-model:activeKey="tab">
        <a-tab-pane key="people" tab="审批人员">
          <p class="hint">合并所有来源后排除指定人员，实际候选人在节点激活时计算。</p>
          <a-form-item label="指定人员"><DirectorySelect v-model:value="node.userIds" kind="users" /></a-form-item>
          <a-form-item label="指定角色"><DirectorySelect v-model:value="node.roleIds" kind="roles" /></a-form-item>
          <section v-for="(rule, index) in node.approverRules" :key="index" class="organization-rule">
            <div class="rule-heading"
              ><span>组织选人规则</span><a-button danger type="text" size="small" @click="node.approverRules?.splice(index, 1)">移除</a-button></div
            >
            <a-select
              v-model:value="rule.type"
              :options="ruleOptions"
              @change="
                () => {
                  delete rule.departmentIds;
                  delete rule.positionIds;
                  delete rule.includeChildren;
                }
              "
            />
            <template v-if="rule.type.startsWith('DEPARTMENT_')">
              <DirectorySelect v-model:value="rule.departmentIds" kind="departments" placeholder="选择部门" />
              <a-checkbox v-model:checked="rule.includeChildren">包含下级部门</a-checkbox>
            </template>
            <DirectorySelect v-if="rule.type === 'POSITION_USERS'" v-model:value="rule.positionIds" kind="positions" placeholder="选择岗位" />
          </section>
          <a-button block type="dashed" @click="node.approverRules!.push({ type: 'DIRECT_SUPERVISOR' })"><PlusOutlined />添加组织规则</a-button>
          <a-divider />
          <a-form-item label="排除人员"
            ><DirectorySelect v-model:value="node.excludedUserIds" kind="users" placeholder="这些人员不参与当前节点"
          /></a-form-item>
          <a-checkbox v-model:checked="node.allowSelf">允许发起人审批自己的申请</a-checkbox>
        </a-tab-pane>
        <a-tab-pane key="rules" tab="审批规则">
          <a-form-item label="多人审批方式"
            ><a-select v-model:value="node.options!.mode" :options="modeOptions" @change="delete node.options!.threshold"
          /></a-form-item>
          <a-form-item
            v-if="['COUNT', 'PERCENT'].includes(node.options!.mode || '')"
            :label="node.options!.mode === 'COUNT' ? '通过人数' : '通过百分比'"
            required
          >
            <a-input-number
              v-model:value="node.options!.threshold"
              :min="1"
              :max="100"
              :precision="0"
              :addon-after="node.options!.mode === 'PERCENT' ? '%' : '人'"
            />
          </a-form-item>
          <a-alert type="info" show-icon message="无人可审批时停止发起，不会自动通过。驳回结束本轮审批。" />
          <a-divider />
          <a-form-item label="节点执行条件">
            <a-alert v-if="node.options?.predicate" type="info" message="该节点已有组合条件，本版保留原条件，不在此覆盖。" />
            <template v-else>
              <a-switch :checked="!!node.condition" @change="toggleCondition" /> <span class="hint">仅满足条件时执行</span>
              <div v-if="node.condition" class="condition-fields">
                <a-select
                  v-model:value="node.condition.field"
                  placeholder="选择字段"
                  :options="fields.map((f) => ({ value: f.key, label: f.name }))"
                />
                <a-select v-model:value="node.condition.operator" :options="operators" />
                <a-input v-model:value="node.condition.value" placeholder="比较值" />
              </div>
            </template>
          </a-form-item>
          <a-form-item label="超时提醒（分钟）"
            ><a-input-number
              v-model:value="node.options!.timeoutMinutes"
              :min="1"
              :precision="0"
              placeholder="不设置"
              @change="
                (v) => {
                  if (v == null) delete node.options!.timeoutMinutes;
                }
              "
          /></a-form-item>
          <p class="hint">提醒需环境开启定时提醒服务，不会代替人工审批。</p>
          <a-form-item label="超时升级通知人员"><DirectorySelect v-model:value="node.options!.escalationUserIds" kind="users" /></a-form-item>
          <a-form-item label="节点激活时抄送"><DirectorySelect v-model:value="node.options!.ccUserIds" kind="users" /></a-form-item>
        </a-tab-pane>
        <a-tab-pane key="fields" tab="字段权限">
          <p class="hint">已有签署可能冻结编辑，实际操作以办理时的权限为准。</p>
          <a-empty v-if="!fields.length" description="请先在表单配置中添加字段" />
          <a-form-item v-for="field in fields" :key="field.key" :label="field.name">
            <a-select
              :value="node.fieldPermissions?.[field.key]"
              allow-clear
              placeholder="继承默认权限"
              :options="permissionOptions"
              @change="(v) => setPermission(field.key, v)"
            />
          </a-form-item>
        </a-tab-pane>
      </a-tabs>
    </a-form>
    <footer><a-button type="primary" :disabled="false" @click="emit('close')">完成设置</a-button></footer>
  </aside>
</template>
<script setup lang="ts">
  import { ref } from 'vue';
  import { CloseOutlined, PlusOutlined } from '@ant-design/icons-vue';
  import DirectorySelect from './DirectorySelect.vue';
  import { modeOptions, permissionOptions } from '../workflow';
  import type { WorkflowNode, FormField, FieldPermission } from '../workflow.types';
  defineProps<{ fields: FormField[] }>();
  const node = defineModel<WorkflowNode>('node', { required: true });
  const emit = defineEmits(['close']);
  const tab = ref('people');
  const ruleOptions = [
    { value: 'DIRECT_SUPERVISOR', label: '发起人的直属主管' },
    { value: 'INITIATOR_DEPARTMENT_HEADS', label: '发起人的部门负责人' },
    { value: 'DEPARTMENT_MEMBERS', label: '指定部门成员' },
    { value: 'DEPARTMENT_HEADS', label: '指定部门负责人' },
    { value: 'POSITION_USERS', label: '指定岗位人员' },
  ];
  const operators = [
    { value: 'EQ', label: '等于' },
    { value: 'NE', label: '不等于' },
    { value: 'GT', label: '大于' },
    { value: 'GE', label: '大于等于' },
    { value: 'LT', label: '小于' },
    { value: 'LE', label: '小于等于' },
  ];
  function toggleCondition(enabled: boolean) {
    if (enabled) node.value.condition = { field: '', operator: 'EQ', value: '' };
    else delete node.value.condition;
  }
  function setPermission(key: string, value?: FieldPermission) {
    if (value) node.value.fieldPermissions![key] = value;
    else delete node.value.fieldPermissions![key];
  }
</script>
<style scoped>
  .node-editor {
    background: var(--component-background, #fff);
    padding: 20px;
    width: 390px;
    flex: 0 0 390px;
    border-left: 1px solid #e5e7eb;
    overflow-y: auto;
  }
  header,
  .rule-heading,
  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  header {
    margin-bottom: 18px;
  }
  h2 {
    margin: 0;
    font-size: 17px;
  }
  .hint {
    color: #595959;
    font-size: 12px;
    line-height: 1.7;
  }
  .ant-select {
    width: 100%;
  }
  .organization-rule {
    padding: 12px 0;
    border-top: 1px solid #eee;
    display: grid;
    gap: 10px;
  }
  .condition-fields {
    display: grid;
    gap: 10px;
    margin-top: 12px;
  }
  footer {
    justify-content: flex-end;
    padding-top: 16px;
  }
  @media (max-width: 900px) {
    .node-editor {
      width: 100%;
      flex-basis: auto;
      border-left: 0;
      border-top: 1px solid #e5e7eb;
    }
  }
</style>
