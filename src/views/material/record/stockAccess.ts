import { reactive } from 'vue';
import { getMembers } from '/@/views/project/detail/ProjectDetail.api';
import { usePermission } from '/@/hooks/web/usePermission';
import { useUserStore } from '/@/store/modules/user';
import { APPROVAL_APPROVED, APPROVAL_PENDING, getApprovalStatusMeta } from '/@/utils/approvalStatus';

export const STOCK_APPROVE_PERMISSION = 'mtl:apply:approve';
export const STOCK_EXECUTE_PERMISSION = 'mtl:goods:io';

export const isProjectOutbound = (record: Recordable) => record.applyType === 'OUT' && record.usageType === 'PROJECT';

export function getStockStatusMeta(record: Recordable) {
  return getApprovalStatusMeta(record.status);
}

/** 前端按钮门禁；部门负责人和库管身份仍由后端最终校验。 */
export function useStockAccess() {
  const { hasPermission } = usePermission();
  const userStore = useUserStore();
  const hasExecutePermission = () => hasPermission(STOCK_EXECUTE_PERMISSION);
  const managedPeriods = reactive(new Set<string>());
  async function prepareApprovalAccess(records: Recordable[]) {
    const user: any = userStore.getUserInfo || {};
    const userId = String(user.id || user.userId || '');
    const periods = [
      ...new Set(
        records
          .filter((record) => isProjectOutbound(record) && String(record.status) === APPROVAL_PENDING)
          .map((record) => String(record.periodId || ''))
          .filter(Boolean)
      ),
    ];
    await Promise.all(
      periods.map(async (periodId) => {
        managedPeriods.delete(periodId);
        let pageNo = 1;
        while (true) {
          const result: any = await getMembers({ periodId, pageNo, pageSize: 100 });
          const members = Array.isArray(result) ? result : result?.records || [];
          if (
            members.some(
              (item) =>
                String(item.userId) === userId &&
                String(item.inviteStatus) === '1' &&
                Number(item.delFlag || 0) === 0 &&
                String(item.memberRole)
                  .split(',')
                  .map((role) => role.trim())
                  .includes('2')
            )
          ) {
            managedPeriods.add(periodId);
            return;
          }
          if (Array.isArray(result) || members.length < 100 || pageNo * 100 >= Number(result.total)) return;
          pageNo++;
        }
      })
    );
    return records;
  }
  function canApprove(record: Recordable) {
    if (String(record.status) !== APPROVAL_PENDING) return false;
    if (isProjectOutbound(record)) return managedPeriods.has(String(record.periodId || ''));
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
  return { canApprove, canExecute, hasExecutePermission, prepareApprovalAccess };
}
