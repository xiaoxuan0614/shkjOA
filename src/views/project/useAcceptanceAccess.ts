import { usePermission } from '/@/hooks/web/usePermission';
import { useUserStore } from '/@/store/modules/user';

/** 验收入口共用门禁；最终授权和业务状态仍由后端校验。 */
export function useAcceptanceAccess() {
  const userStore = useUserStore();
  const { hasPermission } = usePermission();
  // 系统内置管理员按登录账号识别，不使用可编辑的姓名或泛化角色名称。
  const isAdministrator = () => userStore.getUserInfo?.username === 'admin';
  function canOperateAcceptance(type: 'INTERNAL' | 'CUSTOMER', managerId?: unknown) {
    if (isAdministrator()) return true;
    if (type === 'INTERNAL') return hasPermission('project:internalAccept');
    const user: any = userStore.getUserInfo;
    const userId = String(user?.id || user?.userId || '');
    return hasPermission('project:accept') && !!userId && userId === String(managerId || '');
  }
  const canStartAcceptance = () => isAdministrator() || hasPermission('project:acceptance:submit');
  return { canOperateAcceptance, canStartAcceptance };
}
