/** 仅取页面当前可见字段；不把成本、比例或审批意见传入文件预览。 */
export function buildQuotationPreview(name: string, rows: Record<string, any>[], fees: Record<string, any>[], canViewQuote: boolean) {
  return {
    candidateName: name || '报价单',
    items: rows.map(row => ({
      materialName: row.materialName, brand: row.brand, model: row.model,
      specificationParams: row.specificationParams, quantity: row.plannedQty ?? row.quantity,
      unit: row.unit, remark: row.remark, finalPrice: canViewQuote ? row.finalPrice : null,
    })),
    serviceFees: fees.map(row => ({
      name: row.name, description: row.description, quantity: row.quantity, unit: row.unit,
      remark: row.remark, guidePrice: canViewQuote ? row.guidePrice : null,
    })),
  };
}
