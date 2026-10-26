import type { FormField, WorkflowDefinition, WorkflowPredicate, WorkflowStage } from './workflow.types';

export interface BusinessMetadata {
  businessType: string;
  businessType_text?: string;
  fields: FormField[];
  conditionFields: string[];
  scenes?: { sceneKey: string; name: string; processKey: string; customForm?: boolean; [key: string]: unknown }[];
}
export const businessTypeLabels: Record<string, string> = { WORKFLOW_FORM: '自定义表单', PROJECT_CONTRACT: '项目管理－合同签订', REPAIR_OPS_APPLICATION: '维修事项审批', STOCK_PROJECT_REQUISITION: '项目领料审批' };

/** Business fields are adapter-owned, never a user-authored form or snapshot. */
export function validateBusinessDefinition(definition: WorkflowDefinition, metadata?: BusinessMetadata): string[] {
  if (definition.businessType === 'WORKFLOW_FORM') return [];
  if (!metadata || metadata.businessType !== definition.businessType) return ['业务字段目录未就绪，请重新读取'];
  const errors: string[] = [];
  const checkPermissions = (permissions?: Record<string, string>) => {
    if (Object.values(permissions || {}).some((v) => v !== 'READ_ONLY' && v !== 'HIDDEN')) errors.push('业务字段仅允许只读或隐藏');
  };
  checkPermissions(definition.policy?.fields);
  checkPermissions(definition.policy?.initiatorFields);
  const checkCondition = (condition?: { field: string }) => {
    if (condition && !metadata.conditionFields.includes(condition.field)) errors.push('条件字段不在业务目录允许范围内');
  };
  const predicate = (p?: WorkflowPredicate) => {
    p?.conditions?.forEach(checkCondition);
    p?.children?.forEach(predicate);
  };
  const stage = (s: WorkflowStage) => { predicate(s.condition); s.children?.forEach(stage); };
  definition.nodes.forEach((node) => {
    checkPermissions(node.fieldPermissions);
    checkCondition(node.condition);
    predicate(node.options?.predicate);
  });
  definition.stages?.forEach(stage);
  return [...new Set(errors)];
}

/** Resolve the scene by process key: multiple repair processes share one business type. */
export function businessLabel(businessType: string, processKey?: string, catalog: BusinessMetadata[] = []): string {
  const business = catalog.find(item => item.businessType === businessType);
  if (business?.businessType_text?.trim()) return business.businessType_text.trim();
  const scene = business?.scenes?.find(item => item.processKey === processKey);
  if (scene?.name) return scene.name;
  if (businessType === 'REPAIR_OPS_APPLICATION' && processKey === 'repair_ops_collaboration') return '维修内协邀请';
  return businessTypeLabels[businessType] || businessType || '未关联业务';
}

export function businessFormInstructions(businessType: string) {
  if (businessType === 'PROJECT_CONTRACT') return {
    submission: '在项目管理－合同签订页面填写合同，提交审批。',
    attachments: '沿用原合同页面的回款计划、报价明细和附件，无需在此重新配置。',
  };
  if (businessType === 'REPAIR_OPS_APPLICATION') return {
    submission: '在维修单详情中发起对应事项申请，提交后由后端启动已启用的审批流程。',
    attachments: '申请内容、事项明细和附件由维修业务提供，在此配置审批节点及业务字段的查看权限。',
  };
  if (businessType === 'STOCK_PROJECT_REQUISITION') return {
    submission: '在项目领料页面填写领料申请并提交审批。',
    attachments: '沿用领料申请的物料明细和业务数据，无需在此重新搭建表单。',
  };
  return {
    submission: '在对应业务页面填写申请并提交审批。',
    attachments: '申请内容、明细和附件由对应业务提供，无需在此重新搭建表单。',
  };
}
