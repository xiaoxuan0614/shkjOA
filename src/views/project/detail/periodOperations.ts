import { isArrivalStage, isPhysicalProject } from '../arrivalPayment';

export const SUPPLEMENT_STAGES = ['IMPLEMENTING', 'DEBUGGING', 'DEBUG_COMPLETED'];
export function canApplySupplement(status: unknown, manager: boolean) {
  return manager && SUPPLEMENT_STAGES.includes(String(status));
}

export function resolvePeriodOperations(project: Record<string, any>, access: {
  manager: boolean; hasPermission: (code: string) => boolean; typeNames: Record<string, string>;
}) {
  const actions: { key: string; label: string; dangerous?: boolean }[] = [];
  if (!project.periodId) return actions;
  const has = access.hasPermission;
  if (access.manager && isArrivalStage(project) && isPhysicalProject(project, access.typeNames) && has('project:arrival:confirm')) {
    actions.push({ key: 'arrival', label: '确认到货' });
  }
  if ([...SUPPLEMENT_STAGES, 'REWORKING'].includes(project.status) && has('project:implement')) {
    actions.push({ key: 'process', label: project.status === 'REWORKING' ? '返工进度' : '确认工序实施进度' });
  }
  const supplementHistoryStage = [...SUPPLEMENT_STAGES, 'IMPLEMENT_COMPLETED', 'PENDING_ACCEPT', 'INTERNAL_ACCEPTING', 'ACCEPTING', 'REACCEPTING', 'FAILED', 'REWORKING', 'WARRANTY', 'COMPLETED', 'CLOSED'].includes(project.status);
  if (canApplySupplement(project.status, access.manager) || (supplementHistoryStage && has('project:materialApply:approve'))) {
    actions.push({ key: 'supplement', label: canApplySupplement(project.status, access.manager) ? '补料申请/管理' : '补料审批记录' });
  }
  if (['IMPLEMENT_COMPLETED', 'PENDING_ACCEPT', 'INTERNAL_ACCEPTING', 'ACCEPTING', 'REACCEPTING', 'FAILED', 'REWORKING', 'WARRANTY', 'COMPLETED', 'CLOSED'].includes(project.status) &&
    ['project:acceptance:view', 'project:acceptance:submit', 'project:internalAccept', 'project:accept', 'project:rework:apply'].some(has)) {
    actions.push({ key: 'acceptance', label: '验收/返工办理' });
  }
  if (project.status === 'WARRANTY' && has('project:warranty')) actions.push({ key: 'complete', label: '项目完结' });
  if (project.status && !['CLOSED', 'COMPLETED'].includes(project.status) && has('project:close')) actions.push({ key: 'close', label: '关闭项目', dangerous: true });
  return actions;
}
