import { userDepartmentIds } from './userDepartment';

/** 只在列表缺少所属部门字段时补查，不修改表格行。 */
export async function loadUserDrawerRecord(source, getRoles, getDepartments) {
  const record = { ...source };
  const hasDepartments = record.belongDepIds !== undefined;
  const [roles, departments] = await Promise.all([
    getRoles({ userid: record.id }),
    hasDepartments ? Promise.resolve([]) : getDepartments({ userId: record.id }),
  ]);
  record.selectedroles = roles || [];
  record.selecteddeparts = hasDepartments
    ? userDepartmentIds(record.belongDepIds)
    : userDepartmentIds((departments || []).map((item) => item.key));
  record.departIds = userDepartmentIds(record.departIds).split(',').filter(Boolean);
  record.sort = record.sort ?? 1000;
  // 不按逗号拆分名称猜测 ID 对应关系，选择器回显后会补齐准确名称。
  const options = record.selecteddeparts.split(',').filter(Boolean).map((id) => ({
    value: id,
    label: (departments || []).find((item) => item.key === id)?.title || id,
  }));
  return { record, options };
}
