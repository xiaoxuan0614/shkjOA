export const PROJECT_PICK_STAGES = ['PREPARING', 'IMPLEMENTING', 'DEBUGGING', 'DEBUG_COMPLETED', 'IMPLEMENT_COMPLETED', 'PENDING_ACCEPT', 'INTERNAL_ACCEPTING', 'ACCEPTING', 'REACCEPTING', 'FAILED', 'REWORKING'];
export const PROJECT_RETURN_STAGES = [...PROJECT_PICK_STAGES, 'WARRANTY', 'COMPLETED', 'CLOSED'];

export function hasApplicationMenu(menus: any[], target: string, parent = ''): boolean {
  return menus.some(item => {
    const path = (String(item.path || '').startsWith('/') ? item.path : `${parent}/${item.path || ''}`).replace(/\/+$/, '');
    return path === target || hasApplicationMenu(item.children || [], target, path);
  });
}
export function projectMaterialOperations(project: Record<string, any>, participant: boolean, menus: any[]) {
  if (!project.periodId || !participant) return [];
  const actions: { key: string; label: string }[] = [];
  // 计划通过后即开放筹备期领料；项目阶段和旧 approvalStatus 不能替代计划审批结果。
  if (String(project.planStatus) === '1' && PROJECT_PICK_STAGES.includes(project.status) && hasApplicationMenu(menus, '/material/pick')) actions.push({ key: 'pick', label: '领料申请' });
  // 项目详情快捷入口仅计划通过后显示；独立还料页面仍按原总账规则校验。
  if (String(project.planStatus) === '1' && PROJECT_RETURN_STAGES.includes(project.status) && hasApplicationMenu(menus, '/material/return')) actions.push({ key: 'return', label: '还料申请' });
  return actions;
}
