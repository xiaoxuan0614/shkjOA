export const PROJECT_PICK_STAGES = ['IMPLEMENTING', 'DEBUGGING', 'DEBUG_COMPLETED', 'IMPLEMENT_COMPLETED', 'PENDING_ACCEPT', 'INTERNAL_ACCEPTING', 'ACCEPTING', 'REACCEPTING', 'FAILED', 'REWORKING'];
export const PROJECT_RETURN_STAGES = ['PREPARING', ...PROJECT_PICK_STAGES, 'WARRANTY', 'COMPLETED', 'CLOSED'];

export function hasApplicationMenu(menus: any[], target: string, parent = ''): boolean {
  return menus.some(item => {
    const path = (String(item.path || '').startsWith('/') ? item.path : `${parent}/${item.path || ''}`).replace(/\/+$/, '');
    return path === target || hasApplicationMenu(item.children || [], target, path);
  });
}
export function projectMaterialOperations(project: Record<string, any>, participant: boolean, menus: any[]) {
  if (!project.periodId || !participant) return [];
  const actions: { key: string; label: string }[] = [];
  if (PROJECT_PICK_STAGES.includes(project.status) && hasApplicationMenu(menus, '/material/pick')) actions.push({ key: 'pick', label: '领料申请' });
  if (PROJECT_RETURN_STAGES.includes(project.status) && hasApplicationMenu(menus, '/material/return')) actions.push({ key: 'return', label: '还料申请' });
  return actions;
}
