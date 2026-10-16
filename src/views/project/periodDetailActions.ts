import { isApprovalPending } from '/@/utils/approvalStatus';

export type PeriodDetailAction = { key: string; label: string; tab: 'contract' | 'plan'; mode: 'create' | 'view' | 'edit' | 'audit' };

/** 仅决定办理入口；办理页继续校验当前审批轮次、身份与后端权限。 */
export function resolvePeriodDetailActions(project: Record<string, any>, access: {
  userId: string; admin: boolean; manager: boolean; hasPermission: (code: string) => boolean;
}): PeriodDetailAction[] {
  const actions: PeriodDetailAction[] = [];
  if (!project.periodId || !access.userId) return actions;
  const submitted = !!project.contractId || ['-1', '0', '1', '2', '3'].includes(String(project.contractStatus ?? ''));
  if (!submitted && project.status === 'NOT_STARTED' && access.hasPermission('project:contract')) {
    actions.push({ key: 'contractSign', label: '合同签订', tab: 'contract', mode: 'create' });
  } else if (submitted) {
    if (isApprovalPending(project.contractStatus) && access.hasPermission('project:contract:approve')) {
      actions.push({ key: 'contractAudit', label: '合同审批', tab: 'contract', mode: 'view' });
    }
  }
  const editable = ['NOT_STARTED', 'PREPARING'].includes(project.status) && (access.admin || access.manager);
  if (project.status === 'PENDING_APPROVAL' && (access.admin || access.hasPermission('project:period:approve'))) {
    actions.push({ key: 'planAudit', label: '计划审批', tab: 'plan', mode: 'audit' });
  } else if (editable) {
    actions.push({ key: 'plan', label: '填写/编辑计划方案', tab: 'plan', mode: 'edit' });
  }
  return actions;
}
