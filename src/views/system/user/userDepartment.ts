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

/** 树选择器的 label 可能是 VNode；表单 schema 只存文本，避免克隆组件依赖图。 */
export function userDepartmentOptions(options: any[]): { label: string; value: string }[] {
  function text(value: any, seen = new Set<any>()): string {
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (!value || typeof value !== 'object' || seen.has(value)) return '';
    seen.add(value);
    if (Array.isArray(value)) return value.map(item => text(item, seen)).join('');
    return text(value.props?.title ?? value.props?.label ?? value.children, seen);
  }
  return (options || []).map(item => ({ value: String(item.value), label: text(item.label) || String(item.value) }));
}
