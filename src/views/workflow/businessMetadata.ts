import type { FormField, WorkflowDefinition, WorkflowPredicate, WorkflowStage } from './workflow.types';

export interface BusinessMetadata {
  businessType: string;
  fields: FormField[];
  conditionFields: string[];
}
export const businessTypeLabels: Record<string, string> = { WORKFLOW_FORM: '自定义表单', PROJECT_CONTRACT: '项目管理－合同签订' };

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
