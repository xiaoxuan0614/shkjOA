/** 一键带入先读取完整分页；失败或项目切换时不写入半份清单。 */
export async function loadPickAllAccounts(
  fetchPage: (params: { periodId: string; pageNo: number; pageSize: number }) => Promise<any>,
  periodId: string,
  isCurrent: () => boolean,
) {
  const rows: any[] = [];
  const seen = new Set<string>();
  const pageSize = 200;
  let expectedTotal: number | undefined;
  for (let pageNo = 1; pageNo <= 1000; pageNo++) {
    if (!isCurrent()) throw new Error('项目已切换');
    const result = await fetchPage({ periodId, pageNo, pageSize });
    if (!isCurrent()) throw new Error('项目已切换');
    const records = Array.isArray(result) ? result : result?.records;
    if (!Array.isArray(records)) throw new Error('可申请物料返回格式异常，请重试');
    const total = result?.total == null ? undefined : Number(result.total);
    if (total !== undefined && (!Number.isSafeInteger(total) || total < 0)) throw new Error('物料分页数量异常，请重试');
    if (expectedTotal !== undefined && total !== expectedTotal) throw new Error('项目物料已变化，请重新带入');
    expectedTotal = total;
    for (const row of records) {
      const id = String(row?.materialId ?? '');
      if (!id || seen.has(id) || (row.periodId != null && String(row.periodId) !== periodId)) {
        throw new Error('物料分页重复或项目数据已变化，请重新带入');
      }
      seen.add(id);
      rows.push(row);
    }
    if (Array.isArray(result)) return rows;
    if (total !== undefined) {
      if (rows.length === total) return rows;
      if (rows.length > total || records.length === 0) throw new Error('物料分页不完整，请重新带入');
    } else if (records.length < pageSize) return rows;
  }
  throw new Error('物料数量过多，请分批添加');
}

/** 仅追加缺少的可领物料，不修改已有行及其手工数量。 */
export function missingPickMaterials(accounts: any[], selected: any[]) {
  const selectedIds = new Set(selected.map(row => String(row.id)));
  return accounts.filter(row => !selectedIds.has(String(row.materialId)) && Number.isFinite(Number(row.availableApplyQty)) && Number(row.availableApplyQty) > 0)
    .map(row => {
      const unitName = String(row.baseUnitName || '').trim();
      if (!unitName) throw new Error(`「${row.materialName || '未命名物料'}」缺少基准单位，请先维护单位`);
      return { ...row, id: row.materialId, unit: unitName, baseUnitName: unitName, unitList: [{ unitName }] };
    });
}
