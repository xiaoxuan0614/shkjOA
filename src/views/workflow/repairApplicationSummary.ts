// Only consume the permission-filtered form projection, never the raw snapshot.
export function repairApplicationDepartments(visible: Record<string, unknown>) {
  const entries = Object.entries(visible);
  const direct = entries.find(([key, value]) => key.split('.').pop() === 'departments' && Array.isArray(value));
  const form = entries.find(([key, value]) => key.split('.').pop() === 'formData' && value && typeof value === 'object');
  const departments = direct?.[1] ?? (form?.[1] as any)?.departments;
  return (Array.isArray(departments) ? departments : []).map((department) => ({
    name: typeof department?.departmentName === 'string' && department.departmentName.trim() ? department.departmentName : '部门名称未返回',
    reason: typeof department?.reason === 'string' && department.reason.trim() ? department.reason : '未填写协助原因',
  }));
}
