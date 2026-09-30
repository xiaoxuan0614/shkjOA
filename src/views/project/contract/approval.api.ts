import { defHttp } from '/@/utils/http/axios';
export interface ContractApprovalDetail {
  instanceId: string;
  businessId: string;
  businessType: string;
  submitted: Record<string, unknown> | null;
  snapshotComplete: boolean;
  fieldPermissions: Record<string, string>;
}
async function read<T>(path: string, params: object): Promise<T> {
  const body = await defHttp.get({ url: `/project/contract/approval/${path}`, params }, { isTransformResponse: false, errorMessageMode: 'none' });
  if (path === 'actions' && body?.code === 404) throw new Error('后端尚未提供合同审批动作接口，请更新并重启后端服务');
  if (body?.success !== true || body.code !== 200) throw new Error(body?.message || '合同审批资料读取失败');
  return body.result;
}
export const currentContractApproval = (contractId: string) => read<string | null>('current', { contractId });
export const contractApprovalDetail = (instanceId: string) => read<ContractApprovalDetail>('detail', { instanceId });
export async function contractApprovalAttachment(instanceId: string, attachmentId: string): Promise<Blob> {
  const result = await defHttp.get({ url: '/project/contract/approval/attachment', params: { instanceId, attachmentId }, responseType: 'blob' }, { isTransformResponse: false, errorMessageMode: 'none' });
  if (!(result instanceof Blob)) throw new Error('附件响应异常');
  if (/json|text|html/i.test(result.type)) {
    let message = '附件下载失败';
    try { message = JSON.parse(await result.text()).message || message; } catch { /* Do not display raw server documents. */ }
    throw new Error(message);
  }
  return result;
}
export function visibleSubmitted(value: unknown, permissions: Record<string, string>, path = ''): any {
  if (permissions[path] === 'HIDDEN') return undefined;
  if (Array.isArray(value)) return value.map(item => visibleSubmitted(item, permissions, `${path}[]`)).filter(item => item !== undefined);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
    const next = path ? `${path}.${key}` : key;
    const filtered = visibleSubmitted(item, permissions, next);
    return filtered === undefined ? [] : [[key, filtered]];
  }));
}

export function assertContractApprovalIdentity(data: ContractApprovalDetail, workflow: { id: string; businessType: string; businessId: string }, instanceId: string, contractId?: string) {
  if (!data || !workflow || data.instanceId !== instanceId || workflow.id !== instanceId || data.businessType !== 'PROJECT_CONTRACT' || workflow.businessType !== 'PROJECT_CONTRACT' || !workflow.businessId || data.businessId !== workflow.businessId || (contractId && workflow.businessId !== contractId)) throw new Error('合同与审批实例不匹配，已停止读取');
}

export interface ContractApprovalActions {
  instanceId: string;
  status: string;
  canWithdraw: boolean;
  withdrawReason?: string | null;
  canResubmit: boolean;
  resubmitReason?: string | null;
}
export const contractApprovalActions = (contractId: string) => read<ContractApprovalActions | null>('actions', { contractId });
export async function withdrawContractApproval(payload: { contractId: string; requestId: string; comment: string }) {
  const { contractId, requestId, comment } = payload;
  if (!comment.trim()) throw new Error('请填写撤回原因');
  const body = await defHttp.post({ url: '/project/contract/approval/withdraw', params: { contractId, requestId, comment } }, { isTransformResponse: false, errorMessageMode: 'none' });
  if (body?.success !== true || body.code !== 200 || body.result?.status !== 'WITHDRAWN') throw new Error(body?.message || '合同撤回失败');
  return body.result;
}
