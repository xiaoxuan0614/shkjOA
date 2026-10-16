import { buildUUID } from '/@/utils/uuid';

export function canManageFinance(roleCodes: string[]) {
  return roleCodes.some(role => role === 'admin' || role === 'finance_staff');
}
/** 旧登录响应可能缺少角色；仅允许发起服务端鉴权，不代表已获得财务权限。 */
export function canRequestFinance(roleCodes: string[]) {
  return !roleCodes.length || canManageFinance(roleCodes);
}
export const financeRequestId = () => buildUUID().replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
export function validateInvoiceContractAmount(amount: unknown, contractAmount: unknown) {
  if (contractAmount == null || String(contractAmount).trim() === '' || !Number.isFinite(Number(contractAmount)) || Number(contractAmount) < 0) {
    throw new Error('未获取到有效合同总价，请重新加载后再开票');
  }
  if (Number(amount) > Number(contractAmount)) throw new Error('本次开票金额不可大于合同总价');
}
export function financePayload(kind: 'receipt' | 'invoice', periodId: string, draft: any, requestId: string, fileIds: string[]) {
  const amount = Number(draft.amount);
  if (!periodId || !requestId) throw new Error('缺少分期或请求编号，请重新打开');
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(Math.round(amount * 100)) || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001) throw new Error('金额须大于0，最多两位小数，且不超过安全精度范围');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date || '')) throw new Error('请选择日期');
  const common = { periodId, amount, remark: String(draft.remark || '').trim(), requestId, fileIds };
  if (kind === 'receipt') {
    if (!draft.paymentRecordId) throw new Error('请选择本分期回款项');
    return { ...common, fileIds: [], paymentRecordId: draft.paymentRecordId, receiptDate: draft.date };
  }
  if (!String(draft.invoiceNo || '').trim()) throw new Error('请输入发票号');
  if (fileIds.length > 1) throw new Error('发票最多上传1个附件');
  const invoiceType = String(draft.invoiceType || '').trim();
  if (invoiceType && !['普通发票', '专用发票'].includes(invoiceType)) throw new Error('请选择有效的开票类型');
  return { ...common, invoiceNo: draft.invoiceNo.trim(), invoiceDate: draft.date, ...(invoiceType ? { invoiceType } : {}) };
}
