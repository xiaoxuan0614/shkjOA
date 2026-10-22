import { defHttp } from '/@/utils/http/axios';
export type Row = Record<string, any>;
export type Scope = 'ALL' | 'REPORTED' | 'RESPONSIBLE' | 'HELPING' | 'HISTORY';
export const workStates: Record<string, string> = { DRAFT: '草稿', PENDING: '待维修', PROCESSING: '维修中', COMPLETED: '已完工', CLOSED: '异常关闭' };
export const quotationStates: Record<string, string> = { UNDETERMINED: '未选择', PENDING_QUOTATION: '待填写报价', NOT_REQUIRED: '无需报价', HEAD_REVIEW: '主管审核', GM_REVIEW: '总经理审核', WAIT_CUSTOMER: '待客户确认', CONFIRMED: '客户已确认', RETURNED: '已退回' };
export function listParams(params: Row, defaultScope: Scope) {
  const scopes = ['ALL', 'REPORTED', 'RESPONSIBLE', 'HELPING', 'HISTORY'];
  return { pageNo: Math.max(1, Number(params.pageNo) || 1), pageSize: Math.min(200, Math.max(1, Number(params.pageSize) || 20)), scope: scopes.includes(params.scope) ? params.scope : defaultScope, ...(params.workStatus && workStates[params.workStatus] ? { workStatus: params.workStatus } : {}) };
}
export function normalizePage(data: Row) {
  if (!Array.isArray(data?.records) || !Number.isFinite(Number(data.total))) throw new Error('列表响应格式异常');
  return { ...data, records: data.records, total: Number(data.total) };
}
export async function listRepairs(params: Row, scope: Scope) {
  return normalizePage(await defHttp.get({ url: '/repair/order/list', params: listParams(params, scope) }));
}
export async function repairDetail(id: string) {
  const data = await defHttp.get<Row>({ url: '/repair/order/detail', params: { id } });
  if (!data?.order || String(data.order.id) !== id) throw new Error('工单详情响应不匹配');
  return data;
}
export async function repairLogs(id: string, pageNo: number) {
  return normalizePage(await defHttp.get({ url: '/repair/order/logs', params: { id, pageNo, pageSize: 20 } }));
}
export function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'object') return '—';
  return String(value);
}
export function hours(value: unknown) { return value == null ? '—' : `${(Number(value) / 3600).toFixed(2)} 小时`; }
export function projectName(row: Row) { return row.projectName || [row.projectNameSnapshot, row.periodNameSnapshot].filter(Boolean).join(' / ') || '—'; }
export async function repairAttachment(id: string): Promise<Blob> {
  const blob = await defHttp.get<Blob>({ url: '/repair/order/attachment/download', params: { id }, responseType: 'blob' }, { isTransformResponse: false });
  if (!(blob instanceof Blob)) throw new Error('附件响应异常');
  if (blob.type.includes('json')) throw new Error('附件不可用或没有访问权限');
  return blob;
}
