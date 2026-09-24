/** 仅判断真实所属部门，不以负责部门、销售角色或管理员角色代替。 */
export function canViewProjectQuotation(departmentIds: string[], departments: any[]): boolean {
  return departments.some((department) =>
    departmentIds.includes(String(department.id ?? department.key ?? '')) &&
    ['市场部', '技术部'].includes(String(department.departName ?? department.title ?? '').trim()) &&
    String(department.delFlag ?? '0') === '0'
  );
}
