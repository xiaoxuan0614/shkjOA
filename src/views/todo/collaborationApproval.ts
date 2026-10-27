export interface ApprovalDepartment { departmentId: string; departmentName: string; reason?: string; members: { value: string; label: string }[] }
export interface ApprovalCandidates { assignmentMode: 'WITH_APPROVAL'; taskId: string; nodeKey: 'head' | 'departments'; departments: ApprovalDepartment[] }
export function parseApprovalCandidates(data: any, taskId: string): ApprovalCandidates {
  if (data?.assignmentMode !== 'WITH_APPROVAL' || data.taskId !== taskId || !['head', 'departments'].includes(data.nodeKey) || !Array.isArray(data.departments)) throw new Error('审批候选响应不匹配，请重新加载');
  if (data.departments.some((d: any) => !d.departmentId || !Array.isArray(d.members) || d.members.some((m: any) => typeof m.value !== 'string' || typeof m.label !== 'string')) || new Set(data.departments.map((d: any) => d.departmentId)).size !== data.departments.length || (data.nodeKey === 'departments' && data.departments.length > 1)) throw new Error('审批候选部门数据异常，请重新加载');
  return data;
}
export function approvalAssignments(data: ApprovalCandidates | undefined, chosen: Record<string, string[]>, approve: boolean): Record<string, unknown> {
  if (!approve) return {};
  if (!data) throw new Error('请先加载审批候选人员');
  if (!data.departments.length) return {};
  const used = new Set<string>();
  const departments = data.departments.map(d => {
    const ids = chosen[d.departmentId] || [];
    if (!d.members.length) throw new Error(`${d.departmentName}暂无可选人员，不能直接通过`);
    if (!ids.length || ids.length > 20) throw new Error(`请为${d.departmentName}选择1至20名人员`);
    for (const id of ids) {
      if (!d.members.some(m => m.value === id) || used.has(id)) throw new Error('请选择有效的本部门人员，各部门不能重复选择同一人');
      used.add(id);
    }
    return { departmentId: d.departmentId, assignedUserIds: [...ids] };
  });
  return data.nodeKey === 'head' ? { departmentAssignments: departments } : { assignedUserIds: departments[0].assignedUserIds };
}
