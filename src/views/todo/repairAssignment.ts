import { defHttp } from '/@/utils/http/axios';

export interface AssignmentTarget { applicationId: string; departmentId: string }
export interface AssignmentRequest extends AssignmentTarget { requestId: string; assignedUserIds: string[] }
export interface AssignmentOptions { departmentId: string; departmentName: string; reason: string; members: { value: string; label: string }[] }

export function availableRepairAssignments(detail: Record<string, any>, applicationId: string, actorId: string): AssignmentTarget[] {
  if (!actorId || ['CLOSED', 'COMPLETED'].includes(detail.order?.workStatus)) return [];
  const app = (detail.applications || []).find((a: any) => a.id === applicationId && a.applicationType === 'COLLABORATION');
  if (!app || app.formData?.assignmentMode === 'WITH_APPROVAL' || ['DRAFT', 'WITHDRAWN', 'RETURNED', 'REJECTED', 'CANCELLED', 'CANCELED', 'CLOSED', 'TERMINATED'].includes(app.applicationStatus)) return [];
  return (app.formData?.departments || []).filter((d: any) => d.assignmentStatus === 'PENDING_ASSIGNMENT' && Array.isArray(d.approverIds) && d.approverIds.includes(actorId))
    .map((d: any) => ({ applicationId, departmentId: d.departmentId }));
}

export function repairAssignmentTarget(todo: Record<string, any>, params: Record<string, any>): AssignmentTarget | undefined {
  if (![todo.todoType, todo.actionKey].includes('REPAIR_COLLABORATION_ASSIGN')) return;
  const applicationId = String(params.applicationId || '').trim();
  const departmentId = String(params.departmentId || '').trim();
  if (!applicationId || !departmentId) return;
  return { applicationId, departmentId };
}

export async function assignmentOptions(target: AssignmentTarget): Promise<AssignmentOptions> {
  const data = await defHttp.get<AssignmentOptions>({ url: '/repair/collaboration/assignmentOptions', params: target });
  if (data?.departmentId !== target.departmentId || !Array.isArray(data.members) || data.members.some(m => typeof m.value !== 'string' || typeof m.label !== 'string')) throw new Error('部门人员响应不匹配，请重新加载');
  return data;
}

export async function assignMembers(payload: AssignmentRequest) {
  const response = await defHttp.post({ url: '/repair/collaboration/assign', data: payload }, { isTransformResponse: false, errorMessageMode: 'none', successMessageMode: 'none' });
  if (response?.success === true && response.code === 200) return;
  const error = new Error(response?.message || '指派结果未确认，请重试本次请求');
  Object.assign(error, { definite: response?.success === false });
  throw error;
}

export async function approvalCandidates(applicationId: string, taskId: string) {
  return defHttp.get({ url: '/repair/collaboration/assignmentOptions', params: { applicationId, taskId } });
}
export async function reviewCollaboration(payload: Record<string, unknown>) {
  const response = await defHttp.post({ url: '/repair/application/review', data: payload }, { isTransformResponse: false, errorMessageMode: 'none', successMessageMode: 'none' });
  if (response?.success === true && response.code === 200) return response.result;
  throw Object.assign(new Error(response?.message || '审批结果未确认，请重试本次请求'), { definite: response?.success === false });
}
