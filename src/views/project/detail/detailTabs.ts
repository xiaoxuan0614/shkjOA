export const DETAIL_TAB_KEYS = ['basic', 'quotation', 'contract', 'member', 'position', 'implement', 'acceptance', 'file', 'material'] as const;
export type DetailTabKey = (typeof DETAIL_TAB_KEYS)[number];

// CLOSED/未知状态不能当作已走完全部流程；历史入口允许按需查看。
const stageByStatus: Record<string, number> = {
  NOT_STARTED: 0,
  PREPARING: 2,
  PENDING_APPROVAL: 2,
  IMPLEMENTING: 3,
  DEBUGGING: 3,
  DEBUG_COMPLETED: 3,
  IMPLEMENT_COMPLETED: 3,
  PENDING_ACCEPT: 4,
  INTERNAL_ACCEPTING: 4,
  ACCEPTING: 4,
  REACCEPTING: 4,
  FAILED: 4,
  REWORKING: 4,
  WARRANTY: 4,
  COMPLETED: 4,
};

export function resolveDetailTabs(project: { status?: unknown; contractStatus?: unknown }): DetailTabKey[] {
  const contractStatus = String(project.contractStatus ?? '');
  const stage = Math.max(stageByStatus[String(project.status ?? '')] ?? 0, contractStatus === '1' ? 2 : 0);
  const visible = new Set<DetailTabKey>(['basic', 'quotation']);
  if (stage >= 2 || ['0', '1', '2', '3'].includes(contractStatus)) visible.add('contract');
  if (stage >= 2) ['member', 'position', 'file'].forEach((key) => visible.add(key as DetailTabKey));
  if (stage >= 3) ['implement', 'material'].forEach((key) => visible.add(key as DetailTabKey));
  if (stage >= 4) visible.add('acceptance');
  return DETAIL_TAB_KEYS.filter((key) => visible.has(key));
}
