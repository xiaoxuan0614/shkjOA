import Big from 'big.js';
import { decimalPrice, hasPrice } from './quotationPricing';

/** 仅合并展示，保留原行引用，保存/审批仍读取各自数组。 */
export function quotationDisplayRows(materials: Record<string, any>[], fees: Record<string, any>[]) {
  return [...materials, ...fees.map((fee, index) => ({ _key: `service:${fee._key ?? fee.id ?? index}`, _serviceFee: fee }))];
}

/** 指导比例使用百分数原值；税率 taxRate 仅展示，不参与计算。 */
export function serviceFeePrice(cost: unknown, rate: unknown) {
  const price = decimalPrice(cost, '服务费成本价').times(decimalPrice(rate, '指导比例', 4).div(100).plus(1)).round(2, Big.roundHalfUp);
  return decimalPrice(price.toFixed(2), '服务费指导价').toFixed(2);
}

export function serviceFeeTaxText(value: unknown) {
  if (!hasPrice(value)) return '—';
  try { return `${new Big(String(value)).toString()}%`; } catch { return '—'; }
}

export function serviceFeeCopy(source: Record<string, any>, directQuotation = false) {
  const costPrice = source.costPrice ?? null;
  const markupRate = source.guideMarkupRate ?? 0;
  return { serviceFeeId: source.id, name: source.name, description: source.description || '', remark: '',
    unit: String(source.unit || '').trim() || '项', quantity: 1, costPrice, markupRate, taxRate: source.taxRate ?? source.markupRate ?? null,
    guidePrice: directQuotation ? '0.00' : hasPrice(costPrice) && hasPrice(markupRate) ? serviceFeePrice(costPrice, markupRate) : null };
}

export function serviceFeePayload(row: Record<string, any>, options = { structure: true, cost: true, price: true }, directQuotation = false) {
  const name = String(row.name || '').trim();
  const unit = String(row.unit || '').trim();
  if (!name || name.length > 100) throw new Error('服务费名称必填且最多100字');
  if (!unit || unit.length > 50) throw new Error('服务费单位必填且最多50字');
  const quantity = decimalPrice(row.quantity, '服务费数量', 4);
  if (!quantity.gt(0)) throw new Error('服务费数量必须大于0');
  if (String(row.description || '').length > 1000 || String(row.remark || '').length > 500) throw new Error('服务费描述最多1000字、备注最多500字');
  const result: Record<string, any> = { ...(row.id ? { id: row.id } : {}), name, unit, quantity: Number(quantity),
    description: row.description || '', remark: row.remark || '' };
  if (row.serviceFeeId) result.serviceFeeId = row.serviceFeeId;
  if (hasPrice(row.taxRate)) result.taxRate = Number(decimalPrice(row.taxRate, '税率', 6));
  if (options.cost) result.costPrice = Number(decimalPrice(row.costPrice, '服务费成本价'));
  // 新选行须冻结已带出的默认价格，否则服务端会回落到基础库旧markupRate。
  // 已有明细仍严格遵守价格编辑权限，不借保存备注覆盖价格。
  if (options.price || (!row.id && options.structure && row.serviceFeeId)) {
    if (!directQuotation) result.markupRate = Number(decimalPrice(row.markupRate, '指导比例', 4));
    // 普通成员新选行可能来自旧本地草稿，保存时按当前成本再校准默认价。
    // 有定价权时保留人工输入；已有行不在加载或保存时擅自重算。
    const guidePrice = !directQuotation && !options.price && options.cost && !row.id
      ? serviceFeePrice(row.costPrice, row.markupRate) : row.guidePrice;
    result.guidePrice = Number(decimalPrice(guidePrice, '服务费指导价'));
  }
  return result;
}

/** 缺失或脱敏价格不当作零，不能展示不完整的合计。 */
export function quotationAmount(rows: Record<string, any>[], priceKey: string, quantityKey: string) {
  try {
    return rows.reduce((sum, row) => {
      if (!hasPrice(row[priceKey]) || !hasPrice(row[quantityKey])) throw new Error('价格不可用');
      return sum.plus(decimalPrice(row[priceKey], '单价').times(decimalPrice(row[quantityKey], '数量', 4)).round(2, Big.roundHalfUp));
    }, new Big(0)).toFixed(2);
  } catch { return null; }
}

/** 两种金额独立汇总，某类价格缺失不影响另一类；按行四舍五入后累加。 */
export function quotationTotals(materials: Record<string, any>[], fees: Record<string, any>[]) {
  const total = (materialKey: string, feeKey: string) => {
    const material = quotationAmount(materials, materialKey, 'plannedQty');
    const fee = quotationAmount(fees, feeKey, 'quantity');
    return material === null || fee === null ? null : new Big(material).plus(fee).toFixed(2);
  };
  return { cost: total('basePrice', 'costPrice'), final: total('finalPrice', 'guidePrice') };
}

/** 报价底部汇总：物料和服务费均按成本单价乘数量计算。 */
export function quotationSummary(materials: Record<string, any>[], fees: Record<string, any>[]) {
  const materialCost = quotationAmount(materials, 'basePrice', 'plannedQty');
  const serviceFee = quotationAmount(fees, 'costPrice', 'quantity');
  return {
    materialCount: materials.length,
    materialCost,
    serviceFee,
    total: materialCost === null || serviceFee === null ? null : new Big(materialCost).plus(serviceFee).toFixed(2),
  };
}

/** 服务费批复只能由审批接口写入，使用报价明细 ID，不使用基础库 ID。 */
export function serviceFeeApprovalItems(rows: Record<string, any>[]) {
  const ids = new Set<string>();
  return rows.map(row => {
    const itemId = String(row.id ?? '').trim();
    if (!itemId || ids.has(itemId)) throw new Error('服务费明细 ID 缺失或重复，请刷新后审批');
    ids.add(itemId);
    const approvalOpinion = row.approvalOpinion ?? '';
    if (typeof approvalOpinion !== 'string' || approvalOpinion.length > 500) throw new Error('每条服务费的审批意见必须为字符串且不能超过 500 字');
    return { itemId, approvalOpinion };
  });
}
