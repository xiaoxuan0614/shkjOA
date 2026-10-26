import Big from 'big.js';

export const hasPrice = (value: unknown) => value !== null && value !== undefined && value !== '';

/** 市场报价的只读加价百分比；不改写后端 markupRate 或价格。 */
export function quotationPercent(cost: any, price: any): string {
  if (!hasPrice(cost) || !hasPrice(price)) return '—';
  try {
    const base = decimalPrice(cost, '成本价');
    const final = decimalPrice(price, '报价');
    return base.eq(0) ? '—' : `${final.minus(base).div(base).times(100).round(2, Big.roundHalfUp).toFixed(2)}%`;
  } catch {
    return '—';
  }
}

export function quotationApprovalItems(rows: any[]) {
  if (!rows.length) throw new Error('报价明细为空，请刷新后审批');
  const ids = new Set<string>();
  return rows.map((row) => {
    const itemId = String(row.id ?? '').trim();
    if (!itemId || ids.has(itemId)) throw new Error('报价明细 ID 缺失或重复，请刷新后审批');
    ids.add(itemId);
    const approvalOpinion = String(row.approvalOpinion ?? '');
    if (approvalOpinion.length > 100) throw new Error('每条物料的审批意见不能超过 100 字');
    return { itemId, approvalOpinion };
  });
}

export function validateDirectQuotation(basePrice: any, finalPrice: any) {
  decimalPrice(basePrice, '成本价');
  decimalPrice(finalPrice, '报价');
}

/** 加价比例使用百分数原值：成本20、比例25%得到指导价25，不是成本倍数或毛利率。 */
export function guidancePrice(cost: any, percent: any) {
  return decimalPrice(cost, '成本价').times(decimalPrice(percent, '加价比例', 4, -100).div(100).plus(1)).round(2, Big.roundHalfUp).toFixed(2);
}

/** 反算百分数，保留最后编辑的指导价，不再用舍入后的比例覆盖它。 */
export function guidanceRate(cost: any, price: any) {
  const base = decimalPrice(cost, '成本价');
  const final = decimalPrice(price, '指导价');
  if (base.eq(0)) throw new Error('成本价为 0，无法反算加价比例');
  return decimalPrice(final.minus(base).div(base).times(100).round(2, Big.roundHalfUp).toFixed(2), '加价比例', 2, -100).toFixed(2);
}

/** 价格缺失、脱敏或零成本时没有可回显的比例，不能使用后端旧比例兜底。 */
export function derivedGuidanceRate(cost: any, price: any): string | null {
  try { return guidanceRate(cost, price); } catch { return null; }
}

export function decimalPrice(value: any, label: string, precision = 2, minimum = 0) {
  if (!hasPrice(value)) throw new Error(`请填写${label}`);
  let number: Big;
  try {
    number = new Big(value);
  } catch {
    throw new Error(`${label}必须为有效数字`);
  }
  // UI uses a conservative safe bound to avoid JSON number precision loss.
  if (number.lt(minimum) || number.gt('9999999999')) throw new Error(`${label}须在 ${minimum}～9999999999 之间`);
  if (!number.eq(number.round(precision))) throw new Error(`${label}最多 ${precision} 位小数`);
  return number;
}

export function finalFromRate(basePrice: any, markupRate: any) {
  return decimalPrice(basePrice, '底价')
    .times(decimalPrice(markupRate, '提价比例', 4).plus(1))
    .round(2, Big.roundHalfUp)
    .toFixed(2);
}

export function rateFromFinal(basePrice: any, finalPrice: any) {
  const base = decimalPrice(basePrice, '底价');
  const final = decimalPrice(finalPrice, '终价');
  if (base.eq(0)) {
    if (!final.eq(0)) throw new Error('底价为 0 时终价只能为 0，无法反算提价比例');
    return '0.0000';
  }
  if (final.lt(base)) throw new Error('终价不能低于底价');
  return final.div(base).minus(1).round(4, Big.roundHalfUp).toFixed(4);
}

/** 价格字段按输入原值保存；不强制底价、比例、终价间的公式关系。 */
export function quotationPricePayload(row: any, required = false) {
  const result: Record<string, number> = {};
  for (const [key, label, precision] of [
    ['basePrice', '成本价', 2],
    ['finalPrice', '终价', 2],
  ] as const) {
    if (required || hasPrice(row[key])) result[key] = Number(decimalPrice(row[key], label, precision));
  }
  return result;
}

export function quotationSnapshot(row: any) {
  return JSON.stringify(
    ['id', 'materialId', 'unitId', 'quantity', 'remark', 'basePrice', 'finalPrice'].map((key) => {
      const value = row[key];
      if (['quantity', 'basePrice', 'markupRate', 'finalPrice'].includes(key) && hasPrice(value)) return new Big(value).toString();
      return value == null ? '' : String(value);
    })
  );
}
