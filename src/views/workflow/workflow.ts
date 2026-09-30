import { serializeStarters } from './starterScope';
import { structureErrors } from './structure';
import type { WorkflowDefinition, WorkflowModel, WorkflowNode } from './workflow.types';

export const modeOptions = [
  { value: 'ANY', label: '或签 · 一人通过' },
  { value: 'ALL', label: '会签 · 全员通过' },
  { value: 'COUNT', label: '按人数通过' },
  { value: 'PERCENT', label: '按百分比通过' },
  { value: 'SEQUENTIAL', label: '串行会签' },
];
export const fieldTypes = [
  { value: 'string', label: '文本', icon: 'ant-design:font-size-outlined' },
  { value: 'number', label: '数字', icon: 'ant-design:number-outlined' },
  { value: 'boolean', label: '是 / 否', icon: 'ant-design:check-square-outlined' },
  { value: 'date', label: '日期', icon: 'ant-design:calendar-outlined' },
  { value: 'attachment', label: '附件', icon: 'ant-design:paper-clip-outlined' },
];
export const permissionOptions = [
  { value: 'EDITABLE', label: '可编辑' },
  { value: 'READ_ONLY', label: '只读' },
  { value: 'HIDDEN', label: '隐藏' },
];
export function newId(prefix: string) {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${prefix}_${globalThis.crypto.randomUUID().replace(/-/g, '')}`;
  }
  // 局域网 HTTP 不提供 randomUUID，但支持安全随机数；保持 UUID v4 格式。
  if (typeof globalThis.crypto?.getRandomValues !== 'function') {
    throw new Error('当前浏览器不支持安全随机数，请升级浏览器或使用 HTTPS 访问');
  }
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return `${prefix}_${Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')}`;
}
export function newNode(): WorkflowNode {
  return {
    key: newId('node'),
    name: '审批人',
    userIds: [],
    roleIds: [],
    excludedUserIds: [],
    allowSelf: false,
    approverRules: [],
    fieldPermissions: {},
    options: { mode: 'ANY' },
  };
}
export function newDefinition(): WorkflowDefinition {
  return {
    key: newId('flow'),
    name: '',
    businessType: 'WORKFLOW_FORM',
    formFields: [],
    nodes: [newNode()],
    policy: { starters: null, readers: [], fields: {}, initiatorFields: {} },
  };
}
export function parseDefinition(model: WorkflowModel): WorkflowDefinition {
  const data = JSON.parse(model.draft_json);
  if (!data || data.key !== model.process_key || !Array.isArray(data.nodes)) throw new Error('流程草稿结构异常，请刷新或联系管理员。');
  return data;
}
export function canEditDefinition(definition: WorkflowDefinition) {
  return ['WORKFLOW_FORM', 'PROJECT_CONTRACT'].includes(definition.businessType);
}
export function validateDefinition(definition: WorkflowDefinition): string[] {
  const errors: string[] = [];
  try {
    serializeStarters(definition.policy?.starters);
  } catch (e) {
    errors.push((e as Error).message);
  }
  if (!definition.name.trim()) errors.push('请填写流程名称');
  if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(definition.key)) errors.push('流程标识需以字母开头，仅含字母、数字、下划线，最多64位');
  if (definition.nodes.length < 1 || definition.nodes.length > 30) errors.push('审批节点数量必须为1至30个');
  if (definition.businessType === 'WORKFLOW_FORM' && (!definition.formFields?.length || definition.formFields.length > 100))
    errors.push('自定义表单字段需1至100项');
  const fieldKeys = new Set<string>();
  for (const field of definition.formFields || []) {
    if (!field.name.trim() || !/^[A-Za-z][A-Za-z0-9_]*(?:\[\])?(?:\.[A-Za-z][A-Za-z0-9_]*(?:\[\])?)*$/.test(field.key))
      errors.push(`字段“${field.name || '未命名'}”需要名称和有效标识`);
    if (field.key.split(/\.|\[\]/).some((part) => ['__proto__', 'constructor', 'prototype'].includes(part)) || fieldKeys.has(field.key))
      errors.push(`字段标识“${field.key}”不可重复或使用保留名称`);
    if (!['string', 'number', 'boolean', 'date', 'object', 'array', 'attachment'].includes(field.type)) errors.push(`字段“${field.name}”类型不支持`);
    fieldKeys.add(field.key);
  }
  const nodeKeys = new Set<string>();
  for (const [index, node] of definition.nodes.entries()) {
    const label = `节点${index + 1}“${node.name}”`;
    if (!node.name.trim()) errors.push(`节点${index + 1}需要名称`);
    if (!node.key || nodeKeys.has(node.key)) errors.push(`${label}标识为空或重复`);
    nodeKeys.add(node.key);
    if (
      !node.options?.behavior?.autoApprove &&
      !['AUTO_APPROVE', 'TRANSFER'].includes(node.options?.behavior?.emptyApprover || '') &&
      !node.userIds?.length &&
      !node.roleIds?.length &&
      !node.approverRules?.length
    )
      errors.push(`${label}请选择审批人员来源`);
    const sources = (node.userIds?.length || 0) + (node.roleIds?.length || 0) + (node.approverRules?.length || 0);
    if (sources > 100) errors.push(`${label}选人配置合计最多100项`);
    for (const rule of node.approverRules || []) {
      if (rule.type.startsWith('DEPARTMENT_') && !rule.departmentIds?.length) errors.push(`${label}请选择部门`);
      if (rule.type === 'FORM_USERS' && (!rule.fieldKey || !fieldKeys.has(rule.fieldKey))) errors.push(`${label}请选择有效的表单人员字段`);
      if (rule.type === 'SUPERVISOR_CHAIN' && (!Number.isInteger(rule.levels) || rule.levels! < 1 || rule.levels! > 30))
        errors.push(`${label}主管层级需为1至30的整数`);
      if (rule.type === 'POSITION_USERS' && !rule.positionIds?.length) errors.push(`${label}请选择岗位`);
    }
    for (const ids of [node.userIds, node.roleIds, node.excludedUserIds]) {
      if (ids && (ids.length > 100 || new Set(ids).size !== ids.length || ids.some((id) => !id.trim())))
        errors.push(`${label}人员列表无效或超过100项`);
    }
    const options = node.options || {};
    const b = options.behavior;
    if (b?.autoApprove && b.kind && b.kind !== 'APPROVAL') errors.push(`${label}只有审批节点可以自动通过`);
    if (b?.emptyApprover === 'TRANSFER' && !b.fallbackUserId) errors.push(`${label}请选择一名无人时转交人员`);
    if (
      b?.notificationDelayMinutes != null &&
      (!Number.isInteger(b.notificationDelayMinutes) || b.notificationDelayMinutes < 0 || b.notificationDelayMinutes > 10080)
    )
      errors.push(`${label}延迟分钟需为0至10080`);
    if (b?.callbackEnabled) errors.push(`${label}回调尚未定义`);
    if (b?.channels && (!b.channels.length || b.channels.some((c) => c !== 'SITE'))) errors.push(`${label}通知仅支持站内信`);
    if ((b?.notificationTemplate?.length || 0) > 1000 || (b?.description?.length || 0) > 1000) errors.push(`${label}通知模板和任务说明最多1000字`);
    for (const match of b?.notificationTemplate?.matchAll(/\$\{([^}]+)\}/g) || [])
      if (!fieldKeys.has(match[1])) errors.push(`${label}通知模板引用了不存在的字段`);

    if (['COUNT', 'PERCENT'].includes(options.mode || '')) {
      if (!Number.isInteger(options.threshold) || Number(options.threshold) < 1 || Number(options.threshold) > 100)
        errors.push(`${label}通过阈值必须为1至100的整数`);
    }
    if (options.timeoutMinutes != null && (!Number.isInteger(options.timeoutMinutes) || options.timeoutMinutes < 1))
      errors.push(`${label}超时分钟数必须为正整数`);
    if (node.condition && (!fieldKeys.has(node.condition.field) || !node.condition.value.trim())) errors.push(`${label}请填写有效条件字段和值`);
  }
  const settings = definition.settings;
  if (settings?.channels && (!settings.channels.length || settings.channels.some((c) => c !== 'SITE'))) errors.push('通知通道仅支持站内信');
  if (settings?.undefinedInitiatorOption || settings?.autoCompleteNextMonthDay != null) errors.push('未定义的发起人选项和次月自动完成不可启用');
  if (settings?.reminderHours?.some((h) => ![24, 48, 96].includes(h))) errors.push('提醒小时只支持24、48、96');
  errors.push(...structureErrors(definition));
  if (JSON.stringify(definition).length > 65536) errors.push('流程定义超过65536字符，请减少配置');
  return [...new Set(errors)];
}
export function removeField(definition: WorkflowDefinition, key: string) {
  if (
    JSON.stringify(definition.stages || []).includes(`"${key}"`) ||
    definition.nodes.some(
      (node) =>
        node.approverRules?.some((r) => r.fieldKey === key) ||
        node.options?.behavior?.notificationTemplate?.includes('${' + key + '}') ||
        node.condition?.field === key ||
        (node.options?.predicate && JSON.stringify(node.options.predicate).includes(`"${key}"`))
    )
  ) {
    throw new Error('该字段被审批条件引用，请先修改条件。');
  }
  definition.formFields = (definition.formFields || []).filter((field) => field.key !== key);
  for (const permissions of [
    definition.policy?.fields,
    definition.policy?.initiatorFields,
    ...definition.nodes.map((node) => node.fieldPermissions),
  ]) {
    if (permissions) delete permissions[key];
  }
}
export const statusLabels: Record<string, string> = { RUNNING: '审批中', APPROVED: '已通过', REJECTED: '已驳回', WITHDRAWN: '已撤回' };
