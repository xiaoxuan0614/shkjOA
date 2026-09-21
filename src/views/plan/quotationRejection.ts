/** 审计按时间倒序；仅匹配明确的审批驳回，不误用修改/作废原因。 */
export function isQuotationRejection(row: any) {
  const action = String(row?.action || '').trim().toUpperCase();
  const result = String(row?.result ?? '').trim().toUpperCase();
  return ['REJECT', 'REJECTED', 'APPROVE_REJECT', '驳回'].includes(action) ||
    (['APPROVE', 'APPROVAL', '审批'].includes(action) && ['0', 'REJECT', 'REJECTED', '驳回'].includes(result));
}

export async function findQuotationRejection(fetchPage: (pageNo: number) => Promise<any>, isCurrent: () => boolean = () => true) {
  for (let pageNo = 1; isCurrent(); pageNo++) {
    const rows = await fetchPage(pageNo);
    if (!isCurrent()) return undefined;
    if (!Array.isArray(rows)) throw new Error('审批记录格式不正确');
    const rejected = rows.find(isQuotationRejection);
    if (rejected) return rejected;
    if (rows.length < 100) return undefined;
  }
}
