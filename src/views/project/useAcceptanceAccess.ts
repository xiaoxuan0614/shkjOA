import { usePermission } from '/@/hooks/web/usePermission';

/** 验收入口共用门禁；最终授权和业务状态仍由后端校验。 */
export function useAcceptanceAccess() {
  const { hasPermission } = usePermission();
  function canOperateAcceptance(type: 'INTERNAL' | 'CUSTOMER', isAcceptedProjectManager = false, isOperationsMember = false) {
    if (type === 'INTERNAL') {
      // 普通运维成员即可，不要求主管；管理员也必须有真实所属部门资格。
      return isOperationsMember && hasPermission('project:internalAccept');
    }
    // 分期详情不返回经理ID；以 member/list 的有效已接受经理身份为准。
    return hasPermission('project:accept') && isAcceptedProjectManager;
  }
  const canStartAcceptance = (isAcceptedProjectManager = false) => isAcceptedProjectManager && hasPermission('project:acceptance:submit');
  // 列表入口单独授权，不沿用内外验办理权限或管理员账号兜底。
  const canViewAcceptanceEntry = () => hasPermission('project:acceptance:view');
  return { canOperateAcceptance, canStartAcceptance, canViewAcceptanceEntry };
}
