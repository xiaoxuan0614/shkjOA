/** Only submitted confirms a mutation; success=true may be a read-only material check. */
export function completionOutcome(result: any): 'submitted' | 'return-required' {
  if (result?.submitted === true) return 'submitted';
  if (result?.submitted === false && result?.materialReturnCompleted === false) return 'return-required';
  throw new Error('接口未确认工序提交成功，请刷新后核实');
}

export function forceCompletionPayload(processId: string, reason: string) {
  const forceSubmitReason = reason.trim();
  if (!forceSubmitReason || forceSubmitReason.length > 200) throw new Error('请填写1至200字的强制提交原因');
  return { processId, status: 'COMPLETED' as const, forceSubmit: true, forceSubmitReason };
}

/** Filter after collecting all pages; shouldReturnQty is not remainingReturnQty. */
export async function loadCompletionMaterials(fetchPage: (pageNo: number, pageSize: number) => Promise<any>) {
  const rows: any[] = [];
  let pageNo = 1;
  let total = 0;
  do {
    const page = await fetchPage(pageNo, 200);
    if (!Array.isArray(page?.records) || !Number.isFinite(Number(page.total))) throw new Error('物料明细分页信息异常，请重试');
    total = Number(page.total);
    if (!page.records.length && rows.length < total) throw new Error('物料明细未加载完整，请重试');
    rows.push(...page.records);
    pageNo++;
  } while (rows.length < total);
  return rows.filter((row) => Number.isFinite(Number(row.shouldReturnQty)) && Number(row.shouldReturnQty) !== 0);
}
