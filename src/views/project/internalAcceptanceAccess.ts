import { defHttp } from '/@/utils/http/axios';

/** 部门树接口仅返回未删除部门；status 不参与后端内验资格判断。 */
export function isOperationsDirector(departmentIds: string[], tree: any[]): boolean {
  const matches: any[] = [];
  const visit = (rows: any[]) => rows.forEach((row) => {
    if (String(row.departName || row.title || '').trim() === '运维部' && (row.delFlag == null || String(row.delFlag) === '0')) matches.push(row);
    if (Array.isArray(row.children)) visit(row.children);
  });
  visit(tree);
  if (matches.length !== 1) return false;
  const id = String(matches[0].id || matches[0].key || '');
  return !!id && departmentIds.includes(id);
}

export async function readInternalAcceptanceAccess(identity: { userId: string; roleCodes: string[]; responsibleDepartmentIds: string[] }) {
  if (!identity.userId) return false;
  if (identity.roleCodes.includes('admin')) return true;
  if (!identity.responsibleDepartmentIds.length) return false;
  const response = await defHttp.get(
    { url: '/sys/sysDepart/queryTreeList' },
    { isTransformResponse: false, errorMessageMode: 'none' }
  );
  if (response?.success !== true || !Array.isArray(response.result)) throw new Error('负责部门查询失败');
  return isOperationsDirector(identity.responsibleDepartmentIds, response.result);
}
