/** 登录身份只用于界面判断，业务接口仍须后端鉴权。 */
export function normalizeIdentity(user: any = {}, fallbackRoles: any[] = []) {
  const list = (value: any): string[] => (Array.isArray(value) ? value : String(value || '').split(',')).map(String).map(v => v.trim()).filter(Boolean);
  const roles = Array.isArray(user.roles) ? user.roles : fallbackRoles;
  const roleCodes = roles.map((role: any) => typeof role === 'string' ? role : role.roleCode || role.code || role.value || '').map(String).filter(Boolean);
  return {
    userId: String(user.id || user.userid || user.userId || ''),
    departmentIds: list(user.belongDepIds),
    responsibleDepartmentIds: list(user.departIds),
    roleIds: Array.isArray(user.roles) ? user.roles.map((role: any) => typeof role === 'object' ? role.id || role.roleId || '' : '').filter(Boolean).map(String) : [],
    roleCodes,
    canHandleInternal: roleCodes.includes('admin') || roleCodes.includes('operations_manager'),
  };
}
