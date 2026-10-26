import { defHttp } from '/@/utils/http/axios';
import { validateDocumentFile } from '/@/utils/documentUploadPolicy';

export interface ReceiptPlan {
  id: string; paymentNode: string; plannedAmount: number; actualAmount: number;
  plannedDate: string | null; paymentDate: string | null; receiptStatus: string;
}
export interface ReceiptSummary {
  periodId: string; plannedAmount: number; receivedAmount: number; invoicedAmount: number;
  remainingAmount: number; plans: ReceiptPlan[];
}
export interface FinanceEntry {
  id: string; periodId: string; paymentRecordId?: string; amount: number; receiptDate?: string | null;
  invoiceDate?: string | null; invoiceNo?: string; remark?: string; fileIds?: string[];
  sourceType: 'MANUAL' | 'LEGACY'; requestId: string; version: number;
}
export interface FinancePage { records: FinanceEntry[]; total: number; current: number; size: number }
const quiet = { successMessageMode: 'none', errorMessageMode: 'none' } as const;
export const receiptSummary = (periodId: string) => defHttp.get<ReceiptSummary>({ url: '/project/receipt/summary', params: { periodId } }, quiet);
export const receiptList = (params: Record<string, any>) => defHttp.get<FinancePage>({ url: '/project/receipt/list', params }, quiet);
export const invoiceList = (params: Record<string, any>) => defHttp.get<FinancePage>({ url: '/project/invoice/list', params }, quiet);
// 每分期一行，名称和金额由财务分页接口统一返回，不再逐行补查summary。
export const financePeriods = (params: Record<string, any>) => {
  const filters: Record<string, string> = {};
  for (const key of ['periodId', 'keyword', 'customerName', 'receiptStatus', 'invoiceStatus']) {
    const value = String(params[key] ?? '').trim();
    if (value) filters[key] = value;
  }
  return defHttp.get({ url: '/project/receipt/summaryPage', params: { pageNo: params.pageNo, pageSize: params.pageSize, ...filters } }, quiet);
};
export const financePeriod = (periodId: string) => defHttp.get({ url: '/project/project/projectPeriodDetail', params: { periodId } }, quiet);
export async function addFinanceEntry(kind: 'receipt' | 'invoice', payload: Record<string, any>) {
  const response: any = await defHttp.post({ url: `/project/${kind}/add`, params: payload }, { ...quiet, isTransformResponse: false });
  if (response?.success !== true || ![0, 200].includes(response.code)) throw new Error(response?.message || '保存失败');
  if (!response.result?.id) throw new Error('提交结果未确认，请刷新记录核对，重试将沿用原请求编号');
  return response.result as FinanceEntry;
}
export async function uploadFinanceFile(file: File) {
  await validateDocumentFile(file);
  const response: any = await defHttp.uploadFile({ url: '/sys/common/upload' }, { file, name: 'file', data: { biz: 'project/finance' } }, { isReturnResponse: true });
  if (response?.success !== true || ![0, 200].includes(response.code) || !response.message) throw new Error(response?.message || '附件上传失败');
  return String(response.message);
}
