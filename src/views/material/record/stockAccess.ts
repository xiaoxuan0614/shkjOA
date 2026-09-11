import { usePermission } from '/@/hooks/web/usePermission';
import { useUserStore } from '/@/store/modules/user';
import { APPROVAL_APPROVED, APPROVAL_PENDING, getApprovalStatusMeta } from '/@/utils/approvalStatus';

export const STOCK_APPROVE_PERMISSION = 'mtl:apply:approve';
export const STOCK_EXECUTE_PERMISSION = 'mtl:goods:io';

export const isProjectOutbound = (record: Recordable) => record.applyType === 'OUT' && record.usageType === 'PROJECT';

export function getStockStatusMeta(record: Recordable) {
  if (isProjectOutbound(record) && String(record.status) === APPROVAL_APPROVED) {
    const execution = { PENDING: '待出库', PARTIAL_EXECUTED: '部分出库', EXECUTED: '已出库' };
    return { color: 'blue', text: `免审批·${execution[record.executeStatus] || '已放行'}` };
  }
  return getApprovalStatusMeta(record.status);
}

/** 前端按钮门禁；部门负责人和库管身份仍由后端最终校验。 */
export function useStockAccess() {
  const { hasPermission } = usePermission();
  const userStore = useUserStore();
  const hasExecutePermission = () => hasPermission(STOCK_EXECUTE_PERMISSION);
  function canApprove(record: Recordable) {
    if (String(record.status) !== APPROVAL_PENDING || isProjectOutbound(record)) return false;
    // 入库保持原审批流程，限定库管操作权限。
    if (record.applyType === 'IN') return hasExecutePermission();
    if (record.applyType !== 'OUT' || !['MAINTENANCE', 'LABOR_PROTECTION'].includes(record.usageType)) return false;
    if (!hasPermission(STOCK_APPROVE_PERMISSION)) return false;
    const user: any = userStore.getUserInfo || {};
    const loginUser = (userStore.getLoginInfo as any)?.userInfo || {};
    const identity = user.userIdentity ?? loginUser.userIdentity;
    const responsibleDepartments = user.departIds ?? loginUser.departIds ?? [];
    const ids = Array.isArray(responsibleDepartments) ? responsibleDepartments : String(responsibleDepartments).split(',');
    return String(identity) === '2' && !!record.deptId && ids.map((id) => String(id).trim()).includes(String(record.deptId));
  }
  function canExecute(record: Recordable) {
    return hasExecutePermission() && String(record.status) === APPROVAL_APPROVED && ['PENDING', 'PARTIAL_EXECUTED'].includes(record.executeStatus);
  }
  return { canApprove, canExecute, hasExecutePermission };
}
