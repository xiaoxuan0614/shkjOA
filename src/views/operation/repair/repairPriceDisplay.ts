import type { Row } from './repair.api';
export const quotationStages: Record<string,string> = { DRAFT:'草稿', HEAD_REVIEW:'运维主管审核中', GM_REVIEW:'市场主管审核中', RETURNED:'已退回', WAIT_CUSTOMER:'待登记客户确认', CONFIRMED:'客户已确认', NOT_REQUIRED:'无需报价', INVALIDATED:'已失效', WITHDRAWN:'已撤回' };
const applicationStates: Record<string,string> = { DRAFT:'草稿', PENDING:'审批中', APPROVED:'已通过', RETURNED:'已退回', WITHDRAWN:'已撤回', TERMINATED:'已终止' };
const legacyStates: Record<string,string> = { ...applicationStates, REJECTED:'已驳回', RUNNING:'审批中', SUBMITTED:'已提交' };
export function completionState(record: Row, applications: Row[]) {
  const application = record.applicationId ? applications.find(item=>item.id===record.applicationId) : undefined;
  const status = application ? application.applicationStatus : record.approvalStatus;
  return (application ? applicationStates : legacyStates)[String(status)] || '未提供审批状态';
}
export function quoteItems(quotation: Row, items: Row[]) {
  return quotation.id ? items.filter(item=>item.quotationId===quotation.id).slice().sort((a,b)=>Number(a.sortNo ?? a.itemNo ?? 0)-Number(b.sortNo ?? b.itemNo ?? 0)) : [];
}
export function money(value: unknown) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value).toFixed(2) : '—';
}
export const dateText = (value: unknown) => value ? String(value).replace('T',' ').slice(0,19) : '—';
export function quoteVersion(record: Row, quotations: Row[]) {
  const quote = record.quotationId ? quotations.find(item=>item.id===record.quotationId) : undefined;
  return quote?.revisionNo != null ? `第${quote.revisionNo}版` : '未提供报价版本';
}
