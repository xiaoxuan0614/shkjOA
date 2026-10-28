export type QuotationPreviewBasis = 'cost' | 'quote';
export function quotationPreviewBasis(access: { cost: boolean; quote: boolean }, requested: QuotationPreviewBasis): QuotationPreviewBasis | null {
  if (access[requested]) return requested;
  return access.quote ? 'quote' : access.cost ? 'cost' : null;
}

/** 仅投影当前有权查看的一种金额口径，复用预览的单价槽位；不修改业务数据或正式导出。 */
export function buildQuotationPreview(name: string, rows: Record<string, any>[], fees: Record<string, any>[], access: { cost: boolean; quote: boolean }, requested: QuotationPreviewBasis = 'quote') {
  const basis = quotationPreviewBasis(access, requested);
  return {
    candidateName: name || '报价单',
    items: rows.map(row => ({
      materialName: row.materialName, brand: row.brand, model: row.model,
      specificationParams: row.specificationParams, quantity: row.plannedQty ?? row.quantity,
      unit: row.unit, remark: row.remark, finalPrice: basis === 'cost' ? row.basePrice : basis === 'quote' ? row.finalPrice : null,
    })),
    serviceFees: fees.map(row => ({
      name: row.name, description: row.description, quantity: row.quantity, unit: row.unit,
      remark: row.remark, guidePrice: basis === 'cost' ? row.costPrice : basis === 'quote' ? row.guidePrice : null,
    })),
  };
}
