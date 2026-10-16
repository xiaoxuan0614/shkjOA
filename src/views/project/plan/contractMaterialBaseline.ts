/** 合同冻结清单是最低用量依据，不能使用报价采用标记或当前计划反推。 */
export function contractMaterialBaseline(snapshot: any): Record<string, any>[] {
  if (!Array.isArray(snapshot?.records)) throw new Error('合同清单快照缺失，请核对合同后重试');
  const seen = new Set<string>();
  return snapshot.records.map((item: any) => {
    const materialId = String(item?.materialId || '');
    const quantity = Number(item?.quantity);
    if (!materialId || !Number.isFinite(quantity) || quantity <= 0) throw new Error('合同清单物料或数量无效，请核对合同');
    if (seen.has(materialId)) throw new Error('合同清单存在重复物料，请核对合同');
    seen.add(materialId);
    return { ...item, materialId, quantity };
  });
}
