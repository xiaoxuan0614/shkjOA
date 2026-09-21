/** 用户负责部门按编辑接口约定提交字符串；清空必须显式提交。 */
export function userResponsibleDepartments(identity: unknown, value: unknown): string {
  if (String(identity) === '1') return '';
  return userDepartmentIds(value);
}

/** 所属部门与负责部门分别规范化，不能相互替代。 */
export function userDepartmentIds(value: unknown): string {
  const ids = Array.isArray(value) ? value : String(value ?? '').split(',');
  return [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))].join(',');
}
