import Big from 'big.js';
import { decimalPrice, hasPrice } from './quotationPricing';

/** 服务费税率使用百分数原值，6 表示 6%；只在用户编辑时重算。 */
export function serviceFeePrice(cost: unknown, rate: unknown) {
  const price = decimalPrice(cost, '服务费成本价').times(decimalPrice(rate, '税率', 4).div(100).plus(1)).round(2, Big.roundHalfUp);
  return decimalPrice(price.toFixed(2), '服务费含税单价').toFixed(2);
}

export function serviceFeeCopy(source: Record<string, any>) {
  const costPrice = source.costPrice ?? null;
  const markupRate = source.markupRate ?? null;
  return { name: source.name, description: source.description || '', remark: String(source.description || '').slice(0, 500),
    unit: '项', quantity: 1, costPrice, markupRate,
    guidePrice: hasPrice(costPrice) && hasPrice(markupRate) ? serviceFeePrice(costPrice, markupRate) : null };
}

export function serviceFeePayload(row: Record<string, any>, options = { structure: true, cost: true, price: true }) {
  const name = String(row.name || '').trim();
  const unit = String(row.unit || '').trim();
  if (!name || name.length > 100) throw new Error('服务费名称必填且最多100字');
  if (!unit || unit.length > 50) throw new Error('服务费单位必填且最多50字');
  const quantity = decimalPrice(row.quantity, '服务费数量', 4);
  if (!quantity.gt(0)) throw new Error('服务费数量必须大于0');
  if (String(row.description || '').length > 1000 || String(row.remark || '').length > 500) throw new Error('服务费描述最多1000字、备注最多500字');
  const result: Record<string, any> = { ...(row.id ? { id: row.id } : {}), name, unit, quantity: Number(quantity),
    description: row.description || '', remark: row.remark || '' };
  if (options.cost) result.costPrice = Number(decimalPrice(row.costPrice, '服务费成本价'));
  if (options.price) {
    result.markupRate = Number(decimalPrice(row.markupRate, '税率', 4));
    result.guidePrice = Number(decimalPrice(row.guidePrice, '服务费含税单价'));
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
