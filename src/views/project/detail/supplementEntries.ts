import { canApplySupplement, SUPPLEMENT_STAGES } from './periodOperations';

/** 项目详情快捷入口；不改变独立列表及待办的办理规则。 */
export function resolveSupplementEntries(project: Record<string, any>, manager: boolean, approver: boolean) {
  const entries: { key: string; label: string }[] = [];
  if (!project.periodId) return entries;
  if (canApplySupplement(project.status, manager)) entries.push({ key: 'supplementApply', label: '申请补料' });
  if (SUPPLEMENT_STAGES.includes(project.status) && approver) entries.push({ key: 'supplementApprove', label: '补料审批' });
  if (['IMPLEMENT_COMPLETED', 'PENDING_ACCEPT', 'INTERNAL_ACCEPTING', 'ACCEPTING', 'REACCEPTING', 'FAILED', 'REWORKING', 'WARRANTY', 'COMPLETED', 'CLOSED'].includes(project.status) && (manager || approver)) {
    entries.push({ key: 'supplementHistory', label: '补料记录' });
  }
  return entries;
}

export function supplementEntryOptions(key: string, approver: boolean) {
  if (key === 'supplementApply') return { allowCreate: true, initialTab: 'mine' };
  if (key === 'supplementApprove') return { allowCreate: false, initialTab: 'pending' };
  if (key === 'supplementHistory') return { allowCreate: false, readOnly: true, initialTab: approver ? 'history' : 'mine' };
  return undefined;
}
