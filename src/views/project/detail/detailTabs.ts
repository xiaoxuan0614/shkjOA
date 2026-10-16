import { isApprovalPendingSubmit, isApprovalApproved } from '/@/utils/approvalStatus';

export const DETAIL_TAB_KEYS = ['basic', 'quotation', 'contract', 'plan', 'member', 'position', 'implement', 'acceptance', 'file', 'material', 'payment'] as const;
export type DetailTabKey = (typeof DETAIL_TAB_KEYS)[number];

// CLOSED/未知状态不能当作已走完全部流程；历史入口允许按需查看。
const stageByStatus: Record<string, number> = {
  NOT_STARTED: 0,
  PREPARING: 2,
  PENDING_APPROVAL: 2,
  IMPLEMENTING: 3,
  DEBUGGING: 3,
  DEBUG_COMPLETED: 3,
  IMPLEMENT_COMPLETED: 4,
  PENDING_ACCEPT: 4,
  INTERNAL_ACCEPTING: 4,
  ACCEPTING: 4,
  REACCEPTING: 4,
  FAILED: 4,
  REWORKING: 4,
  WARRANTY: 4,
  COMPLETED: 4,
};

export function resolveDetailTabs(project: { status?: unknown; contractStatus?: unknown }, history: DetailTabKey[] = []): DetailTabKey[] {
  const status = String(project.status ?? '');
  const stage = stageByStatus[status] ?? 0;
  const visible = new Set<DetailTabKey>(['basic', 'quotation']);
  if (isApprovalApproved(project.contractStatus)) visible.add('payment');
  // 合同状态不推导项目阶段；只有已有送审记录才开放早期合同入口。
  if (!isApprovalPendingSubmit(project.contractStatus) || stage >= 2) visible.add('contract');
  if (stage >= 2) ['plan', 'member', 'position', 'file'].forEach((key) => visible.add(key as DetailTabKey));
  if (stage >= 3) ['implement', 'material'].forEach((key) => visible.add(key as DetailTabKey));
  if (stage >= 4) visible.add('acceptance');
  // history 只来自当前分期的后端业务记录，不使用浏览器打开记录。
  if (status === 'CLOSED') history.forEach(key => visible.add(key));
  return DETAIL_TAB_KEYS.filter((key) => visible.has(key));
}
