import { defHttp } from '/@/utils/http/axios';
import type { PeriodApprovalRecord } from './periodApproval';

const options = { isTransformResponse: false, successMessageMode: 'none', errorMessageMode: 'none' } as const;

function unwrap<T>(response: any): T {
  if (response?.success !== true || Number(response?.code) !== 200) throw new Error(response?.message || '计划审批请求失败，请刷新后重试');
  return response.result;
}

/** 合并项目详情 DTO 未定义审批字段，读取分期实体，不能用历史结果猜当前状态。 */
export async function getPeriodApprovalState(periodId: string): Promise<Record<string, any>> {
  const response = await defHttp.get({ url: '/project/period/list', params: { id: periodId, pageNo: 1, pageSize: 2 } }, options);
  const page = unwrap<{ records: Record<string, any>[]; total: number }>(response);
  if (!Array.isArray(page?.records) || page.records.length !== 1 || String(page.records[0].id) !== periodId || Number(page.total) !== 1) {
    throw new Error('分期审批状态不匹配，请刷新后重试');
  }
  return page.records[0];
}

export async function getPeriodApprovalHistory(periodId: string): Promise<PeriodApprovalRecord[]> {
  const response = await defHttp.get({ url: '/project/period/approval/history', params: { periodId } }, options);
  const rows = unwrap<PeriodApprovalRecord[]>(response);
  if (!Array.isArray(rows) || rows.some((row) => !row?.id || String(row.periodId) !== periodId)) throw new Error('审批历史数据不匹配，请刷新');
  return rows;
}

async function postApproval(action: 'submit' | 'approve' | 'withdraw', data: Record<string, string>) {
  const response = await defHttp.post({ url: `/project/period/approval/${action}`, data, headers: { 'Content-Type': 'application/json' } }, options);
  return unwrap<PeriodApprovalRecord>(response);
}

export const submitPeriodApproval = (periodId: string) => postApproval('submit', { periodId });
export const approvePeriodPlan = (data: { periodId: string; approvalId: string; approvalStatus: '1' | '0'; approvalReason?: string }) => postApproval('approve', data);
export const withdrawPeriodApproval = (data: { periodId: string; approvalId: string; approvalReason?: string }) => postApproval('withdraw', data);
